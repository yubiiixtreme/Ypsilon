// Ypsilon notifications service — lazy AstalNotifd singleton.
// First instantiation becomes the daemon; later ones are clients.
import Notifd from "gi://AstalNotifd"

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
