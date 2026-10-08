// Ypsilon brightness service — lazy AstalBrightness singleton.
import Brightness from "gi://AstalBrightness"

let _b: ReturnType<typeof Brightness.get_default> | null = null

export function getBrightness() {
  if (!_b) _b = Brightness.get_default()
  return _b
}

export function setBrightness(v: number) {
  try {
    const s = getBrightness().screen
    if (s) s.brightness = Math.max(0.05, Math.min(1, v))
  } catch (e) {
    print(`ypsilon: setBrightness failed: ${e}`)
  }
}
