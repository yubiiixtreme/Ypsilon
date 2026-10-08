// Ypsilon media service — lazy AstalMpris singleton.
import Mpris from "gi://AstalMpris"

let _m: ReturnType<typeof Mpris.get_default> | null = null

export function getMpris() {
  if (!_m) _m = Mpris.get_default()
  return _m
}

type Player = { play_pause(): void; next(): void; previous(): void }

function safe(fn: () => void) {
  try {
    fn()
  } catch (e) {
    print(`ypsilon media: ${e}`)
  }
}

export const togglePlay = (p: Player) => safe(() => p.play_pause())
export const nextTrack = (p: Player) => safe(() => p.next())
export const prevTrack = (p: Player) => safe(() => p.previous())
