// Plugin runtime: discovery, isolated activation, contributions, live enable/disable.
// Plugins are ES modules loaded with dynamic import() from file:// — no rebuild needed.
// They run with your user's privileges: only enable plugins you trust (Settings says so too).
import { createState, createComputed, createBinding, createEffect, type Accessor } from "ags"
import { jsx } from "ags/gtk4/jsx-runtime"
import { execAsync } from "ags/process"
import { readFile, writeFile } from "ags/file"
import GLib from "gi://GLib"
import { validateManifest, resolveSettings, type Manifest } from "../lib/plugins"
import type { PluginApi, PluginMain, BarItem, LauncherProvider, Tile, Disposer } from "../lib/plugin-types"
import { config, CONFIG_DIR, writeConfig } from "./config"
import { ROOT } from "./theme"
import { openUri } from "./system"

export type PluginStatus = "disabled" | "loading" | "active" | "error" | "invalid"
export type PluginInfo = { id: string; dir: string; source: "bundled" | "user"; manifest?: Manifest; status: PluginStatus; error: string }

type Owned<T> = T & { pluginId: string; key: number }

const [plugins, setPlugins] = createState<PluginInfo[]>([])
const [barItems, setBarItems] = createState<Owned<BarItem>[]>([])
const [providers, setProviders] = createState<Owned<LauncherProvider>[]>([])
const [tiles, setTiles] = createState<Owned<Tile>[]>([])
export { plugins, barItems, providers, tiles }

const commands = new Map<string, (args: string[]) => string | void>()
const cleanups = new Map<string, Disposer[]>()
let nextKey = 1

const SEARCH_DIRS: [string, PluginInfo["source"]][] = [
  [`${ROOT}/plugins`, "bundled"],
  [`${CONFIG_DIR}/plugins`, "user"],
]
const STATE_DIR = `${GLib.get_user_state_dir()}/ypsilon/plugins`

function patch(id: string, p: Partial<PluginInfo>) {
  setPlugins((list) => list.map((x) => (x.id === id ? { ...x, ...p } : x)))
}

export function discover(): PluginInfo[] {
  const found = new Map<string, PluginInfo>()
  for (const [base, source] of SEARCH_DIRS) {
    let dir: GLib.Dir
    try {
      dir = GLib.Dir.open(base, 0)
    } catch {
      continue
    }
    let name: string | null
    while ((name = dir.read_name())) {
      const pdir = `${base}/${name}`
      if (!GLib.file_test(`${pdir}/plugin.json`, GLib.FileTest.EXISTS)) continue
      let raw: unknown
      try {
        raw = JSON.parse(readFile(`${pdir}/plugin.json`))
      } catch (e) {
        found.set(name, { id: name, dir: pdir, source, status: "invalid", error: `plugin.json: ${e}` })
        continue
      }
      const { manifest, errors } = validateManifest(raw, name)
      found.set(name, manifest
        ? { id: name, dir: pdir, source, manifest, status: "disabled", error: "" }
        : { id: name, dir: pdir, source, status: "invalid", error: errors.join("; ") })
    }
  }
  return [...found.values()].sort((a, b) => a.id.localeCompare(b.id))
}

function own<T>(id: string, set: (fn: (l: Owned<T>[]) => Owned<T>[]) => void, item: T): Disposer {
  const key = nextKey++
  set((l) => [...l, { ...item, pluginId: id, key }])
  const dispose = () => set((l) => l.filter((x) => x.key !== key))
  cleanups.get(id)?.push(dispose)
  return dispose
}

function storageFor(id: string) {
  const path = `${STATE_DIR}/${id}.json`
  let data: Record<string, unknown> = {}
  try {
    data = JSON.parse(readFile(path))
  } catch {
    /* empty */
  }
  return {
    get: <T,>(key: string, fallback: T): T => (key in data ? (data[key] as T) : fallback),
    set: (key: string, value: unknown) => {
      data = { ...data, [key]: value }
      try {
        writeFile(path, JSON.stringify(data))
      } catch (e) {
        printerr(`plugin ${id}: storage write failed: ${e}`)
      }
    },
  }
}

