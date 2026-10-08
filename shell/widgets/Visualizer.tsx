import Gtk from "gi://Gtk"
import { Accessor } from "ags"
import { bars, visualizerAvailable, acquireVisualizer, releaseVisualizer } from "../services/visualizer"

/**
 * Cava bars drawn with cairo in the widget's CSS color. Audio capture is reference counted:
 * it only runs while this widget is mapped (and `when` is true, e.g. "a player is playing").
 */
export default function Visualizer({ width = 64, height = 14, when }: { width?: number; height?: number; when?: Accessor<boolean> }) {
  const setup = (area: Gtk.DrawingArea) => {
    area.set_draw_func((_a, cr, w, h) => {
      const values = bars.peek()
      if (values.length === 0) return
      const c = area.get_color()
      cr.setSourceRGBA(c.red, c.green, c.blue, 0.9)
      const gap = 2
      const bw = Math.max(1, (w - gap * (values.length - 1)) / values.length)
      values.forEach((v, i) => {
        const bh = Math.max(2, Math.min(1, v) * h)
        cr.rectangle(i * (bw + gap), h - bh, bw, bh)
      })
      cr.fill()
    })
    const unsub = bars.subscribe(() => area.queue_draw())

    let held = false
    const update = () => {
      const want = area.get_mapped() && (when ? when.peek() : true)
      if (want && !held) {
        held = true
        acquireVisualizer()
      } else if (!want && held) {
        held = false
        releaseVisualizer()
      }
    }
    area.connect("map", update)
    area.connect("unmap", update)
    const unsubWhen = when?.subscribe(update)
    area.connect("destroy", () => {
      unsub()
      unsubWhen?.()
      if (held) releaseVisualizer()
    })
  }
  return <drawingarea class="visualizer" widthRequest={width} heightRequest={height} visible={visualizerAvailable} $={setup} />
}
