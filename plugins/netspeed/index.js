// @ts-check
import { parseNetDev, rates, formatRate } from "./netdev.js"

/** @param {import("../../shell/lib/plugin-types").PluginApi} api */
export default function netspeed(api) {
  /** @type {Record<string, import("./netdev.js").Counters>} */
  let last = {}
  let lastAt = 0
  const speed = api.poll({ down: 0, up: 0 }, 2000, async (prev) => {
    const text = await api.exec(["cat", "/proc/net/dev"]).catch(() => "")
    const cur = parseNetDev(text)
    const now = Date.now()
    const r = lastAt ? rates(last, cur, now - lastAt, String(api.settings.peek().iface ?? "")) : prev
    last = cur
    lastAt = now
    return r
  })
  const idle = api.computed(() => speed().down + speed().up < 2048)

  const pos = /** @type {"left" | "center" | "right"} */ (String(api.settings.peek().position ?? "right"))
  api.bar.add({
    position: pos,
    order: -5,
    widget: () =>
      api.h(
        "box",
        {
          class: "plugin-chip",
          spacing: 10,
          visible: api.computed(() => !(api.settings().hideIdle !== false && idle())),
          tooltipText: "Download · upload",
        },
        api.h("box", { spacing: 4 },
          api.h("image", { iconName: "network-receive-symbolic", pixelSize: 13 }),
          api.h("label", { class: "status-sub", label: api.computed(() => formatRate(speed().down)) }),
        ),
        api.h("box", { spacing: 4 },
          api.h("image", { iconName: "network-transmit-symbolic", pixelSize: 13 }),
          api.h("label", { class: "status-sub", label: api.computed(() => formatRate(speed().up)) }),
        ),
      ),
  })

  api.commands.add("now", () => `down ${formatRate(speed.peek().down)} · up ${formatRate(speed.peek().up)}`)
}
