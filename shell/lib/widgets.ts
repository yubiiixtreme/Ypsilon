// Desktop widgets: pure registry + layout helpers (no gi/ags imports, unit-tested).
// Built-ins render on the wallpaper layer through shell/widgets/Widgets.tsx;
// plugins contribute their own via `api.desktop.add()` (see shell/lib/plugin-types.ts).
// Nothing here is permanent: `widgets.enabled` in config.json decides what shows.

export const WIDGET_POSITIONS = [
  "top-left",
  "top-center",
  "top-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
  "center",
] as const
export type WidgetPosition = (typeof WIDGET_POSITIONS)[number]

export type BuiltinWidgetId = "clock" | "sysinfo"

export const BUILTIN_WIDGETS: { id: BuiltinWidgetId; name: string; description: string; defaultPosition: WidgetPosition }[] = [
  { id: "clock", name: "Clock", description: "Big time + date on the wallpaper, visible on empty workspaces", defaultPosition: "bottom-left" },
  { id: "sysinfo", name: "System stats", description: "CPU, memory and temperature on the wallpaper", defaultPosition: "top-right" },
]

export const isWidgetPosition = (v: unknown): v is WidgetPosition =>
  typeof v === "string" && (WIDGET_POSITIONS as readonly string[]).includes(v)

const defaultPosition = (id: string): WidgetPosition =>
  BUILTIN_WIDGETS.find((w) => w.id === id)?.defaultPosition ?? "bottom-left"

/** Effective position of a widget: its `widgets.settings.<id>.position`, else the built-in default. */
export function widgetPosition(settings: unknown, id: string): WidgetPosition {
  const p =
    settings && typeof settings === "object" && !Array.isArray(settings)
      ? (settings as Record<string, unknown>)[id]
      : undefined
  const pos = p && typeof p === "object" && !Array.isArray(p) ? (p as Record<string, unknown>).position : undefined
  return isWidgetPosition(pos) ? pos : defaultPosition(id)
}

/** Enabled widget ids, cleaned: strings only, deduped, order kept. Unknown ids survive here —
 *  the host skips built-ins it doesn't know so a removed widget never breaks the shell. */
export function normalizeEnabled(list: unknown): string[] {
  if (!Array.isArray(list)) return []
  return [...new Set(list.filter((x): x is string => typeof x === "string"))]
}

// --- command widgets (`cmd:<id>`): user-defined, genmon-style — run a command every
// N seconds and show its output. No code needed: a Duolingo streak is one curl line.

export const isCmdId = (id: string): boolean => id.startsWith("cmd:")

export type CmdSettings = { position: WidgetPosition; title: string; command: string; intervalSec: number }

const CMD_DEFAULTS: CmdSettings = { position: "bottom-left", title: "", command: "", intervalSec: 60 }

/** validated settings for one command widget (free-form JSON in, safe values out). */
export function cmdSettings(all: unknown, id: string): CmdSettings {
  const raw =
    all && typeof all === "object" && !Array.isArray(all)
      ? (all as Record<string, unknown>)[id]
      : undefined
  const o = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
  return {
    position: isWidgetPosition(o.position) ? o.position : CMD_DEFAULTS.position,
    title: typeof o.title === "string" && o.title.trim() ? o.title.trim().slice(0, 40) : "",
    command: typeof o.command === "string" ? o.command.slice(0, 2000) : "",
    intervalSec: clampInterval(o.intervalSec),
  }
}

/** refresh interval in seconds: 5..3600, default 60 (a stuck command must never hot-loop). */
export function clampInterval(v: unknown): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return 60
  return Math.min(3600, Math.max(5, Math.round(v)))
}

/** title shown above the output: the user's title, else a readable id ("cmd:custom-2" → "Custom 2"). */
export function cmdTitle(id: string, title: string): string {
  if (title) return title
  const slug = id.startsWith("cmd:") ? id.slice(4) : id
  const words = slug.replace(/[-_]+/g, " ").trim() || "command"
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/** first free `cmd:custom-N` id given the ids already taken. */
export function nextCmdId(taken: readonly string[]): string {
  let n = 1
  while (taken.includes(`cmd:custom-${n}`)) n++
  return `cmd:custom-${n}`
}

/** default position for a new widget: first free corner, else center. */
export function freePosition(used: readonly unknown[]): WidgetPosition {
  for (const p of WIDGET_POSITIONS) if (!(used as unknown[]).includes(p)) return p
  return "center"
}
