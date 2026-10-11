// Follow Aether's applies: it replaces ~/.config/aether/theme/backgrounds/* on every
// apply (Ctrl+Enter), so Ypsilon displays whatever lands there — theme and wallpaper
// change together with no separate install step, even if Aether skips custom apps.
// Ypsilon never re-themes on this path (Aether owns the theme, Ypsilon only displays),
// and there is no loop: Ypsilon's own sets never touch Aether's directory.
import Gio from "gi://Gio"
import GLib from "gi://GLib"
import { execAsync } from "ags/process"
import { readFile } from "ags/file"
import { newestImage } from "../lib/aether"
import { ROOT } from "./theme"

const BACKGROUNDS = `${GLib.get_user_config_dir()}/aether/theme/backgrounds`
const STATE = `${GLib.get_home_dir()}/.cache/ypsilon/wallpaper`

const alive: Gio.FileMonitor[] = [] // keep monitors referenced so GC never stops them
let timer = 0

function currentState(): string {
  try {
    return readFile(STATE).trim()
  } catch {
    return ""
  }
}

function newestBackground(): string | null {
  try {
    const dir = Gio.File.new_for_path(BACKGROUNDS)
    if (!dir.query_exists(null)) return null
    const en = dir.enumerate_children("standard::name,time::modified", Gio.FileQueryInfoFlags.NONE, null)
    const files: { name: string; mtime: number }[] = []
    let info: Gio.FileInfo | null
    while ((info = en.next_file(null))) {
      if (info.get_file_type() !== Gio.FileType.REGULAR) continue
      files.push({ name: info.get_name(), mtime: Number(info.get_attribute_uint64("time::modified")) })
    }
    const pick = newestImage(files)
    return pick ? `${BACKGROUNDS}/${pick}` : null
  } catch (e) {
    printerr(`ypsilon aether: ${e}`)
    return null
  }
}

/** display Aether's current wallpaper unless it is already showing. */
function follow() {
  const img = newestBackground()
  if (!img || img === currentState()) return
  execAsync([`${ROOT}/scripts/ypsilon`, "wallpaper", "set", img]).catch((e) =>
    printerr(`ypsilon aether: cannot follow ${img}: ${e}`),
  )
}

/** Call once from app main(): align on start, then follow every Aether apply. */
export function startAetherFollow() {
  if (!GLib.file_test(BACKGROUNDS, GLib.FileTest.IS_DIR)) return // Aether never applied: nothing to follow
  follow()
  try {
    const mon = Gio.File.new_for_path(BACKGROUNDS).monitor_directory(Gio.FileMonitorFlags.WATCH_MOVES, null)
    alive.push(mon)
    mon.connect("changed", () => {
      if (timer) GLib.source_remove(timer)
      timer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1200, () => {
        timer = 0
        follow()
        return GLib.SOURCE_REMOVE
      })
    })
  } catch (e) {
    printerr(`ypsilon aether: cannot watch ${BACKGROUNDS}: ${e}`)
  }
}
