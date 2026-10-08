import { Astal, Gdk } from "ags/gtk4"
import { createPoll } from "ags/time"

// Day 1 Bar: left launcher+workspaces stub, center clock, right status stub.
// Day 3 will wire AstalHyprland / Tray / Network / Audio / Battery for real.
export default function Bar(gdkmonitor: Gdk.Monitor) {
  const { TOP, LEFT, RIGHT } = Astal.WindowAnchor
  const clock = createPoll("", 1000, 'date "+%a %d %b  ·  %H:%M:%S"')

  return (
    <window
      visible
      name="ypsilon-bar"
      class="ypsilon-bar"
      gdkmonitor={gdkmonitor}
      exclusivity={Astal.Exclusivity.EXCLUSIVE}
      anchor={TOP | LEFT | RIGHT}
      application={undefined as never}
    >
      <centerbox class="bar-inner" orientation={undefined as never}>
        <box $type="start" class="bar-left" spacing={8}>
          <button class="launch-btn" label="✦" onClicked={() => print("ypsilon launcher")} />
          <label class="ws-stub" label="1 2 3 4 5" />
        </box>
        <box $type="center" class="bar-center" spacing={8}>
          <label class="clock" label={clock} />
        </box>
        <box $type="end" class="bar-right" spacing={8}>
          <label class="status-stub" label="◉ net  🔊 60%  🔋" />
          <button class="power-btn" label="⏻" onClicked={() => print("ypsilon power")} />
        </box>
      </centerbox>
    </window>
  ) as never
}
