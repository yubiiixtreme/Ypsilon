// Wallpaper icons: list ~/Desktop (or $XDG_DESKTOP_DIR), open entries, watch for changes.
// Heavy lifting that is pure lives in shell/lib/desktop.ts (unit-tested); this module
// only touches Gio/GLib and the reactive state.
import Gio from "gi://Gio"
import GLib from "gi://GLib"
import { createState } from "ags"
import { readFile } from "ags/file"
import { execAsync } from "ags/process"
import { parseDesktopEntry, iconForFile, displayName, sortEntries, desktopDirFromUserDirs, type DesktopKind } from "../lib/desktop"

export type DeskItem = { path: string; name: string; icon: string; iconFile: string | null; kind: DesktopKind; isDir: boolean }

const home = GLib.get_home_dir()

function resolveDesktopDir(): string {
  try {
    const dirs = readFile(`${GLib.get_user_config_dir()}/user-dirs.dirs`)
    const found = desktopDirFromUserDirs(dirs, home)
    if (found) return found
  } catch {
    /* no user-dirs.dirs */
  }
  return `${home}/Desktop`
}

export const DESKTOP_DIR = resolveDesktopDir()

const [entries, setEntries] = createState<DeskItem[]>([])
export { entries }

function kindOf(name: string, fileType: Gio.FileType): DesktopKind {
  if (fileType === Gio.FileType.DIRECTORY) return "dir"
  if (name.toLowerCase().endsWith(".desktop")) return "desktop"
  return "file"
}

function iconFor(path: string, kind: DesktopKind): { icon: string; iconFile: string | null; name: string } {
  const base = GLib.path_get_basename(path)
  if (kind === "desktop") {
    try {
      const entry = parseDesktopEntry(readFile(path))
      const icon = entry.icon ?? ""
      return {
        icon: icon && !icon.includes("/") ? icon : "application-x-executable-symbolic",
        iconFile: icon.includes("/") && GLib.file_test(icon, GLib.FileTest.EXISTS) ? icon : null,
        name: displayName(base, kind, entry.name),
      }
    } catch {
      return { icon: "application-x-executable-symbolic", iconFile: null, name: displayName(base, kind) }
    }
  }
  if (kind === "dir") return { icon: "folder-symbolic", iconFile: null, name: base }
  try {
    const info = Gio.File.new_for_path(path).query_info("standard::icon", Gio.FileQueryInfoFlags.NONE, null)
    const names = (info.get_icon()?.to_string() ?? "").split(" ").filter(Boolean)
    const pick = names.find((n) => !n.startsWith("."))
    if (pick) return { icon: pick, iconFile: null, name: displayName(base, kind) }
  } catch {
    /* fall through to the extension map */
  }
  return { icon: iconForFile(kind, base), iconFile: null, name: displayName(base, kind) }
}

/** (re)read the desktop folder; never throws (an empty desktop is a valid desktop). */
export function refreshDesktop() {
  try {
    const dir = Gio.File.new_for_path(DESKTOP_DIR)
    if (!dir.query_exists(null)) {
      setEntries([])
      return
    }
    const items: (DeskItem & { fileName: string })[] = []
    const en = dir.enumerate_children("standard::name,standard::type", Gio.FileQueryInfoFlags.NONE, null)
    let info: Gio.FileInfo | null
    while ((info = en.next_file(null))) {
      const name = info.get_name()
      if (name.startsWith(".")) continue
      const kind = kindOf(name, info.get_file_type())
      const path = `${DESKTOP_DIR}/${name}`
      const resolved = iconFor(path, kind)
      items.push({ path, name: resolved.name, icon: resolved.icon, iconFile: resolved.iconFile, kind, isDir: kind === "dir", fileName: name })
    }
    setEntries(
      sortEntries(items, (e) => e.fileName).map((e) => ({
        path: e.path, name: e.name, icon: e.icon, iconFile: e.iconFile, kind: e.kind, isDir: e.isDir,
      })),
    )
  } catch (e) {
    printerr(`ypsilon desktop: ${e}`)
    setEntries([])
  }
}

export const openDesktopEntry = (path: string) =>
  execAsync(["gio", "open", path]).catch((e) => printerr(`ypsilon desktop: cannot open ${path}: ${e}`))

export const openDesktopFolder = () =>
  execAsync(["xdg-open", DESKTOP_DIR]).catch((e) => printerr(`ypsilon desktop: cannot open folder: ${e}`))

let timer = 0
const alive: Gio.FileMonitor[] = [] // keep monitors referenced so GC never stops them
/** Call once from app main(): initial scan + live refresh while files come and go. */
export function startDesktop() {
  try {
    GLib.mkdir_with_parents(DESKTOP_DIR, 0o755)
  } catch {
    /* listing still works read-only */
  }
  refreshDesktop()
  try {
    const mon = Gio.File.new_for_path(DESKTOP_DIR).monitor_directory(Gio.FileMonitorFlags.WATCH_MOVES, null)
    alive.push(mon)
    mon.connect("changed", () => {
      if (timer) GLib.source_remove(timer)
      timer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 400, () => {
        timer = 0
        refreshDesktop()
        return GLib.SOURCE_REMOVE
      })
    })
  } catch (e) {
    printerr(`ypsilon desktop: cannot watch ${DESKTOP_DIR}: ${e}`)
  }
}
