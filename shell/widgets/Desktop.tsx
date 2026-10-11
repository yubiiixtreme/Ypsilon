// Desktop layers, one set per monitor: rounded screen corners and a big clock on the wallpaper.
// Both are click-through and idle at rest — corners are drawn once, the clock text changes once
// a minute through the shared wall clock. Settings → Desktop (config `desktop.*`) switches them live.
import Gtk from "gi://Gtk"
import Gdk from "gi://Gdk"
import Cairo from "cairo"
import { Astal } from "ags/gtk4"
import { onCleanup } from "ags"
import { config } from "../services/config"
import { wallClock } from "../services/clock"

/** pointer input passes through to whatever is below (wallpaper, windows) */
function clickThrough(win: Gtk.Window) {
  const apply = () => win.get_surface()?.set_input_region(new Cairo.Region())
  win.connect("map", apply)
  if (win.get_mapped()) apply()
  return apply
}

type Corner = "tl" | "tr" | "bl" | "br"

/** black fill outside a quarter circle — the screen looks physically rounded */
function drawCorner(at: Corner) {
  return (_area: Gtk.DrawingArea, cr: Cairo.Context, w: number, h: number) => {
    const r = Math.min(w, h)
    // draw the top-left shape, mirrored into place for the other corners
    cr.translate(at[1] === "r" ? w : 0, at[0] === "b" ? h : 0)
    cr.scale(at[1] === "r" ? -1 : 1, at[0] === "b" ? -1 : 1)
    cr.setSourceRGBA(0, 0, 0, 1)
    cr.moveTo(0, 0)
    cr.lineTo(r, 0)
    cr.arcNegative(r, r, r, -Math.PI / 2, -Math.PI)
    cr.closePath()
    cr.fill()
    cr.$dispose()
  }
}

function ScreenCorner({ gdkmonitor, at }: { gdkmonitor: Gdk.Monitor; at: Corner }) {
  let win: Astal.Window
  onCleanup(() => win.destroy())
  const { TOP, BOTTOM, LEFT, RIGHT } = Astal.WindowAnchor
  const size = config((c) => c.desktop.cornerRadius)
  return (
    <window
      $={(self) => {
        win = self
        clickThrough(self)
      }}
      visible={config((c) => c.desktop.screenCorners)}
      namespace="ypsilon-corner"
      class="ypsilon-corner"
      gdkmonitor={gdkmonitor}
      layer={Astal.Layer.TOP}
      exclusivity={Astal.Exclusivity.IGNORE}
      anchor={(at[0] === "t" ? TOP : BOTTOM) | (at[1] === "l" ? LEFT : RIGHT)}
      defaultWidth={size}
      defaultHeight={size}
    >
      <drawingarea contentWidth={size} contentHeight={size} $={(self) => self.set_draw_func(drawCorner(at))} />
    </window>
  )
}

export function ScreenCorners({ gdkmonitor }: { gdkmonitor: Gdk.Monitor }) {
  return (["tl", "tr", "bl", "br"] as const).map((at) => <ScreenCorner gdkmonitor={gdkmonitor} at={at} />)
}

/** big time + date on the wallpaper (BOTTOM layer: windows cover it, empty workspaces show it) */
export function DesktopClock({ gdkmonitor }: { gdkmonitor: Gdk.Monitor }) {
  let win: Astal.Window
  let reapply = () => {}
  onCleanup(() => win.destroy())
  const { TOP, BOTTOM, LEFT, RIGHT } = Astal.WindowAnchor
  const pos = config((c) => c.desktop.clockPosition)
  const anchor = pos((p) => {
    if (p === "center") return 0 as Astal.WindowAnchor
    return (p.startsWith("top") ? TOP : BOTTOM) | (p.endsWith("left") ? LEFT : RIGHT)
  })
  const time = wallClock(() => (config().bar.clock24h ? "%H:%M" : "%-I:%M"))
  const date = wallClock(() => "%A, %-d %B")
  const align = pos((p) => (p.endsWith("right") ? Gtk.Align.END : p === "center" ? Gtk.Align.CENTER : Gtk.Align.START))
  return (
    <window
      $={(self) => {
        win = self
        reapply = clickThrough(self)
      }}
      visible={config((c) => c.desktop.clock)}
      namespace="ypsilon-desktop"
      class="ypsilon-desktop"
      gdkmonitor={gdkmonitor}
      layer={Astal.Layer.BOTTOM}
      exclusivity={Astal.Exclusivity.NORMAL}
      anchor={anchor}
    >
      <box class="desk-clock" orientation={Gtk.Orientation.VERTICAL} halign={align}>
        {/* a new text can resize the surface; keep the input region empty after every change */}
        <label class="desk-time" label={time} halign={align} onNotifyLabel={() => reapply()} />
        <label class="desk-date" label={date} halign={align} />
      </box>
    </window>
  )
}
