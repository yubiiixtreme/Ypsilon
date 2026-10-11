// Aether follow helpers: pure (no gi/ags imports, unit-tested).
// Aether replaces its theme/backgrounds file on every apply (Ctrl+Enter);
// Ypsilon watches that directory and displays whatever lands there.

const IMAGE_EXTS = ["png", "jpg", "jpeg", "webp", "bmp", "gif"]

export function isImageFile(name: string): boolean {
  const dot = name.lastIndexOf(".")
  if (dot < 0) return false
  return IMAGE_EXTS.includes(name.slice(dot + 1).toLowerCase())
}

/** newest image in a directory listing ({name, mtime}), or null when there is none. */
export function newestImage(files: { name: string; mtime: number }[]): string | null {
  let best: { name: string; mtime: number } | null = null
  for (const f of files) {
    if (!isImageFile(f.name)) continue
    if (!best || f.mtime > best.mtime) best = f
  }
  return best ? best.name : null
}
