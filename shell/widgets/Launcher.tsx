import app from "ags/gtk4/app"
import Gtk from "gi://Gtk"
import { Astal } from "ags/gtk4"
import { createComputed, createState, For } from "ags"
import { queryApps } from "../services/apps"
import { execAsync } from "ags/process"

// Spotlight-style launcher (top sheet): fuzzy apps + `=calc` + `:run-command`.
// Toggle with: ags toggle ypsilon-launcher (SUPER+Space).
export default function Launcher() {
  const [query, setQuery] = createState("")
  const results = createComputed(() => queryApps(query()))

  const calc = createComputed(() => {
    const q = query().trim()
    if (!q.startsWith("=")) return null
    const expr = q.slice(1).trim()
    if (!/^[0-9+\-*/(). %]+$/.test(expr) || expr === "") return null
    try {
      const v = Function(`"use strict"; return (${expr})`)() as number
      if (typeof v !== "number" || !isFinite(v)) return null
      return `${expr} = ${Math.round(v * 1e6) / 1e6}`
    } catch {
      return null
    }
  })

  const hide = () => {
    setQuery("")
    app.get_window("ypsilon-launcher")?.set_visible(false)
  }

  const submit = () => {
    const q = query().trim()
    if (q.startsWith(":")) {
      execAsync(["bash", "-c", q.slice(1)]).catch((e) => print(`ypsilon run: ${e}`))
      hide()
      return
    }
    if (calc() !== null) {
      execAsync(["wl-copy", calc()!.split("=").pop()!.trim()]).catch(() => {})
      hide()
      return
    }
    const list = results()
    if (list.length > 0) {
      try {
        list[0].launch()
      } catch (e) {
        print(`ypsilon launcher: ${e}`)
      }
      hide()
    }
  }

  return (
    <window
      visible={false}
      name="ypsilon-launcher"
      namespace="ypsilon-launcher"
      class="ypsilon-launcher"
      anchor={Astal.WindowAnchor.TOP}
      keymode={Astal.Keymode.ON_DEMAND}
      application={app}
    >
      <box halign={Gtk.Align.CENTER}>
        <box class="launcher-inner" orientation={Gtk.Orientation.VERTICAL} spacing={10}>
          <label class="launcher-title" label="✦ ypsilon" />
          <entry
            class="entry"
            placeholderText="apps · =calc · :command"
            text={query}
            onNotifyText={({ text }) => setQuery(text)}
            onActivate={submit}
          />
          {<label class="launcher-sub" visible={calc((c) => c !== null)} label={calc((c) => c ?? "")} />}
          <box orientation={Gtk.Orientation.VERTICAL} spacing={4}>
            <For each={results}>
              {(item) => (
                <button
                  class="app-row"
                  onClicked={() => {
                    try {
                      item.launch()
                    } catch (e) {
                      print(`ypsilon launcher: ${e}`)
                    }
                    hide()
                  }}
                >
                  <box spacing={10}>
                    <image iconName="application-x-executable" pixelSize={20} />
                    <box orientation={Gtk.Orientation.VERTICAL}>
                      <label class="app-name" label={item.name} />
                      <label class="launcher-sub" label={item.description || ""} />
                    </box>
                  </box>
                </button>
              )}
            </For>
          </box>
          <label class="launcher-sub" label="enter = run · toggle again to close" />
        </box>
      </box>
    </window>
  ) as never
}
