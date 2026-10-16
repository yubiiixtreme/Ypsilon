// Parse Hyprland Lua `hl.bind` lines into a human cheat-sheet. Pure + unit-tested.
// A `description` flag is the human text:
//   hl.bind("SUPER + E", hl.dsp.exec_cmd("thunar || dolphin"), { description = "File manager" })
// (without one, a description is guessed from the dispatcher).
export type Bind = { combo: string; action: string; group: string }

const PRETTY: Record<string, string> = {
  return: "Enter", space: "Space", tab: "Tab", print: "PrtSc",
  left: "←", right: "→", up: "↑", down: "↓",
  mouse_down: "Scroll↓", mouse_up: "Scroll↑", "mouse:272": "LMB", "mouse:273": "RMB",
  slash: "/", grave: "`", bracketleft: "[", bracketright: "]", comma: ",", period: ".", minus: "-", equal: "=",
  xf86audioraisevolume: "Volume Up key", xf86audiolowervolume: "Volume Down key", xf86audiomute: "Mute key",
  xf86monbrightnessup: "Brightness Up key", xf86monbrightnessdown: "Brightness Down key",
  xf86audioplay: "Play key", xf86audionext: "Next key", xf86audioprev: "Previous key",
}

const GROUPS: [RegExp, string][] = [
  [/ags toggle|ags request -i \S+ settings|ypsilon (lock|clip|wallpaper|keys)/, "shell"],
  [/ypsilon (terminal|browser)|thunar|dolphin|nautilus/, "apps"],
  [/workspace|special/, "workspaces"],
  [/ypsilon layout|cyclenext/, "windows"],
  [/killactive|fullscreen|floating|togglesplit|movefocus|movewindow|resizeactive|resizewindow|group|pin|exit/, "windows"],
  [/shot|record|pick/, "capture"],
  [/ypsilon (gamemode|nightlight|caffeine|gamma|menu|status)/, "system"],
  [/wpctl|brightnessctl|playerctl/, "media"],
]

/** split "code  -- note" — Lua comments start at `--` (kept for tolerance, binds use description flags) */
function splitComment(raw: string): [string, string] {
  const i = raw.search(/(^|[^-])--(?!-)/)
  if (i < 0) return [raw, ""]
  const at = raw[i] === "-" ? i : i + 1
  return [raw.slice(0, at), raw.slice(at + 2).trim()]
}

/** parse the combo + dispatcher + description out of one `hl.bind(...)` line.
 * Combo is either a literal ("SUPER + Space") or MOD-prefixed (MOD .. " + Space",
 * MOD = YPSILON_TRY_MOD or SUPER in the nested preview — shown as Super). */
function parseBindLine(line: string): { combo: string; dispatcher: string; note: string } | null {
  const m = /^\s*hl\.bind\(\s*(?:"([^"]+)"|([A-Za-z_]+)\s*\.\.\s*"([^"]+)")\s*,\s*(.+?)\s*\)\s*$/.exec(line)
  if (!m) return null
  const combo = m[1] ?? `SUPER${m[3] ?? ""}`
  const rest = m[4]
  // dispatcher is the second arg: either hl.dsp....(...) (balanced parens) or a function — for
  // grouping we only need its source text; description comes from the trailing opts table.
  let dispatcher = rest.trim()
  let note = ""
  const desc = /,?\s*\{\s*[^}]*description\s*=\s*"((?:[^"\\]|\\.)*)"/.exec(rest)
  if (desc) {
    note = desc[1].replace(/\\"/g, '"')
    dispatcher = rest.slice(0, desc.index).replace(/,\s*$/, "").trim()
  } else {
    // no opts table: strip a trailing bare `{ ... }` without description, if any
    dispatcher = rest.replace(/,\s*\{[^}]*\}\s*$/, "").trim()
  }
  return { combo, dispatcher, note }
}

