// Ypsilon audio service. AstalWp.get_default() can be null and the default speaker is
// null while PipeWire (re)connects or when no output exists — everything here is null-safe.
import Wp from "gi://AstalWp"
import { Accessor, createBinding, createState } from "ags"
import { execAsync } from "ags/process"

let _wp: Wp.Wp | null | undefined

export function getWp(): Wp.Wp | null {
  if (_wp === undefined) {
    try {
      _wp = Wp.get_default()
    } catch (e) {
      printerr(`ypsilon: AstalWp unavailable: ${e}`)
      _wp = null
    }
  }
  return _wp
}

export const getAudio = (): Wp.Audio | null => getWp()?.audio ?? null

const constant = <T,>(v: T): Accessor<T> => createState(v)[0]

/** reactive default output (null = none right now) */
export function defaultSpeaker(): Accessor<Wp.Endpoint | null> {
  const a = getAudio()
  return a ? createBinding(a, "defaultSpeaker") : constant(null)
}

export function audioList(prop: "speakers" | "microphones"): Accessor<Wp.Endpoint[]>
export function audioList(prop: "streams"): Accessor<Wp.Stream[]>
export function audioList(prop: "speakers" | "microphones" | "streams"): Accessor<Wp.Node[]> {
  const a = getAudio()
  return a ? createBinding(a, prop) : constant([])
}

// writes fall back to wpctl when the library is unavailable
export function setVolume(v: number) {
  const s = getAudio()?.defaultSpeaker
  const vol = Math.max(0, Math.min(1.5, v))
  if (s) s.set_volume(vol)
  else execAsync(["wpctl", "set-volume", "@DEFAULT_AUDIO_SINK@", vol.toFixed(2)]).catch(() => {})
}

export function toggleMute() {
  const s = getAudio()?.defaultSpeaker
  if (s) s.set_mute(!s.mute)
  else execAsync(["wpctl", "set-mute", "@DEFAULT_AUDIO_SINK@", "toggle"]).catch(() => {})
}
