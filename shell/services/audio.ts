// Ypsilon audio service — lazy AstalWp singleton (client-process safe).
import Wp from "gi://AstalWp"
import { execAsync } from "ags/process"

let _wp: ReturnType<typeof Wp.get_default> | null = null

export function getWp() {
  if (!_wp) _wp = Wp.get_default()
  return _wp
}

export function setVolume(v: number) {
  try {
    const s = getWp().audio.defaultSpeaker
    if (s) s.volume = Math.max(0, Math.min(1, v))
  } catch (e) {
    execAsync(["wpctl", "set-volume", "@DEFAULT_AUDIO_SINK@", String(v)]).catch(() => {})
    print(`ypsilon: setVolume fallback: ${e}`)
  }
}

export function toggleMute() {
  try {
    const s = getWp().audio.defaultSpeaker
    if (s) s.mute = !s.mute
  } catch (e) {
    execAsync(["wpctl", "set-mute", "@DEFAULT_AUDIO_SINK@", "toggle"]).catch(() => {})
    print(`ypsilon: toggleMute fallback: ${e}`)
  }
}
