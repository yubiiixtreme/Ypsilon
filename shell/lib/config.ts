// User config schema + merge. Pure (no gi/ags imports) so it is unit-tested.
// File: ~/.config/ypsilon/config.json — any subset of keys; bad values fall back to defaults.
// The Settings app writes this file; the shell and scripts/gen-theme.py (hypr/idle parts) read it.
export type Config = {
  bar: {
    position: "top" | "bottom"
    autohide: boolean
    clock24h: boolean
    showSeconds: boolean
    showWindowTitle: boolean
    showMedia: boolean
    showTray: boolean
    showSysinfo: boolean
    showUpdates: boolean
    showVisualizer: boolean
  }
  workspaces: number
  battery: { warnAt: number; criticalAt: number }
  launcher: { webSearch: string; maxResults: number }
  osdTimeoutMs: number
  theme: { followWallpaper: boolean; autoLight: boolean }
  /** accessibility: no slide/fade in the shell, Hyprland animations off */
  reduceMotion: boolean
  /** applied to Hyprland through hypr/generated/user.conf */
  hypr: { gapsIn: number; gapsOut: number; borderSize: number; rounding: number; blur: boolean; shadows: boolean; dimInactive: boolean }
  input: { kbLayout: string; kbVariant: string; kbOptions: string; naturalScroll: boolean; sensitivity: number; repeatRate: number; repeatDelay: number }
  /** seconds; 0 disables that step (rendered into hypr/generated/hypridle.conf) */
  idle: { dimSec: number; lockSec: number; screenOffSec: number; suspendSec: number }
  terminal: string
  updates: { enabled: boolean; intervalMin: number; flatpak: boolean }
  weather: { enabled: boolean; location: string; units: "metric" | "imperial" }
  plugins: { enabled: string[]; settings: Record<string, Record<string, unknown>> }
}

export const DEFAULTS: Config = {
  bar: {
    position: "top",
    autohide: false,
    clock24h: true,
    showSeconds: false,
    showWindowTitle: true,
    showMedia: true,
    showTray: true,
    showSysinfo: true,
    showUpdates: true,
    showVisualizer: true,
  },
  workspaces: 5,
  battery: { warnAt: 20, criticalAt: 8 },
  launcher: { webSearch: "https://duckduckgo.com/?q=%s", maxResults: 7 },
  osdTimeoutMs: 1600,
  theme: { followWallpaper: false, autoLight: false },
  reduceMotion: false,
  hypr: { gapsIn: 6, gapsOut: 12, borderSize: 2, rounding: 18, blur: true, shadows: true, dimInactive: true },
  input: { kbLayout: "us", kbVariant: "", kbOptions: "", naturalScroll: true, sensitivity: 0, repeatRate: 35, repeatDelay: 300 },
  idle: { dimSec: 150, lockSec: 300, screenOffSec: 360, suspendSec: 1200 },
  terminal: "",
  updates: { enabled: true, intervalMin: 60, flatpak: true },
  weather: { enabled: true, location: "", units: "metric" },
  plugins: { enabled: [], settings: {} },
}

/** numeric ranges by dotted path; values are clamped (and rounded unless listed in FLOAT) */
export const RANGE: Record<string, [number, number]> = {
  workspaces: [1, 10],
  "battery.warnAt": [1, 60],
  "battery.criticalAt": [1, 30],
  "launcher.maxResults": [3, 12],
  osdTimeoutMs: [600, 6000],
  "hypr.gapsIn": [0, 40],
  "hypr.gapsOut": [0, 60],
  "hypr.borderSize": [0, 8],
  "hypr.rounding": [0, 40],
  "input.sensitivity": [-1, 1],
  "input.repeatRate": [5, 100],
  "input.repeatDelay": [100, 1500],
  "idle.dimSec": [0, 86400],
  "idle.lockSec": [0, 86400],
  "idle.screenOffSec": [0, 86400],
  "idle.suspendSec": [0, 86400],
  "updates.intervalMin": [10, 1440],
}
const FLOAT = new Set(["input.sensitivity"])
export const ENUM: Record<string, string[]> = { "bar.position": ["top", "bottom"], "weather.units": ["metric", "imperial"] }
/** strings that end up inside Hyprland config lines: no newlines, commas only where Hyprland expects them */
const SAFE_STRING: Record<string, RegExp> = {
  "input.kbLayout": /^[a-z0-9_,-]{0,64}$/i,
  "input.kbVariant": /^[a-z0-9_,-]{0,64}$/i,
  "input.kbOptions": /^[a-z0-9_:,-]{0,200}$/i,
  terminal: /^[^\n;&|`$<>]{0,120}$/,
  "weather.location": /^[^\n;&|`$<>]{0,80}$/,
}

