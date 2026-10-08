// Audio visualizer via AstalCava — OPTIONAL: loaded with a dynamic import, so a missing
// libastal-cava only disables this feature. Capture runs only while something displays it.
import { createState } from "ags"

type Cava = { active: boolean; bars: number; get_values(): number[]; connect(sig: string, cb: () => void): number }

const [bars, setBars] = createState<number[]>([])
const [available, setAvailable] = createState(false)
export { bars, available as visualizerAvailable }

let cava: Cava | null = null
let users = 0

async function load(): Promise<Cava | null> {
  if (cava) return cava
  try {
    const mod = await import("gi://AstalCava")
    const c = mod.default.get_default() as unknown as Cava | null
    if (!c) return null
    c.active = false // Cava starts capturing on creation; we only want it while visible
    c.bars = 24
    c.connect("notify::values", () => setBars(c.get_values()))
    cava = c
    setAvailable(true)
    return c
  } catch (e) {
    printerr(`ypsilon: visualizer disabled (libastal-cava not available): ${e}`)
    return null
  }
}

/** ref-counted: widgets call acquire() when shown and release() when hidden */
export async function acquireVisualizer() {
  users++
  const c = await load()
  if (c && users > 0) c.active = true
}
export function releaseVisualizer() {
  users = Math.max(0, users - 1)
  if (cava && users === 0) {
    cava.active = false
    setBars([])
  }
}
