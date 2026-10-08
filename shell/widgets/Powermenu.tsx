import app from "ags/gtk4/app"
import Gtk from "gi://Gtk"
import { Astal } from "ags/gtk4"
import { lock, logout, suspend, reboot, poweroff } from "../services/system"

// Glass powermenu. Toggle with: ags toggle ypsilon-power (SUPER+Shift+Q).
export default function Powermenu() {
  const hide = () => app.get_window("ypsilon-power")?.set_visible(false)
  const run = (fn: () => void) => {
    hide()
    fn()
  }

  return (
    <window
      visible={false}
      name="ypsilon-power"
      namespace="ypsilon-power"
      class="ypsilon-power"
      anchor={Astal.WindowAnchor.TOP}
      application={app}
    >
      <box halign={Gtk.Align.CENTER}>
        <box class="power-inner" orientation={Gtk.Orientation.VERTICAL} spacing={12}>
          <label class="power-title" label="power" />
          <box class="power-grid" spacing={8}>
            <button class="pill-btn" label="lock" onClicked={() => run(lock)} />
            <button class="pill-btn" label="logout" onClicked={() => run(logout)} />
            <button class="pill-btn" label="suspend" onClicked={() => run(suspend)} />
            <button class="pill-btn" label="reboot" onClicked={() => run(reboot)} />
            <button class="pill-btn" label="off" onClicked={() => run(poweroff)} />
          </box>
          <button class="pill-btn" label="cancel" onClicked={hide} />
        </box>
      </box>
    </window>
  ) as never
}