function merge(base: any, user: any, path = ""): any {
  if (Array.isArray(base)) {
    // string lists (plugins.enabled): keep only strings, dedupe
    return Array.isArray(user) ? [...new Set(user.filter((x) => typeof x === "string"))] : base
  }
  if (base !== null && typeof base === "object") {
    if (path === "plugins.settings") {
      // free-form per-plugin objects
      if (!user || typeof user !== "object" || Array.isArray(user)) return {}
      return Object.fromEntries(Object.entries(user).filter(([, v]) => v && typeof v === "object" && !Array.isArray(v)))
    }
    const out: any = {}
    for (const k of Object.keys(base)) out[k] = merge(base[k], user && typeof user === "object" ? user[k] : undefined, path ? `${path}.${k}` : k)
    return out
  }
  if (typeof user !== typeof base) return base
  if (typeof base === "number") {
    if (!Number.isFinite(user)) return base
    const [lo, hi] = RANGE[path] ?? [-Infinity, Infinity]
    const v = Math.min(hi, Math.max(lo, user))
    return FLOAT.has(path) ? v : Math.round(v)
  }
  if (typeof base === "string") {
    if (ENUM[path] && !ENUM[path].includes(user)) return base
    if (SAFE_STRING[path] && !SAFE_STRING[path].test(user)) return base
    if (path === "launcher.webSearch" && !user.includes("%s")) return base
  }
  return user
}

/** Parse JSON text and merge over DEFAULTS. Never throws. */
export function parseConfig(text: string | null | undefined): Config {
  let user: unknown
  try {
    user = text ? JSON.parse(text) : {}
  } catch {
    user = {}
  }
  return merge(DEFAULTS, user) as Config
}

/**
 * Immutable set of a dotted path inside a plain JSON object (creates parents).
 * Used by the Settings app so a write touches one key and preserves everything else.
 */
export function setIn(obj: unknown, path: string, value: unknown): Record<string, unknown> {
  const root: Record<string, unknown> = obj && typeof obj === "object" && !Array.isArray(obj) ? { ...(obj as object) } : {}
  const keys = path.split(".")
  let cur = root
  for (let i = 0; i < keys.length - 1; i++) {
    const next = cur[keys[i]]
    cur[keys[i]] = next && typeof next === "object" && !Array.isArray(next) ? { ...(next as object) } : {}
    cur = cur[keys[i]] as Record<string, unknown>
  }
  cur[keys[keys.length - 1]] = value
  return root
}

/** read a dotted path from an object (undefined if any part is missing) */
export function getIn(obj: unknown, path: string): unknown {
  return path.split(".").reduce<any>((o, k) => (o == null || typeof o !== "object" ? undefined : o[k]), obj)
}

/** Validate one value the way parseConfig would (for the Settings UI); returns the accepted value. */
export function coerce(path: string, value: unknown): unknown {
  const base = path.split(".").reduce<any>((o, k) => (o == null ? undefined : o[k]), DEFAULTS)
  return merge(base, value, path)
}

function editDistance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return d[a.length][b.length]
}

const suggest = (key: string, options: string[]) => {
  const best = options
    .map((o) => ({ o, d: editDistance(key.toLowerCase(), o.toLowerCase()) }))
    .sort((x, y) => x.d - y.d)[0]
  return best && best.d <= 2 ? ` — did you mean "${best.o}"?` : ""
}

/** Human-readable problems in a user config (unknown keys, wrong types, clamped/invalid values). */
export function diagnoseConfig(text: string | null | undefined): string[] {
  if (!text || !text.trim()) return []
  let user: unknown
  try {
    user = JSON.parse(text)
  } catch (e) {
    return [`not valid JSON (${(e as Error).message}) — using all defaults`]
  }
  const out: string[] = []
  const walk = (base: any, u: any, path: string) => {
    if (u === null || typeof u !== "object" || Array.isArray(u)) {
      out.push(`${path || "config"}: expected an object`)
      return
    }
    for (const k of Object.keys(u)) {
      const p = path ? `${path}.${k}` : k
      if (!(k in base)) {
        out.push(`${p}: unknown key (ignored)${suggest(k, Object.keys(base))}`)
        continue
      }
      const b = base[k], v = u[k]
      if (p === "plugins.settings" || Array.isArray(b)) {
        const fixed = merge(b, v, p)
        if (JSON.stringify(fixed) !== JSON.stringify(v)) out.push(`${p}: some entries were invalid and ignored`)
      } else if (b !== null && typeof b === "object") walk(b, v, p)
      else if (typeof v !== typeof b) out.push(`${p}: expected ${typeof b}, got ${Array.isArray(v) ? "array" : typeof v} — using ${JSON.stringify(b)}`)
      else {
        const fixed = merge(b, v, p)
        if (fixed !== v) out.push(`${p}: ${JSON.stringify(v)} is not allowed — using ${JSON.stringify(fixed)}`)
      }
    }
  }
  walk(DEFAULTS, user, "")
  return out
}
