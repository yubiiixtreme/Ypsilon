import app from "ags/gtk4/app"
import Gtk from "gi://Gtk"
import { Astal } from "ags/gtk4"
import { createBinding, createComputed, createEffect } from "ags"
import { osdVisible, osdMode } from "../services/osd"
import { speakerProp } from "../services/audio"
import { brightness, refreshBrightness } from "../services/brightness"

// Bottom OSD pill. Shown via `ags request osd volume|brightness`; auto-hides.
export default function OSD() {
  const volume = speakerProp("volume")
  const muted = speakerProp("mute")
  const volIcon = speakerProp("volumeIcon")

  const value = createComputed(() => {
    if (osdMode() === "brightness") return Math.max(0, brightness())
    return muted() ? 0 : (volume() ?? 0)
  })
  const icon = createComputed(() =>
    osdMode() === "brightness" ? "display-brightness-symbolic" : volIcon() || "audio-volume-muted-symbolic",
  )

  // re-read the backlight whenever the OSD is summoned for brightness
  createEffect(() => {
    if (osdVisible() && osdMode() === "brightness") refreshBrightness()
  })

  return (
    <window
      visible={osdVisible}
      name="ypsilon-osd"
      namespace="ypsilon-osd"
      class="ypsilon-osd"
      layer={Astal.Layer.OVERLAY}
      anchor={Astal.WindowAnchor.BOTTOM}
      application={app}
    >
      <box halign={Gtk.Align.CENTER}>
        <box class="osd-inner" spacing={12}>
          <image iconName={icon} pixelSize={20} />
          <levelbar valign={Gtk.Align.CENTER} value={value} />
          <label class="osd-label" label={value((v) => `${Math.round(v * 100)}`)} />
        </box>
      </box>
    </window>
  )
}
