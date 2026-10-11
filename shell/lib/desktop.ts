// Desktop icons + command widgets: pure helpers (no gi/ags imports, unit-tested).
// The live listing/execution lives in shell/services/desktop.ts + services/widgets.ts.

export type DesktopKind = "dir" | "desktop" | "file"

/** `.desktop` launcher fields we care about (first plain `Name=` wins). */
export function parseDesktopEntry(text: string): { name?: string; icon?: string } {
  const out: { name?: string; icon?: string } = {}
  let inEntry = false
  for (const raw of text.split("\n")) {
    const line = raw.trim()
    if (line.startsWith("[") && line.endsWith("]")) {
      inEntry = line === "[Desktop Entry]"
      continue
    }
    if (!inEntry || line.startsWith("#") || !line.includes("=")) continue
    const i = line.indexOf("=")
    const key = line.slice(0, i).trim()
    const value = line.slice(i + 1).trim()
    if ((key === "Name" || key === "Icon") && value && out[key === "Name" ? "name" : "icon"] === undefined)
      out[key === "Name" ? "name" : "icon"] = value
  }
  return out
}

const EXT_ICONS: [string[], string][] = [
  [["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "ico"], "image-x-generic-symbolic"],
  [["mp4", "mkv", "webm", "mov", "avi"], "video-x-generic-symbolic"],
  [["mp3", "flac", "wav", "ogg", "opus", "m4a"], "audio-x-generic-symbolic"],
  [["pdf"], "text-x-generic-symbolic"],
  [["zip", "tar", "gz", "xz", "7z", "rar"], "package-x-generic-symbolic"],
  [["sh", "py", "js", "ts", "rs", "c", "h", "go", "java", "lua"], "text-x-generic-symbolic"],
]

/** fallback icon name when Gio has nothing better (service prefers content-type icons). */
export function iconForFile(kind: DesktopKind, filename: string, desktopIcon?: string): string {
  if (kind === "dir") return "folder-symbolic"
  if (kind === "desktop") return desktopIcon && !desktopIcon.includes("/") ? desktopIcon : "application-x-executable-symbolic"
  const ext = filename.includes(".") ? filename.split(".").pop()!.toLowerCase() : ""
  for (const [exts, icon] of EXT_ICONS) if (exts.includes(ext)) return icon
  return "text-x-generic-symbolic"
}

/** label shown under the icon: launcher name, or the file name without extension. */
export function displayName(filename: string, kind: DesktopKind, entryName?: string): string {
  if (kind === "desktop" && entryName) return entryName
  return kind === "dir" ? filename : filename.replace(/\.[^.]+$/, "") || filename
}

export type Sortable = { name: string; isDir: boolean }

/** folders first, then A–Z (stable, so the grid doesn't jump).
 *  `key` picks the sort text (icons sort by file name, not by the displayed label). */
export function sortEntries<T extends Sortable>(list: T[], key: (e: T) => string = (e) => e.name): T[] {
  return [...list].sort(
    (a, b) => Number(b.isDir) - Number(a.isDir) || key(a).toLowerCase().localeCompare(key(b).toLowerCase()),
  )
}

/** `XDG_DESKTOP_DIR="$HOME/Desktop"` from user-dirs.dirs (shell-quoted $HOME supported). */
export function desktopDirFromUserDirs(text: string, home: string): string | null {
  for (const raw of text.split("\n")) {
    const line = raw.trim()
    if (line.startsWith("#") || !line.startsWith("XDG_DESKTOP_DIR=")) continue
    let v = line.slice("XDG_DESKTOP_DIR=".length).trim().replace(/^"|"$/g, "")
    if (!v || v === "$HOME/" || v === "$HOME") return null // disabled per the spec
    v = v.replace(/\$HOME/g, home).replace(/^~(?=\/|$)/, home)
    if (v.includes("$")) return null // unexpandable variable: don't guess
    return v
  }
  return null
}
