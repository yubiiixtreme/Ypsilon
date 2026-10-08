import app from "ags/gtk4/app"
import Gtk from "gi://Gtk"
import { Astal } from "ags/gtk4"
import { createBinding, createComputed } from "ags"
import { getHypr, STRIP, gotoWorkspace } from "../services/hypr"

// Workspace overview sheet. Toggle with: ags toggle ypsilon-overview (SUPER+Tab).
export default function Overview() {
  const hypr = getHypr()
  const spaces = createBinding(hypr, "workspaces")
  const focused = createBinding(hypr, "focusedWorkspace")
  const clients = createBinding(hypr, "clients")
  const focusedClient = createBinding(hypr, "focusedClient")

  const activeId = createComputed(() => focused()?.id ?? -1)
  const occupied = createComputed(() => new Set(spaces().map((w) => w.id)))
  const state = createComputed(() => ({ active: activeId(), occ: occupied() }))

  return (
    <window
      visible={false}
      name="ypsilon-overview"
      namespace="ypsilon-overview"
      class="ypsilon-overview"
      anchor={Astal.WindowAnchor.TOP}
      application={app}
    >
      <box halign={Gtk.Align.CENTER}>
        <box class="overview-inner" orientation={Gtk.Orientation.VERTICAL} spacing={12}>
          <label class="overview-title" label="overview" />
          <box class="ws-grid" spacing={8}>
            {STRIP.map((id) => (
              <button
                class={state((s) => `ws-btn big${id === s.active ? " active" : ""}${s.occ.has(id) ? " occupied" : ""}`)}
                label={String(id)}
                onClicked={() => {
                  gotoWorkspace(id)
                  app.get_window("ypsilon-overview")?.set_visible(false)
                }}
              />
            ))}
          </box>
          <label
            class="control-sub"
            label={createComputed(() => {
              const c = focusedClient()
              const n = clients().length
              return `${n} window${n === 1 ? "" : "s"} · ${c?.title ? c.title.slice(0, 40) : "no focus"}`
            })}
          />
        </box>
      </box>
    </window>
  ) as never
}
