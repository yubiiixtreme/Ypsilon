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

/**
 * Bumps whenever windows open, close or move between workspaces. A move only changes
 * Client.workspace, which never notifies Hyprland.clients — bindings on the list alone miss it.
 */
let layoutTick: Accessor<number> | undefined
export function hyprLayoutTick(): Accessor<number> {
  if (layoutTick) return layoutTick
  const [tick, setTick] = createState(0)
  const h = getHypr()
  const bump = () => setTick((t) => t + 1)
  h?.connect("client-added", bump)
  h?.connect("client-removed", bump)
  h?.connect("client-moved", bump)
  layoutTick = tick
  return tick
}

// actions go through `hyprctl eval`: Hyprland's Lua config rejects the old `hyprctl dispatch <name> <arg>` syntax
const lua = (code: string) =>
  execAsync(["hyprctl", "eval", code]).catch((e) => print(`ypsilon: eval ${code} failed: ${e}`))
export const gotoWorkspace = (id: number) => lua(`hl.dispatch(hl.dsp.focus({ workspace = ${Math.trunc(id)} }))`)
export const moveToWorkspace = (id: number) => lua(`hl.dispatch(hl.dsp.window.move({ workspace = ${Math.trunc(id)} }))`)
export const focusAddress = (address: string) =>
  lua(`hl.dispatch(hl.dsp.focus({ window = "address:${address.replace(/[^0-9a-fx]/gi, "")}" }))`)
export const stepWorkspace = (dir: 1 | -1) => lua(`hl.dispatch(hl.dsp.focus({ workspace = "${dir === 1 ? "e+1" : "e-1"}" }))`)
