// Ypsilon system actions — plain exec helpers, no daemons.
import { execAsync } from "ags/process"
import { ROOT } from "./theme"

const run = (argv: string[]) => execAsync(argv).catch((e) => print(`ypsilon: ${argv.join(" ")} failed: ${e}`))
const sh = (cmd: string) => run(["bash", "-c", cmd])
const cli = (...args: string[]) => run([`${ROOT}/scripts/ypsilon`, ...args])

export const lock = () => sh(`pidof hyprlock || hyprlock -c ${ROOT}/hypr/hyprlock.conf`)
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
