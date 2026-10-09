import app from "ags/gtk4/app"
import Gdk from "gi://Gdk"
import Gtk from "gi://Gtk"
import { Astal } from "ags/gtk4"
import { lock, logout, suspend, reboot, poweroff } from "../services/system"
import Popup from "./Popup"

const ACTIONS = [
  { key: Gdk.KEY_l, icon: "system-lock-screen-symbolic", label: "Lock", run: lock, danger: false },
  { key: Gdk.KEY_s, icon: "weather-clear-night-symbolic", label: "Sleep", run: suspend, danger: false },
  { key: Gdk.KEY_e, icon: "system-log-out-symbolic", label: "Log out", run: logout, danger: true },
  { key: Gdk.KEY_r, icon: "system-reboot-symbolic", label: "Restart", run: reboot, danger: true },
  { key: Gdk.KEY_p, icon: "system-shutdown-symbolic", label: "Shut down", run: poweroff, danger: true },
]

// Power menu. Toggle with: ags toggle ypsilon-power (SUPER+Shift+Q).
// Mnemonics: l lock · s sleep · e log out · r restart · p shut down · Esc cancel
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
      <box spacing={18} halign={Gtk.Align.CENTER} marginTop={4} marginStart={6} marginEnd={6}>
        {ACTIONS.map((a) => (
          <box orientation={Gtk.Orientation.VERTICAL} spacing={8}>
            <button class={`power-tile${a.danger ? " danger" : ""}`} tooltipText={`${a.label} (${Gdk.keyval_name(a.key)})`} onClicked={() => run(a.run)}>
              <image iconName={a.icon} pixelSize={24} />
            </button>
            <label class="power-label" label={a.label} />
          </box>
        ))}
      </box>
    </Popup>
  )
}
