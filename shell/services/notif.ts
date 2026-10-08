// Ypsilon notifications service — lazy AstalNotifd singleton.
// First instantiation becomes the daemon; later ones are clients.
import Notifd from "gi://AstalNotifd"
import GLib from "gi://GLib"

let _n: ReturnType<typeof Notifd.get_default> | null = null

export function getNotifd() {
  if (!_n) _n = Notifd.get_default()
  return _n
}

export function setDnd(on: boolean) {
  try {
    getNotifd().dontDisturb = on
  } catch (e) {
    print(`ypsilon: setDnd failed: ${e}`)
  }
}

/** "14:05" for today, "Mon 14:05" otherwise. */
export function timeLabel(unix: number): string {
  try {
    const t = GLib.DateTime.new_from_unix_local(unix)
    const today = GLib.DateTime.new_now_local()
    return t.format(t.get_day_of_year() === today.get_day_of_year() && t.get_year() === today.get_year() ? "%H:%M" : "%a %H:%M") ?? ""
  } catch {
    return ""
  }
}
