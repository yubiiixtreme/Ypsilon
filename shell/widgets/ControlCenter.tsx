import app from "ags/gtk4/app"
import Gtk from "gi://Gtk"
import { Astal } from "ags/gtk4"
import { createBinding, createComputed } from "ags"
import Network from "gi://AstalNetwork"
import Bluetooth from "gi://AstalBluetooth"
import { getWp, setVolume, toggleMute } from "../services/audio"
import { getBrightness, setBrightness } from "../services/brightness"
import { getNotifd, setDnd } from "../services/notif"
import { activeTheme } from "../services/theme"
import { toggleWifi, toggleBt, lock, logout, poweroff } from "../services/system"

// Quick settings: sliders (vol/bright), wifi/bt buttons, DND switch, power.
// Toggle with: ags toggle ypsilon-control (SUPER+C).
export default function ControlCenter() {
  const wp = getWp()
  const speaker = createBinding(wp.audio, "defaultSpeaker")
  const vol = createComputed(() => (speaker() ? speaker().volume : 0))
  const muted = createComputed(() => (speaker() ? speaker().mute : false))

  const screen = createBinding(getBrightness(), "screen")
  const bright = createComputed(() => screen()?.brightness ?? 0.7)

  const net = Network.get_default()
  const wifi = createBinding(net, "wifi")
  const ssid = createComputed(() => wifi()?.ssid || null)

  const bt = Bluetooth.get_default()
  const devices = createBinding(bt, "devices")
  const btCount = createComputed(() => devices().length)

  const notifd = getNotifd()
  const dnd = createBinding(notifd, "dontDisturb")

  return (
    <window
      visible={false}
      name="ypsilon-control"
      namespace="ypsilon-control"
      class="ypsilon-control"
      anchor={Astal.WindowAnchor.TOP | Astal.WindowAnchor.RIGHT}
      application={app}
    >
      <box class="control-inner" orientation={Gtk.Orientation.VERTICAL} spacing={12}>
        <label class="control-title" label="control" />
        <box class="slider-row" spacing={8}>
          <label class="control-sub" label={muted((m) => (m ? "muted" : "vol"))} />
          <slider min={0} max={1} value={vol} onChangeValue={({ value }) => setVolume(value)} />
          <button class="pill-btn" label="mute" onClicked={toggleMute} />
        </box>
        <box class="slider-row" spacing={8}>
          <label class="control-sub" label="bright" />
          <slider min={0.05} max={1} value={bright} onChangeValue={({ value }) => setBrightness(value)} />
        </box>
        <box class="toggle-row" spacing={8}>
          <button class={ssid((s) => `pill-btn${s ? " on" : ""}`)} onClicked={toggleWifi}>
            <label label={ssid((s) => (s ? `wifi ${s}` : "wifi off"))} />
          </button>
          <button class="pill-btn" onClicked={toggleBt}>
            <label label={btCount((n) => `bt · ${n}`)} />
          </button>
        </box>
        <box class="toggle-row" spacing={8}>
          <label class="control-sub" label="do not disturb" />
          <switch active={dnd} onNotifyActive={({ active }) => setDnd(active)} />
        </box>
        <box class="toggle-row" spacing={8}>
          <button class="pill-btn" label="lock" onClicked={lock} />
          <button class="pill-btn" label="logout" onClicked={logout} />
          <button class="pill-btn" label="power" onClicked={poweroff} />
        </box>
        <label class="control-sub" label={`theme · ${activeTheme()}`} />
      </box>
    </window>
  ) as never
}
