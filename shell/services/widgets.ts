// Desktop widget settings: thin helpers over config.json (`widgets.enabled` +
// `widgets.settings.<id>.*`). Position values are validated on read
// (shell/lib/widgets.ts), so a hand-edited config falls back instead of breaking.
import GLib from "gi://GLib"
import { createComputed, createState } from "ags"
import { execAsync } from "ags/process"
import { config, writeConfig } from "./config"
import { widgetPosition, cmdSettings, nextCmdId, freePosition, isCmdId, type WidgetPosition } from "../lib/widgets"

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

// --- command widgets (`cmd:<id>`): run the user's command on an interval, keep the
// latest trimmed output. One timer per enabled widget, reconciled with the config.

const [cmdOut, setCmdOut] = createState<Record<string, string>>({})
export { cmdOut }

const timers = new Map<string, number>()
const intervalOf = new Map<string, number>()

function runCmd(id: string) {
  const { command } = cmdSettings(config.peek().widgets.settings, id)
  if (!command.trim()) {
    setCmdOut((m) => ({ ...m, [id]: "" }))
    return
  }
  execAsync(["bash", "-c", command])
    .then((out) => setCmdOut((m) => ({ ...m, [id]: out.split("\n").slice(0, 8).join("\n").slice(0, 400).trim() })))
    .catch((e) => setCmdOut((m) => ({ ...m, [id]: `⚠ ${String(e).split("\n")[0].slice(0, 120)}` })))
}

function syncCmd() {
  const cfg = config.peek().widgets
  const want = new Set(cfg.enabled.filter(isCmdId))
  for (const [id, t] of [...timers]) {
    const secs = want.has(id) ? cmdSettings(cfg.settings, id).intervalSec : -1
    const current = secs > 0 ? intervalOf.get(id) : -1
    if (secs !== current) {
      GLib.source_remove(t)
      timers.delete(id)
      intervalOf.delete(id)
    }
    if (!want.has(id)) {
      setCmdOut((m) => {
        const next = { ...m }
        delete next[id]
        return next
      })
    }
  }
  for (const id of want) {
    if (!timers.has(id)) {
      runCmd(id)
      const secs = cmdSettings(cfg.settings, id).intervalSec * 1000
      intervalOf.set(id, cmdSettings(cfg.settings, id).intervalSec)
      timers.set(id, GLib.timeout_add(GLib.PRIORITY_DEFAULT, secs, () => (runCmd(id), GLib.SOURCE_CONTINUE)))
    }
  }
}

/** Call once from app main(): runs enabled command widgets, follows config edits. */
export function startCmdWidgets() {
  syncCmd()
  let last = JSON.stringify([config.peek().widgets.enabled, config.peek().widgets.settings])
  config.subscribe(() => {
    const now = JSON.stringify([config.peek().widgets.enabled, config.peek().widgets.settings])
    if (now !== last) {
      last = now
      syncCmd()
    }
  })
}

/** every command widget known (enabled or just configured), for menus and Settings. */
export const cmdWidgetIds = createComputed(() => [
  ...new Set([...config().widgets.enabled.filter(isCmdId), ...Object.keys(config().widgets.settings).filter(isCmdId)]),
])

/** add a command widget with a free id + free corner, enabled right away. */
export function addCmdWidget(): string {
  const cfg = config.peek().widgets
  const taken = [...cfg.enabled, ...Object.keys(cfg.settings)]
  const id = nextCmdId(taken)
  const positions = cfg.enabled.map((e) => widgetPosition(cfg.settings, e))
  writeConfig(`widgets.settings.${id}.position`, freePosition(positions))
  writeConfig("widgets.enabled", [...cfg.enabled, id])
  return id
}

/** disable a command widget and forget its settings. */
export function removeCmdWidget(id: string) {
  const cfg = config.peek().widgets
  writeConfig(
    "widgets.enabled",
    cfg.enabled.filter((e) => e !== id),
  )
  writeConfig(`widgets.settings.${id}`, undefined)
}
