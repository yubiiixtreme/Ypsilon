// Ypsilon screen gamma — the hyprsunset daemon owned by `ypsilon gamma` (scripts/cli/display.sh).
// 100 = neutral; no daemon answering also means 100 (the CLI stops it when the screen is neutral).
import { createState } from "ags"
import { execAsync } from "ags/process"
import GLib from "gi://GLib"
import { ROOT } from "./theme"

const [level, setLevel] = createState(100)
export const gamma = level

/** Re-read the gamma (percent) from hyprsunset's IPC. */
export function refreshGamma() {
  execAsync(["hyprctl", "hyprsunset", "gamma"])
    .then((out) => {
      const v = Number(out.trim())
      setLevel(Number.isFinite(v) && v > 0 ? Math.round(v) : 100)
    })
    .catch(() => setLevel(100))
}

let pending = 0
/** Slider-friendly: updates the state now, runs the CLI once the value settles (no OSD). */
export function setGamma(v: number) {
  const n = Math.round(Math.max(20, Math.min(150, v)))
  setLevel(n)
  if (pending) GLib.source_remove(pending)
  pending = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 90, () => {
    pending = 0
    execAsync([`${ROOT}/scripts/ypsilon`, "gamma", "set", String(n), "--quiet"]).catch((e) =>
      print(`ypsilon: gamma set failed: ${e}`),
    )
    return GLib.SOURCE_REMOVE
  })
}