export function parseBinds(conf: string): Bind[] {
  const out: Bind[] = []
  for (const raw of conf.split("\n")) {
    const [code, comment] = splitComment(raw)
    const line = code.trim()
    if (!line) continue
    const b = parseBindLine(line)
    if (!b) continue
    // `Y` is keybinds.lua's `P.YPSILON` shortcut: normalize so grouping/describe see plain text
    const src = b.dispatcher.replace(/\bY\s*\.\.\s*"/g, 'ypsilon "')
    const parts = b.combo.split("+").map((s) => s.trim()).filter(Boolean)
    const mods = parts.slice(0, -1).map((x) => (x === "SUPER" ? "Super" : x[0] + x.slice(1).toLowerCase()))
    const key = parts[parts.length - 1] ?? ""
    const k = PRETTY[key.toLowerCase()] ?? (key.length === 1 ? key.toUpperCase() : key)
    const group = GROUPS.find(([re]) => re.test(src))?.[1] ?? "other"
    out.push({ combo: [...mods, k].join(" + "), action: b.note || comment || describe(src), group })
  }
  return out
}

function describe(dispatcher: string): string {
  const d = dispatcher.trim()
  let m = /hl\.dsp\.exec_cmd\(\s*"((?:[^"\\]|\\.)*)"/.exec(d)
  if (m) {
    const arg = m[1]
    const t = /ags toggle (?:-i \S+ )?ypsilon-(\w+)/.exec(arg)
    if (t) return `toggle ${t[1]}`
    const r = /ags request (?:-i \S+ )?(\w+)/.exec(arg)
    if (r && r[1] !== "osd") return `open ${r[1]}`
    // media before the generic `ypsilon <cmd>` rule: these lines end in "ags request -i ypsilon osd …"
    // (and mute first of all: it also mentions "volume" and contains "-"s)
    if (/set-mute\s+\S+\s+toggle/.test(arg)) return "mute"
    if (/wpctl\s+set-volume/.test(arg)) return /%\+/.test(arg) ? "volume up" : /%-/.test(arg) ? "volume down" : "volume"
    if (/brightnessctl/.test(arg)) return /%\+/.test(arg) ? "brightness up" : "brightness down"
    if (/playerctl/.test(arg)) return arg.replace(/.*playerctl /, "media ")
    const y = /ypsilon (\w+)(?: (\w+))?/.exec(arg)
    if (y) return `ypsilon ${y.slice(1).filter(Boolean).join(" ")}`
    return arg.split("&&")[0].split("||")[0].trim().slice(0, 36)
  }
  // non-exec dispatchers: `hl.dsp.window.close()` -> "close", `hl.dsp.focus({ workspace = 1 })` -> "focus 1"
  m = /hl\.dsp\.(\w+)\.(\w+)\(\s*(.*)\s*\)/.exec(d)
  if (m) {
    const [, ns, fn, args] = m
    const w = /\bworkspace\s*=\s*"?([^",}]+)"?/.exec(args)
    if (w) return `${fn} ${w[1].replace(/^"|"$/g, "")}`
    const dir = /\bdirection\s*=\s*"(\w+)"/.exec(args)
    if (dir) return `${fn} ${dir[1]}`
    if (/^\s*$/.test(args)) return fn
    return `${ns} ${fn} ${args.slice(0, 24)}`.trim()
  }
  m = /hl\.dsp\.(\w+)\(\s*"([^"]*)"\s*\)/.exec(d)
  if (m) return `${m[1]} ${m[2]}`.trim()
  return d.slice(0, 36)
}

export function groupBinds(binds: Bind[]): [string, Bind[]][] {
  const order = ["shell", "apps", "windows", "workspaces", "capture", "system", "media", "other"]
  return order
    .map((g) => [g, binds.filter((b) => b.group === g)] as [string, Bind[]])
    .filter(([, l]) => l.length > 0)
}

/** case-insensitive substring filter over "combo + action" (cheatsheet search box) */
export function filterBinds(groups: [string, Bind[]][], q: string): [string, Bind[]][] {
  const needle = q.trim().toLowerCase()
  if (!needle) return groups
  return groups
    .map(([name, binds]) => [name, binds.filter((b) => `${b.combo} ${b.action}`.toLowerCase().includes(needle))] as [string, Bind[]])
    .filter(([, l]) => l.length > 0)
}

/** combos bound more than once (Hyprland would run both actions) */
export function findConflicts(binds: Bind[]): string[] {
  const seen = new Map<string, number>()
  for (const b of binds) seen.set(b.combo, (seen.get(b.combo) ?? 0) + 1)
  return [...seen].filter(([, n]) => n > 1).map(([c]) => c)
}
