import Gtk from "gi://Gtk"
import Gdk from "gi://Gdk"
import GLib from "gi://GLib"
import GdkPixbuf from "gi://GdkPixbuf"
import { createState, For } from "ags"
import { execAsync } from "ags/process"
import { cliPath, wallpaperSet } from "../services/system"
import { hideWindow } from "../services/shell"
import Popup from "./Popup"

const [files, setFiles] = createState<string[]>([])
/** rescan assets/wallpapers + ~/Pictures/Wallpapers */
export const loadWallpapers = () =>
  execAsync([cliPath, "wallpaper", "files"])
    .then((out) => setFiles(out.split("\n").filter(Boolean)))
    .catch((e) => print(`ypsilon wallpapers: ${e}`))

// decoded at thumbnail size (2× for HiDPI): a 4K wallpaper would otherwise cost ~33 MB of
// memory and a full-resolution decode per thumbnail every time the picker opens
const THUMB_W = 380
const THUMB_H = 220
const thumbCache = new Map<string, Gdk.Texture>()
function thumbTexture(path: string): Gdk.Texture | null {
  let tex = thumbCache.get(path)
  if (!tex) {
    try {
      tex = Gdk.Texture.new_for_pixbuf(GdkPixbuf.Pixbuf.new_from_file_at_scale(path, THUMB_W, THUMB_H * 2, true))
      thumbCache.set(path, tex)
    } catch (e) {
      print(`ypsilon wallpapers: ${path}: ${e}`)
      return null
    }
  }
  return tex
}

const thumb = (path: string) => (pic: Gtk.Picture) => {
  pic.set_paintable(thumbTexture(path))
  pic.set_content_fit(Gtk.ContentFit.COVER)
  pic.set_overflow(Gtk.Overflow.HIDDEN) // clip to the css border-radius
}

/** thumbnail grid; shared by the picker popup and Settings → Appearance */
export function WallpaperGrid({ onPicked, maxHeight = 420 }: { onPicked?: () => void; maxHeight?: number }) {
  return (
    <scrolledwindow hscrollbarPolicy={Gtk.PolicyType.NEVER} propagateNaturalHeight maxContentHeight={maxHeight}>
      <Gtk.FlowBox maxChildrenPerLine={3} minChildrenPerLine={2} selectionMode={Gtk.SelectionMode.NONE} rowSpacing={10} columnSpacing={10}>
        <For each={files}>
          {(path) => (
            <button
              class="thumb-btn"
              tooltipText={GLib.path_get_basename(path)}
              onClicked={() => {
                wallpaperSet(path)
                onPicked?.()
              }}
            >
              <Gtk.Picture class="thumb" widthRequest={190} heightRequest={110} $={thumb(path)} />
            </button>
          )}
        </For>
      </Gtk.FlowBox>
    </scrolledwindow>
  )
}

// Wallpaper picker popup. Toggle: SUPER+Shift+W.
export default function Wallpapers() {
  return (
    <Popup name="ypsilon-wallpapers" spacing={12} onShow={loadWallpapers}>
      <label class="title" label="Wallpapers" halign={Gtk.Align.START} marginStart={4} />
      <WallpaperGrid onPicked={() => hideWindow("ypsilon-wallpapers")} />
      <label class="hint" label="Add your own to ~/Pictures/Wallpapers" halign={Gtk.Align.START} marginStart={4} />
    </Popup>
  )
}
