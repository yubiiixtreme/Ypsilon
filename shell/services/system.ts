// Ypsilon system actions — plain exec helpers, no daemons.
import { execAsync } from "ags/process"
import GLib from "gi://GLib"
import { ROOT } from "./theme"

const run = (argv: string[]) => execAsync(argv).catch((e) => print(`ypsilon: ${argv.join(" ")} failed: ${e}`))
const sh = (cmd: string) => run(["bash", "-c", cmd])
const cli = (...args: string[]) => run([`${ROOT}/scripts/ypsilon`, ...args])

/**
 * Start something that must outlive the shell (apps, the lock screen, browsers): Hyprland becomes
 * the parent, so `ypsilon restart` / a shell crash never takes your windows with it, and their
 * output stays out of the shell log. Falls back to a plain child outside Hyprland.
 */
export const detach = (cmd: string) =>
  execAsync(["hyprctl", "dispatch", "exec", cmd]).catch(() => sh(`setsid -f ${cmd} >/dev/null 2>&1`))

export const openUri = (uri: string) => detach(`xdg-open ${GLib.shell_quote(uri)}`)

// `ypsilon lock` uses the generated hyprlock config (theme colors + real paths)
export const lock = () => detach(`${GLib.shell_quote(`${ROOT}/scripts/ypsilon`)} lock`)
export const logout = () => run(["hyprctl", "dispatch", "exit"])
export const suspend = () => run(["systemctl", "suspend"])
export const reboot = () => run(["systemctl", "reboot"])
export const poweroff = () => run(["systemctl", "poweroff"])

export const toggleWifi = () =>
  sh(`if [ "$(nmcli radio wifi)" = "enabled" ]; then nmcli radio wifi off; else nmcli radio wifi on; fi`)

export const toggleBt = (isOn: boolean) => run(["bluetoothctl", "power", isOn ? "off" : "on"])

export const screenshot = (mode: "select" | "full") => cli("shot", mode)
export const wallpaperNext = () => cli("wallpaper", "next")
export const setTheme = (name: string) => cli("theme", "set", name, "--apply")

export const toggleGameMode = () => cli("gamemode", "toggle")
export const toggleNightlight = () => cli("nightlight", "toggle")
export const toggleCaffeine = () => cli("caffeine", "toggle")
export const toggleRecording = () => cli("record", "toggle")
export const colorPicker = () => cli("pick")
export const cliPath = `${ROOT}/scripts/ypsilon`
export const wallpaperSet = (path: string) => cli("wallpaper", "set", path)
