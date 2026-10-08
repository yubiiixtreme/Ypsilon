// Ypsilon OSD state — shown via `ags request osd <volume|brightness>`.
// createState is inert (no Astal here), so module import is client-safe.
import { createState } from "ags"
import GLib from "gi://GLib"
import { config } from "./config"

export type OsdMode = "volume" | "brightness"

const [visible, setVisible] = createState(false)
const [mode, setMode] = createState<OsdMode>("volume")

export const osdVisible = visible
export const osdMode = mode

let gen = 0

export function showOsd(m: OsdMode) {
  setMode(m === "brightness" ? "brightness" : "volume")
  setVisible(true)
  const g = ++gen
  GLib.timeout_add(GLib.PRIORITY_DEFAULT, config().osdTimeoutMs, () => {
    if (g === gen) setVisible(false)
    return GLib.SOURCE_REMOVE
  })
}
