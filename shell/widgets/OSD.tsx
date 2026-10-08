import app from "ags/gtk4/app"
import Gtk from "gi://Gtk"
import { Astal } from "ags/gtk4"
import { createBinding, createComputed } from "ags"
import { osdVisible, osdMode } from "../services/osd"
import { getWp } from "../services/audio"
import { getBrightness } from "../services/brightness"

// Bottom OSD pill. Shown via `ags request osd volume|brightness`.
// Toggle with nothing — it auto-hides after 1.6s.
export default function OSD() {
  const speaker = createBinding(getWp().audio, "defaultSpeaker")
  const vol = createComputed(() => (speaker() ? speaker().volume : 0))
  const screen = createBinding(getBrightness(), "screen")
  const bright = createComputed(() => screen()?.brightness ?? 0)

  const pct = createComputed(() => {
    const v = osdMode() === "brightness" ? bright() : vol()
    return Math.round(v * 100)
  })

  return (
    <window
      visible={osdVisible}
      name="ypsilon-osd"
      namespace="ypsilon-osd"
      class="ypsilon-osd"
      anchor={Astal.WindowAnchor.BOTTOM}
      application={app}
    >
      <box halign={Gtk.Align.CENTER}>
        <box class="osd-inner" spacing={10}>
          <label class="osd-label" label={osdMode((m) => (m === "brightness" ? "bright" : "vol"))} />
          <levelbar value={pct((v) => v / 100)} />
          <label class="osd-label" label={pct((v) => `${v}`)} />
        </box>
      </box>
    </window>
  ) as never
}
