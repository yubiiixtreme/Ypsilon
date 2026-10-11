// Desktop chrome, one set per monitor: rounded screen corners (cairo, drawn once).
// Click-through and idle at rest. Settings → Desktop (config `desktop.*`) switches it live.
// Wallpaper widgets (clock, stats, …) live in ./Widgets.tsx and only render when enabled
// (config `widgets.enabled`) — nothing sits on the desktop unless you put it there.
import Gtk from "gi://Gtk"
import Gdk from "gi://Gdk"
import Cairo from "cairo"
import { Astal } from "ags/gtk4"
import { onCleanup } from "ags"
import { config } from "../services/config"

/** pointer input passes through to whatever is below (wallpaper, windows) */
export function clickThrough(win: Gtk.Window) {
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
