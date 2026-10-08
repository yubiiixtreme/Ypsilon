// Ypsilon system actions — plain exec helpers, no daemons.
import { execAsync } from "ags/process"
import { ROOT } from "./theme"

const sh = (cmd: string) => execAsync(["bash", "-c", cmd]).catch((e) => print(`ypsilon: ${cmd} failed: ${e}`))

export const lock = () => sh(`pidof hyprlock || hyprlock -c ${ROOT}/hypr/hyprlock.conf`)
export const logout = () => sh("hyprctl dispatch exit")
export const suspend = () => sh("systemctl suspend")
export const reboot = () => sh("systemctl reboot")
export const poweroff = () => sh("systemctl poweroff")

export const toggleWifi = () =>
  sh(`if [ "$(nmcli radio wifi)" = "enabled" ]; then nmcli radio wifi off; else nmcli radio wifi on; fi`)

export const toggleBt = () =>
  sh(`if bluetoothctl show | grep -q "Powered: yes"; then bluetoothctl power off; else bluetoothctl power on; fi`)

export const screenshotSelect = () => sh(`grim -g "$(slurp)" - | wl-copy`)
export const screenshotFull = () => sh(`grim - | wl-copy`)

export const wallpaperNext = () => sh(`${ROOT}/scripts/wallpaper.sh next`)
