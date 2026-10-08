import app from "ags/gtk4/app"
import Gdk from "gi://Gdk"
import Gtk from "gi://Gtk"
import { Astal } from "ags/gtk4"
import { lock, logout, suspend, reboot, poweroff } from "../services/system"
import Popup from "./Popup"

const ACTIONS = [
  { key: Gdk.KEY_l, icon: "system-lock-screen-symbolic", label: "lock", run: lock, danger: false },
  { key: Gdk.KEY_e, icon: "system-log-out-symbolic", label: "logout", run: logout, danger: true },
  { key: Gdk.KEY_s, icon: "weather-clear-night-symbolic", label: "suspend", run: suspend, danger: false },
  { key: Gdk.KEY_r, icon: "system-reboot-symbolic", label: "reboot", run: reboot, danger: true },
  { key: Gdk.KEY_p, icon: "system-shutdown-symbolic", label: "off", run: poweroff, danger: true },
]

// Glass powermenu. Toggle with: ags toggle ypsilon-power (SUPER+Shift+Q).
// Mnemonics: l lock · e logout · s suspend · r reboot · p power off · Esc cancel
export default function Powermenu() {
  const hide = () => app.get_window("ypsilon-power")?.set_visible(false)
  const run = (fn: () => unknown) => {
    hide()
    fn()
  }

  return (
    <Popup
      name="ypsilon-power"
      keymode={Astal.Keymode.EXCLUSIVE}
      onKey={(keyval) => {
        const a = ACTIONS.find((x) => x.key === keyval)
        if (!a) return false
        run(a.run)
        return true
      }}
    >
      <label class="title" label="power" halign={Gtk.Align.CENTER} />
      <box spacing={10} halign={Gtk.Align.CENTER}>
        {ACTIONS.map((a) => (
          <button class={`power-tile${a.danger ? " danger" : ""}`} onClicked={() => run(a.run)}>
            <box orientation={Gtk.Orientation.VERTICAL} spacing={6}>
              <image iconName={a.icon} pixelSize={26} />
              <label label={a.label} />
            </box>
          </button>
        ))}
      </box>
      <label class="hint" label="l · e · s · r · p — or esc to cancel" halign={Gtk.Align.CENTER} />
    </Popup>
  )
}
