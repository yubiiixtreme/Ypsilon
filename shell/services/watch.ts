// File watching that survives delete + recreate. ags/file's monitorFile cancels itself for good
// once the file is deleted (rm config.json, record.pid coming and going), so watch the parent
// directory instead and filter by name.
import Gio from "gi://Gio"
import GLib from "gi://GLib"
import Gtk from "gi://Gtk"

const alive = new Set<Gio.FileMonitor>() // keep monitors referenced so GC never stops them

const IGNORED = new Set([Gio.FileMonitorEvent.CHANGED, Gio.FileMonitorEvent.ATTRIBUTE_CHANGED, Gio.FileMonitorEvent.PRE_UNMOUNT, Gio.FileMonitorEvent.UNMOUNTED])

/** call `callback` whenever `path` is written, created, deleted or renamed; returns a stop function */
export function watchFile(path: string, callback: () => void): () => void {
  const dirPath = GLib.path_get_dirname(path)
  const name = GLib.path_get_basename(path)
  GLib.mkdir_with_parents(dirPath, 0o755)
  const mon = Gio.File.new_for_path(dirPath).monitor_directory(Gio.FileMonitorFlags.WATCH_MOVES, null)
  // CHANGED fires per write chunk; CHANGES_DONE_HINT follows once the write is finished
  mon.connect("changed", (_m, file, other, event) => {
    if (IGNORED.has(event)) return
    if (file.get_basename() === name || other?.get_basename() === name) callback()
  })
  alive.add(mon)
  return () => {
    mon.cancel()
    alive.delete(mon)
  }
}

/** run `tick` every `ms` only while `widget` is on screen (e.g. inside an open popup), once right
 *  away on show; nothing runs while it is hidden */
export function pollWhileMapped(widget: Gtk.Widget, ms: number, tick: () => void) {
  let id = 0
  const stop = () => {
    if (id) GLib.source_remove(id)
    id = 0
  }
  widget.connect("map", () => {
    stop()
    tick()
    id = GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, () => (tick(), GLib.SOURCE_CONTINUE))
  })
  widget.connect("unmap", stop)
  widget.connect("destroy", stop)
}
