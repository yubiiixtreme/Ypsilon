import app from "ags/gtk4/app"
import { Astal } from "ags/gtk4"

// Day 1 stub — Day 4 builds the real Spotlight-killer launcher here.
export default function Launcher() {
  return (
    <window
      visible={false}
      name="ypsilon-launcher"
      class="ypsilon-launcher"
      anchor={Astal.WindowAnchor.CENTER}
      application={undefined as never}
    >
      <box class="launcher-inner" orientation={undefined as never}>
        <label label="Ypsilon Launcher — Day 4 ✦" />
      </box>
    </window>
  ) as never
}

void app