function makeApi(info: PluginInfo): PluginApi {
  const m = info.manifest!
  const id = info.id
  const settings = createComputed(() => resolveSettings(m.settings, config().plugins.settings[id]))
  const timers: number[] = []
  cleanups.get(id)!.push(() => timers.forEach((t) => GLib.source_remove(t)))

  return {
    apiVersion: 1,
    id,
    manifest: m,
    dir: info.dir,
    state: (init) => createState(init),
    computed: (fn) => createComputed(fn),
    bind: (obj, prop) => createBinding(obj as any, prop as any) as any,
    effect: (fn) => createEffect(fn),
    poll: (init, ms, fn) => {
      const [v, set] = createState(init)
      const tick = () => {
        try {
          const r = fn(v.peek())
          if (r instanceof Promise) r.then(set).catch((e) => printerr(`plugin ${id}: poll: ${e}`))
          else set(r)
        } catch (e) {
          printerr(`plugin ${id}: poll: ${e}`)
        }
        return GLib.SOURCE_CONTINUE
      }
      tick()
      timers.push(GLib.timeout_add(GLib.PRIORITY_DEFAULT, Math.max(250, ms), tick))
      return v
    },
    h: (type, props, ...children) =>
      (jsx as any)(type, { ...(props ?? {}), ...(children.length ? { children: children.length === 1 ? children[0] : children } : {}) }),
    exec: (cmd) => execAsync(cmd),
    notify: (summary, body = "", urgency = "normal") =>
      void execAsync(["notify-send", "-a", m.name, "-u", urgency, summary, body]).catch(() => {}),
    open: (uri) => void openUri(uri),
    log: (...args) => print(`[plugin ${id}]`, ...args.map(String)),
    settings,
    setSetting: (key, value) => writeConfig(`plugins.settings.${id}.${key}`, value),
    storage: storageFor(id),
    bar: { add: (item) => own(id, setBarItems, item) },
    launcher: { addProvider: (p) => own(id, setProviders, p) },
    controlCenter: { addTile: (t) => own(id, setTiles, t) },
    commands: {
      add: (name, fn) => {
        const k = `${id}:${name}`
        commands.set(k, fn)
        const d = () => void commands.delete(k)
        cleanups.get(id)!.push(d)
        return d
      },
    },
    onCleanup: (fn) => void cleanups.get(id)!.push(fn),
  }
}

async function activate(info: PluginInfo) {
  if (!info.manifest || cleanups.has(info.id)) return
  patch(info.id, { status: "loading", error: "" })
  cleanups.set(info.id, [])
  try {
    const mod = (await import(`file://${info.dir}/${info.manifest.entry}`)) as { default?: PluginMain }
    if (typeof mod.default !== "function") throw new Error("module has no default export function")
    const ret = await mod.default(makeApi(info))
    if (typeof ret === "function") cleanups.get(info.id)!.push(ret)
    patch(info.id, { status: "active" })
    print(`ypsilon: plugin ${info.id} ${info.manifest.version} active`)
  } catch (e) {
    deactivate(info.id)
    const msg = e instanceof Error ? e.message : String(e)
    patch(info.id, { status: "error", error: msg })
    printerr(`ypsilon: plugin ${info.id} failed: ${msg}`)
  }
}

function deactivate(id: string) {
  const list = cleanups.get(id)
  if (!list) return
  cleanups.delete(id)
  for (const fn of list.reverse()) {
    try {
      fn()
    } catch (e) {
      printerr(`plugin ${id}: cleanup: ${e}`)
    }
  }
  patch(id, { status: "disabled" })
}

/** reconcile running plugins with config.plugins.enabled (called on start + config change) */
function sync() {
  const enabled = new Set(config.peek().plugins.enabled)
  for (const p of plugins.peek()) {
    const running = cleanups.has(p.id)
    if (enabled.has(p.id) && !running && p.manifest) activate(p)
    if (!enabled.has(p.id) && running) deactivate(p.id)
  }
}

export function startPlugins() {
  GLib.mkdir_with_parents(`${CONFIG_DIR}/plugins`, 0o755)
  GLib.mkdir_with_parents(STATE_DIR, 0o755)
  setPlugins(discover())
  sync()
  let last = JSON.stringify(config.peek().plugins.enabled)
  config.subscribe(() => {
    const now = JSON.stringify(config.peek().plugins.enabled)
    if (now !== last) {
      last = now
      sync()
    }
  })
}

/** rescan plugin folders (new plugin dropped in) without restarting */
export function rescanPlugins() {
  const running = new Map(plugins.peek().map((p) => [p.id, p]))
  setPlugins(discover().map((p) => (cleanups.has(p.id) ? { ...p, status: running.get(p.id)?.status ?? "active" } : p)))
  sync()
}

export function setPluginEnabled(id: string, on: boolean) {
  const cur = new Set(config.peek().plugins.enabled)
  if (on) cur.add(id)
  else cur.delete(id)
  writeConfig("plugins.enabled", [...cur])
}

/** `ags request -i ypsilon plugin <id> <cmd> args…` */
export function runPluginCommand(argv: string[]): string {
  const [id, name, ...args] = argv
  if (!id) return plugins.peek().map((p) => `${p.id}\t${p.status}${p.error ? `\t${p.error}` : ""}`).join("\n") || "no plugins found"
  const fn = commands.get(`${id}:${name}`)
  if (!fn) return `unknown plugin command "${id} ${name ?? ""}"`
  try {
    return fn(args) ?? "ok"
  } catch (e) {
    return `error: ${e}`
  }
}

export const pluginSettingsAccessor = (id: string): Accessor<Record<string, unknown>> =>
  createComputed(() => {
    const p = plugins().find((x) => x.id === id)
    return p?.manifest ? resolveSettings(p.manifest.settings, config().plugins.settings[id]) : {}
  })
