// @ts-check
import * as L from "./list.js"

/** @param {import("../../shell/lib/plugin-types").PluginApi} api */
export default function todo(api) {
  const [items, setItems] = api.state(L.sanitize(api.storage.get("items", [])))
  const save = (/** @type {L.Item[]} */ next) => (setItems(next), api.storage.set("items", next))
  const openCount = api.computed(() => L.open(items()).length)

  api.launcher.addProvider({
    name: "To-do — type to add · Enter on an item ticks it off",
    prefix: "todo",
    search: (q) => {
      const list = items() // tracked: rows refresh as soon as an item changes
      /** @type {import("../../shell/lib/plugin-types").Row[]} */
      const rows = []
      if (q) rows.push({ title: `Add “${q}”`, sub: "New to-do", icon: "list-add-symbolic", run: () => save(L.add(items.peek(), q)) })
      for (const i of L.view(list, q))
        rows.push({
          title: i.text,
          sub: i.done ? "Done · Enter to reopen" : "Enter to tick off",
          icon: i.done ? "checkbox-checked-symbolic" : "task-due-symbolic",
          run: () => save(L.toggle(items.peek(), i.id)),
        })
      if (list.some((i) => i.done) && !q)
        rows.push({ title: "Clear finished", icon: "edit-clear-all-symbolic", run: () => save(L.clearDone(items.peek())) })
      return rows
    },
  })

  api.bar.add({
    position: "right",
    order: -8,
    widget: () =>
      api.h(
        "button",
        {
          class: "plugin-chip",
          visible: api.computed(() => api.settings().showInBar !== false && openCount() > 0),
          tooltipText: api.computed(() => L.open(items()).map((i) => `• ${i.text}`).join("\n")),
          onClicked: () => void api.exec(["ags", "toggle", "-i", "ypsilon", "ypsilon-launcher"]).catch(() => {}),
        },
        api.h("box", { spacing: 5 },
          api.h("image", { iconName: "task-due-symbolic", pixelSize: 13 }),
          api.h("label", { class: "status-sub", label: api.computed(() => String(openCount())) }),
        ),
      ),
  })

  api.controlCenter.addTile({
    icon: "task-due-symbolic",
    title: "To-do",
    sub: api.computed(() => (openCount() === 0 ? "All done" : `${openCount()} open`)),
    active: api.computed(() => openCount() > 0),
    onClick: () => void api.exec(["ags", "toggle", "-i", "ypsilon", "ypsilon-launcher"]).catch(() => {}),
  })

  // ypsilon plugin run todo add buy milk · list · done 3
  api.commands.add("add", (args) => (save(L.add(items.peek(), args.join(" "))), `${L.open(items.peek()).length} open`))
  api.commands.add("list", () => L.view(items.peek()).map((i) => `${i.id}. [${i.done ? "x" : " "}] ${i.text}`).join("\n") || "nothing to do")
  api.commands.add("done", (args) => (save(L.toggle(items.peek(), Number(args[0]))), "ok"))
  api.commands.add("clear", () => (save(L.clearDone(items.peek())), `${items.peek().length} left`))
}
