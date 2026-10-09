import Gtk from "gi://Gtk"
import app from "ags/gtk4/app"
import { createBinding, createComputed, For } from "ags"
import { hyprClients, hyprFocusedWorkspace, gotoWorkspace, focusAddress } from "../services/hypr"
import { config } from "../services/config"
import { iconForClass } from "../services/icons"
import Popup from "./Popup"

// Workspace overview: every workspace with its windows (app icon + title); click to jump / focus.
// Toggle with: ags toggle ypsilon-overview (SUPER+Tab).
export default function Overview() {
  const clients = hyprClients()
  const focused = hyprFocusedWorkspace()
  const hide = () => app.get_window("ypsilon-overview")?.set_visible(false)

  return (
    <Popup name="ypsilon-overview" spacing={12}>
      <box spacing={10} homogeneous>
        {Array.from({ length: Math.min(config().workspaces, 6) }, (_, i) => i + 1).map((id) => {
          const mine = createComputed(() => clients().filter((c) => c.workspace?.id === id))
          return (
            <box
              class={focused((f) => `ws-card${f?.id === id ? " active" : ""}`)}
              orientation={Gtk.Orientation.VERTICAL}
              spacing={4}
            >
              <button
                class="ws-btn big"
                label={String(id)}
                onClicked={() => {
                  gotoWorkspace(id)
                  hide()
                }}
              />
              <For each={mine}>
                {(c) => (
                  <button
                    class="client-row"
                    onClicked={() => {
                      focusAddress(c.address)
                      hide()
                    }}
                  >
                    <box spacing={6}>
                      <image iconName={iconForClass(c.class)} pixelSize={18} />
                      <label label={(c.title || c.class || "Window").slice(0, 18)} halign={Gtk.Align.START} ellipsize={3} maxWidthChars={18} />
                    </box>
                  </button>
                )}
              </For>
              <label class="sub" label="Empty" vexpand visible={mine((m) => m.length === 0)} />
            </box>
          )
        })}
      </box>
    </Popup>
  )
}
