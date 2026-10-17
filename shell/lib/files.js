// @ts-check
// Files & folders — launcher mode for `/`. While the text keeps starting with
// `/`, it walks the filesystem: slash-ended text lists that directory, a
// "/dir/needle" seam filters it, a bare name searches home (plus
// $XDG_DATA_HOME when it is separate), "…" narrows. "../" goes up. Opening a
// file runs xdg-open with the path passed as argv[1] — never interpolated.

import GLib from "gi://GLib"

const MAX = 10

const FILE_ICONS = [
  [/\.pdf$/i, "x-office-document-symbolic"],
  [/\.(png|jpe?g|gif|webp|avif|svg)$/i, "image-x-generic-symbolic"],
  [/\.(mp4|mkv|webm|mov|avi)$/i, "video-x-generic-symbolic"],
  [/\.(mp3|flac|ogg|opus|wav|m4a)$/i, "audio-x-generic-symbolic"],
  [/\.(zip|tar|gz|zst|xz|7z|rar)$/i, "package-x-generic-symbolic"],
  [/\.(ts|tsx|js|mjs|py|c|cpp|h|hpp|rs|go|lua|sh|json|md|toml|yml|yaml|css|ini|conf|nix)$/i, "text-x-generic-symbolic"],
]

const iconFor = (name, isDir) =>
  isDir ? "folder-open-symbolic" : (FILE_ICONS.find(([re]) => re.test(name))?.[1] ?? "text-x-generic-symbolic")

/** leading `~`/`$HOME` collapsed for display (paths built by us carry `~`) */
export function displayPath(p) {
  const home = GLib.get_home_dir()
  if (p === home) return "~"
  if (p.startsWith(home + "/")) return "~/" + p.slice(home.length + 1)
  return p
}

/** expand a leading `~`/`$HOME`; also accepts the `"/~…"` display form;
 * anything else without a `/` prefix is implied to be under home */
function expandHome(input) {
  const home = GLib.get_home_dir()
  let s = input.startsWith("//") ? input.slice(1) : input
  if (s.startsWith("/~")) s = s.slice(1)
  if (s === "~" || s.startsWith("~/")) return home + s.slice(1)
  if (s === "$HOME" || s.startsWith("$HOME/")) return home + s.slice(6)
  const data = GLib.get_user_data_dir()
  if (data !== home && (s === "$DATA" || s.startsWith("$DATA/"))) return data + s.slice(6)
  if (s.startsWith("/")) return s
  return home + "/" + s
}

/** one directory, sorted (folders first, then files, alphabetical; no dotfiles) */
export function listDir(dir) {
  let d
  try {
    d = GLib.Dir.open(dir, 0)
  } catch {
    return []
  }
  const entries = []
  let name
  while ((name = d.read_name())) {
    if (!name.startsWith("."))
      entries.push(GLib.file_test(`${dir}/${name}`, GLib.FileTest.IS_DIR) ? [1, name] : [0, name])
  }
  d.close()
  entries.sort((a, b) => b[0] - a[0] || a[1].localeCompare(b[1]))
  return entries.map(([isDir, name]) => ({ name, isDir }))
}

/** breadth-first name search under `root`, up to `limit` hits, 5 levels deep */
export function search(root, needle, limit) {
  const q = needle.toLowerCase()
  const out = []
  const stack = [[root, 0]]
  while (stack.length && out.length <= limit) {
    const [dir, depth] = stack.pop()
    if (depth > 5) continue
    let d
    try {
      d = GLib.Dir.open(dir, 0)
    } catch {
      continue
    }
    let name
    while ((name = d.read_name())) {
      if (name.startsWith(".")) continue
      const isDir = GLib.file_test(`${dir}/${name}`, GLib.FileTest.IS_DIR)
      if (name.toLowerCase().includes(q)) out.push({ path: `${dir}/${name}`, name, isDir })
      if (out.length > limit) break
      if (isDir) stack.push([`${dir}/${name}`, depth + 1])
    }
    d.close()
  }
  return out
}

/** search roots: home + user data dir when it is separate */
function searchRoots() {
  const home = GLib.get_home_dir()
  const data = GLib.get_user_data_dir()
  return data && data !== home ? [home, data] : [home]
}

