import Gtk from "gi://Gtk"
import app from "ags/gtk4/app"
import { createComputed, For } from "ags"
import Hyprland from "gi://AstalHyprland"
import { getHypr, hyprFocusedWorkspace, gotoWorkspace, focusAddress } from "../services/hypr"
import { config } from "../services/config"
import { iconForClass } from "../services/icons"
import { monitorRect, fitRects, rows, type Rect } from "../lib/overview"
import Popup from "./Popup"

// Workspace overview: each workspace as a scaled miniature of its monitor, every window at its real
// position and size (app icon inside); click a window to focus it, the number to switch.
// Previews are rebuilt when the overview opens — nothing is tracked while it is hidden.
// Toggle with: ags toggle ypsilon-overview (SUPER+Tab).
const PREVIEW_W = 216
const PER_ROW = 3

const hide = () => app.get_window("ypsilon-overview")?.set_visible(false)

/** fill `fixed` with one button per window of workspace `id` */
function paint(fixed: Gtk.Fixed, id: number) {
  for (let c = fixed.get_first_child(); c; c = fixed.get_first_child()) fixed.remove(c)
  const h = getHypr()
  if (!h) return
  const ws = h.workspaces.find((w) => w.id === id)
  const mon: Hyprland.Monitor | null = ws?.monitor ?? h.focusedMonitor
  const area: Rect = mon ? monitorRect(mon) : { x: 0, y: 0, w: 1920, h: 1080 }
  // floating windows last so they sit on top, like on screen
  const wins = h.clients.filter((c) => c.workspace?.id === id && c.mapped !== false).sort((a, b) => Number(a.floating) - Number(b.floating))
  const fit = fitRects(area, wins.map((c) => ({ x: c.x, y: c.y, w: c.width, h: c.height })), PREVIEW_W)
  fixed.set_size_request(fit.w, fit.h)
  wins.forEach((c, i) => {
    const r = fit.rects[i]
    const btn = new Gtk.Button({ cssClasses: ["ov-win"], tooltipText: c.title || c.class, widthRequest: r.w, heightRequest: r.h })
    btn.set_child(new Gtk.Image({ iconName: iconForClass(c.class || c.initialClass), pixelSize: Math.max(12, Math.min(32, Math.floor(Math.min(r.w, r.h) / 2))) }))
    btn.connect("clicked", () => {
      focusAddress(c.address)
      hide()
    })
    fixed.put(btn, r.x, r.y)
  })
}

export default function Overview() {
  const focused = hyprFocusedWorkspace()
  const fixeds = new Map<number, Gtk.Fixed>()
  const ids = createComputed(() => Array.from({ length: config().workspaces }, (_, i) => i + 1))
  const grid = ids((l) => rows(l, PER_ROW))

  return (
    <Popup name="ypsilon-overview" spacing={12} onShow={() => ids.peek().forEach((id) => fixeds.get(id) && paint(fixeds.get(id)!, id))}>
      <box orientation={Gtk.Orientation.VERTICAL} spacing={10}>
        <For each={grid}>
          {(row) => (
            <box spacing={10} halign={Gtk.Align.CENTER}>
              {row.map((id) => (
                <box class={focused((f) => `ws-card${f?.id === id ? " active" : ""}`)} orientation={Gtk.Orientation.VERTICAL} spacing={6}>
                  <button
                    class="ws-btn ov-num"
                    label={String(id)}
                    halign={Gtk.Align.START}
                    onClicked={() => {
                      gotoWorkspace(id)
                      hide()
                    }}
                  />
                  <box class="ov-screen" overflow={Gtk.Overflow.HIDDEN} halign={Gtk.Align.CENTER}>
                    <Gtk.Fixed
                      $={(self: Gtk.Fixed) => {
                        fixeds.set(id, self)
                        paint(self, id)
                      }}
                    />
                  </box>
                </box>
              ))}
            </box>
          )}
        </For>
      </box>
    </Popup>
  )
}
