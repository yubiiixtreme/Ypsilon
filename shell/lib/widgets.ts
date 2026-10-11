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