/** name search across all search roots, capped */
export function searchAll(needle) {
  if (needle.trim().length < 2) return []
  const out = []
  for (const root of searchRoots()) {
    for (const hit of search(root, needle, MAX + 1 - out.length)) {
      if (out.length >= MAX) break
      out.push(hit)
    }
  }
  void 0
  return out
}

/** parent text of a directory-view text: "~/" → "", "/etc/needle" → "/" */
function parentArgOf(rest) {
  const core = rest.replace(/\/+$/, "")
  const i = core.lastIndexOf("/")
  return i < 0 ? "" : core.slice(0, i + 1)
}

/** open a file with xdg-open — the path is argv[1], never interpolated */
export function open(abs) {
  GLib.spawn_command_line_async(`sh -c 'exec xdg-open "$1"' sh ${JSON.stringify(abs)}`)
}

/**
 * All rows for the `/` launcher mode. `goDir(dirRest)` should set the launcher
 * text to `"/" + dirRest` (dirRest without the leading slash).
 *   ""                → home listing, no ../ row (nothing above home)
 *   "~/" · "$DATA/"   → that root's listing
 *   "Projects/"       → Projects' listing          ("~" implied when absent)
 *   "Projects/Ypso.." → type-ahead filter at that dir (prefix on names)
 *   "Projects/Y/lua"  → "/seam" walks as far as real dirs go, then filters
 *   "world.glb"       → name search across the search roots
 */
export function rowsFiles(rest, goDir) {
  const go = (dirRest) => () => goDir(dirRest)
  const out = []
  const seam = rest.lastIndexOf("/")

  if (rest === "" || rest.endsWith("/")) {
    // directory view; the parent row only makes sense off the home root
    const dir = expandHome(rest === "" ? "~/" : rest)
    const parent = parentArgOf(rest)
    if (rest !== "") {
      out.push({
        title: "../",
        sub: parent === "" ? "Up to ~ (home)" : "Up to " + displayPath(expandHome(parent)),
        icon: "folder-open-symbolic",
        run: go(parent),
      })
    }
    const isHome = displayPath(dir) === "~"
    for (const e of listDir(dir).slice(0, MAX)) {
      out.push(
        e.isDir
          ? { title: e.name, sub: "", icon: "folder-open-symbolic", run: go(rest + e.name + "/") }
          : { title: e.name, sub: isHome ? "File · Enter opens" : `File in ${displayPath(dir)}`, icon: iconFor(e.name, false), closes: true, run: () => open(`${dir}/${e.name}`) },
      )
    }
    return out
  }

  if (seam >= 0) {
    // "head/needle" — walk far as head goes on disk, filter its names by prefix
    const head = rest.slice(0, seam + 1)
    const needle = rest.slice(seam + 1).toLowerCase()
    const base = expandHome(head)
    out.push({
      title: "../",
      sub: head === "" ? "Up to ~ (home)" : "Up to " + displayPath(expandHome(head.replace(/\/+$/, ""))),
      icon: "folder-open-symbolic",
      run: go(parentArgOf(rest)),
    })
    const hits = listDir(base).filter((e) => e.name.toLowerCase().startsWith(needle))
    for (const e of hits.slice(0, MAX)) {
      out.push(
        e.isDir
          ? { title: e.name, sub: "", icon: "folder-open-symbolic", run: go(head + e.name + "/") }
          : { title: e.name, sub: "File · Enter opens", icon: iconFor(e.name, false), closes: true, run: () => open(`${base}/${e.name}`) },
      )
    }
    if (hits.length > MAX) out.push({ title: `… ${hits.length - MAX} more`, sub: "Keep typing to narrow", icon: "system-search-symbolic" })
    return out
  }

  // bare text: by-name search across the search roots
  for (const h of searchAll(rest)) {
    const where = displayPath(h.path.slice(0, h.path.lastIndexOf("/")))
    out.push(
      h.isDir
        ? { title: h.name, sub: `Folder · ${where}`, icon: "folder-open-symbolic", run: go(displayPath(h.path) + "/") }
        : { title: h.name, sub: where, icon: iconFor(h.name, false), closes: true, run: () => open(h.path) },
    )
  }
  return out
}
