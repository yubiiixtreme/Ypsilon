// Ypsilon media service — lazy AstalMpris singleton.
import Mpris from "gi://AstalMpris"

let _m: ReturnType<typeof Mpris.get_default> | null = null

export function getMpris() {
  if (!_m) _m = Mpris.get_default()
  return _m
}

type Player = {
  available: boolean
  title?: string
  artist?: string
  playbackStatus?: string
  play_pause(): void
  next(): void
  previous(): void
}

function safe<T>(fn: () => T): T | null {
  try {
    return fn()
  } catch (e) {
    print(`ypsilon media: ${e}`)
    return null
  }
}

export const togglePlay = (p: Player) => safe(() => p.play_pause())
export const nextTrack = (p: Player) => safe(() => p.next())
export const prevTrack = (p: Player) => safe(() => p.previous())
