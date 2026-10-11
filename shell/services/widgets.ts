// Desktop widget settings: thin helpers over config.json (`widgets.enabled` +
// `widgets.settings.<id>.*`). Position values are validated on read
// (shell/lib/widgets.ts), so a hand-edited config falls back instead of breaking.
import { config, writeConfig } from "./config"
import { widgetPosition, type WidgetPosition } from "../lib/widgets"

export function isWidgetEnabled(id: string): boolean {
  return config.peek().widgets.enabled.includes(id)
}

export function setWidgetEnabled(id: string, on: boolean) {
  const cur = new Set(config.peek().widgets.enabled)
  if (on) cur.add(id)
  else cur.delete(id)
  writeConfig("widgets.enabled", [...cur])
}

export function setWidgetPosition(id: string, pos: WidgetPosition) {
  writeConfig(`widgets.settings.${id}.position`, pos)
}

/** Effective position right now (not reactive — call inside an accessor). */
export function widgetPosNow(id: string): WidgetPosition {
  return widgetPosition(config.peek().widgets.settings, id)
}
