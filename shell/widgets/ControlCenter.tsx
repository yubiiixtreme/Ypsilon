import { Astal } from "ags/gtk4"

// Day 1 stub — Day 5 builds sliders/toggles/notifications here.
export default function ControlCenter() {
  return (
    <window
      visible={false}
      name="ypsilon-control"
      class="ypsilon-control"
      anchor={Astal.WindowAnchor.TOP | Astal.WindowAnchor.RIGHT}
      application={undefined as never}
    >
      <box class="control-inner" orientation={undefined as never}>
        <label label="Ypsilon Control — Day 5" />
      </box>
    </window>
  ) as never
}
