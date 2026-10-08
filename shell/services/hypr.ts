// Ypsilon Hyprland service. AstalHyprland.get_default() returns null when Hyprland's IPC is
// unavailable or fails to initialize (e.g. an IPC change in a new Hyprland release). Widgets
// use the null-safe accessors below, so the shell degrades (empty lists) instead of crashing.
import Hyprland from "gi://AstalHyprland"
import { Accessor, createBinding, createState } from "ags"
import { execAsync } from "ags/process"

let _hypr: Hyprland.Hyprland | null | undefined

export function getHypr(): Hyprland.Hyprland | null {
  if (_hypr === undefined) {
    try {
      _hypr = Hyprland.get_default()
    } catch (e) {
      printerr(`ypsilon: AstalHyprland unavailable: ${e}`)
      _hypr = null
    }
    if (!_hypr) printerr("ypsilon: Hyprland IPC unavailable — workspace/window widgets will be empty")
  }
  return _hypr
}

const constant = <T,>(v: T): Accessor<T> => createState(v)[0]

export const hyprWorkspaces = (): Accessor<Hyprland.Workspace[]> => {
  const h = getHypr()
  return h ? createBinding(h, "workspaces") : constant([])
}
export const hyprClients = (): Accessor<Hyprland.Client[]> => {
  const h = getHypr()
  return h ? createBinding(h, "clients") : constant([])
}
export const hyprFocusedWorkspace = (): Accessor<Hyprland.Workspace | null> => {
  const h = getHypr()
  return h ? createBinding(h, "focusedWorkspace") : constant(null)
}
export const hyprFocusedClient = (): Accessor<Hyprland.Client | null> => {
  const h = getHypr()
  return h ? createBinding(h, "focusedClient") : constant(null)
}

// actions go through hyprctl, which works even when the IPC library does not
const dispatch = (...args: string[]) =>
  execAsync(["hyprctl", "dispatch", ...args]).catch((e) => print(`ypsilon: dispatch ${args.join(" ")} failed: ${e}`))

export const gotoWorkspace = (id: number) => dispatch("workspace", String(id))
export const moveToWorkspace = (id: number) => dispatch("movetoworkspace", String(id))
export const focusAddress = (address: string) => dispatch("focuswindow", `address:${address}`)
export const stepWorkspace = (dir: 1 | -1) => dispatch("workspace", dir === 1 ? "e+1" : "e-1")
