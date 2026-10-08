import Gtk from "gi://Gtk"
import { Accessor } from "ags"

/** sparkline of 0..1 samples (CPU / memory history), filled under the line, CSS color */
export default function Graph({ data, height = 46 }: { data: Accessor<number[]>; height?: number }) {
  const setup = (area: Gtk.DrawingArea) => {
    area.set_draw_func((_a, cr, w, h) => {
      const v = data.peek()
      if (v.length < 2) return
      const c = area.get_color()
      const step = w / (v.length - 1)
      const y = (x: number) => h - 3 - Math.min(1, Math.max(0, x)) * (h - 6)
      cr.moveTo(0, y(v[0]))
      v.forEach((x, i) => cr.lineTo(i * step, y(x)))
      cr.setSourceRGBA(c.red, c.green, c.blue, 0.95)
      cr.setLineWidth(2)
      cr.strokePreserve()
      cr.lineTo(w, h)
      cr.lineTo(0, h)
      cr.closePath()
      cr.setSourceRGBA(c.red, c.green, c.blue, 0.18)
      cr.fill()
    })
    const unsub = data.subscribe(() => area.queue_draw())
    area.connect("destroy", unsub)
  }
  return <drawingarea class="graph" hexpand heightRequest={height} $={setup} />
}
