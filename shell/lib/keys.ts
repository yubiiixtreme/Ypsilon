// Parse hyprlang `bind*` lines into a human cheat-sheet. Pure + unit-tested.
// A trailing comment is the human description:  bind = $mod, E, exec, thunar   # Files
// (without one, a description is guessed from the command).
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
  [/ypsilon (gamemode|nightlight|caffeine)/, "system"],
  [/wpctl|brightnessctl|playerctl/, "media"],
]

function expand(value: string, vars: Record<string, string>) {
  return value.replace(/\$\w+/g, (m) => vars[m] ?? m)
}

/** split "code  # note" — hyprlang comments start at `#`; `##` is an escaped literal `#` */
function splitComment(raw: string): [string, string] {
  const i = raw.search(/(^|[^#])#(?!#)/)
  if (i < 0) return [raw, ""]
  const at = raw[i] === "#" ? i : i + 1
  return [raw.slice(0, at), raw.slice(at + 1).trim()]
}

export function parseBinds(conf: string): Bind[] {
  const vars: Record<string, string> = {}
  const out: Bind[] = []
  for (const raw of conf.split("\n")) {
    const [code, note] = splitComment(raw)
    const line = code.trim()
    if (!line) continue
    const v = /^(\$\w+)\s*=\s*(.+)$/.exec(line)
    if (v) {
      vars[v[1]] = v[2].trim()
      continue
    }
    const m = /^bind[a-z]*\s*=\s*(.*)$/.exec(line)
    if (!m) continue
    const [mods, key, dispatcher, ...rest] = m[1].split(",").map((s) => s.trim())
    if (key === undefined || dispatcher === undefined) continue
    const arg = rest.join(",").trim()
    const modParts = expand(mods, vars).split(/\s+/).filter(Boolean).map((x) => (x === "SUPER" ? "Super" : x[0] + x.slice(1).toLowerCase()))
    const k = PRETTY[key.toLowerCase()] ?? (key.length === 1 ? key.toUpperCase() : key)
    const group = GROUPS.find(([re]) => re.test(`${dispatcher} ${arg}`))?.[1] ?? "other"
    out.push({ combo: [...modParts, k].join(" + "), action: note || describe(dispatcher, arg), group })
  }
  return out
}

function describe(d: string, arg: string): string {
  if (d === "exec") {
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
  return arg ? `${d} ${arg}` : d
}

export function groupBinds(binds: Bind[]): [string, Bind[]][] {
  const order = ["shell", "apps", "windows", "workspaces", "capture", "system", "media", "other"]
  return order
    .map((g) => [g, binds.filter((b) => b.group === g)] as [string, Bind[]])
    .filter(([, l]) => l.length > 0)
}

/** combos bound more than once (Hyprland would run both actions) */
export function findConflicts(binds: Bind[]): string[] {
  const seen = new Map<string, number>()
  for (const b of binds) seen.set(b.combo, (seen.get(b.combo) ?? 0) + 1)
  return [...seen].filter(([, n]) => n > 1).map(([c]) => c)
}
