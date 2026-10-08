// Ypsilon Hyprland service — lazy singleton (client-process safe).
// State via AstalHyprland bindings; actions via hyprctl (always available).
import Hyprland from "gi://AstalHyprland"
import { execAsync } from "ags/process"

let _hypr: ReturnType<typeof Hyprland.get_default> | null = null

export function getHypr() {
  if (!_hypr) _hypr = Hyprland.get_default()
  return _hypr
}

/** Fixed workspace strip 1..5 (matches keybinds). */
export const STRIP = [1, 2, 3, 4, 5]

export function gotoWorkspace(id: number) {
  execAsync(["hyprctl", "dispatch", "workspace", String(id)]).catch((e) => print(`ypsilon: workspace ${id} failed: ${e}`))
}

export function moveToWorkspace(id: number) {
  execAsync(["hyprctl", "dispatch", "movetoworkspace", String(id)]).catch((e) => print(`ypsilon: move ${id} failed: ${e}`))
}
