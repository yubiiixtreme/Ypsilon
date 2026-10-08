// Battery: null-safe access (no UPower → no battery widgets) + low-battery notifications.
import Battery from "gi://AstalBattery"
import { execAsync } from "ags/process"
import { batteryAlert, INITIAL } from "../lib/battery"
import { config } from "./config"

let _bat: Battery.Device | null | undefined

export function getBattery(): Battery.Device | null {
  if (_bat === undefined) {
    try {
      _bat = Battery.get_default()
    } catch (e) {
      printerr(`ypsilon: AstalBattery unavailable: ${e}`)
      _bat = null
    }
  }
  return _bat
}

let started = false
export function startBatteryWatch() {
  const bat = getBattery()
  if (started || !bat) return
  started = true
  let st = INITIAL
  const check = () => {
    if (!bat.isPresent) return
    const pct = Math.round(bat.percentage * 100)
    const r = batteryAlert(pct, bat.charging, config().battery, st)
    st = r.state
    if (r.alert) {
      const crit = r.alert === "critical"
      execAsync([
        "notify-send", "-u", crit ? "critical" : "normal", "-i", "battery-caution-symbolic",
        crit ? "Battery critical" : "Battery low", `${pct}% remaining — plug in soon`,
      ]).catch((e) => print(`ypsilon battery: ${e}`))
    }
  }
  bat.connect("notify::percentage", check)
  bat.connect("notify::charging", check)
}
