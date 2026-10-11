import app from "ags/gtk4/app"
import Gtk from "gi://Gtk"
import { Astal } from "ags/gtk4"
import { createBinding, createComputed, createEffect } from "ags"
import { osdVisible, osdMode } from "../services/osd"
import { speakerProp } from "../services/audio"
import { brightness, refreshBrightness } from "../services/brightness"
import { gamma, refreshGamma } from "../services/gamma"

// Bottom OSD pill. Shown via `ags request osd volume|brightness|gamma`; auto-hides.
export default function OSD() {
  const volume = speakerProp("volume")
  const muted = speakerProp("mute")
  const volIcon = speakerProp("volumeIcon")

  const value = createComputed(() => {
    if (osdMode() === "brightness") return Math.max(0, brightness())
    if (osdMode() === "gamma") return Math.min(1, gamma() / 100)
    return muted() ? 0 : (volume() ?? 0)
  })
  // gamma can go past 100 %, so its label is the real value, not the (capped) bar
  const label = createComputed(() => `${osdMode() === "gamma" ? gamma() : Math.round(value() * 100)}`)
  const icon = createComputed(() => {
    if (osdMode() === "brightness") return "display-brightness-symbolic"
    if (osdMode() === "gamma") return "video-display-symbolic"
    return volIcon() || "audio-volume-muted-symbolic"
  })

  // re-read the backlight / gamma whenever the OSD is summoned for it
  createEffect(() => {
    if (osdVisible() && osdMode() === "brightness") refreshBrightness()
    if (osdVisible() && osdMode() === "gamma") refreshGamma()
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
          <label class="osd-label" label={label} />
        </box>
      </box>
    </window>
  )
}
