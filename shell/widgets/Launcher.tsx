import app from "ags/gtk4/app"
import Gtk from "gi://Gtk"
import Gdk from "gi://Gdk"
import { Astal } from "ags/gtk4"
import { createComputed, createState, For } from "ags"
import { execAsync } from "ags/process"
import { queryApps, appId } from "../services/apps"
import { recordLaunch } from "../services/usage"
import { clips, loadClips, clipPreview, pasteClip } from "../services/clip"
import { getHypr, focusAddress } from "../services/hypr"
import { config } from "../services/config"
import { calc, formatNumber } from "../lib/calc"
import { matchActions } from "../lib/actions"
import { paletteActions } from "../services/actions"
import { providers } from "../services/plugins"
import type { Row as PluginRow } from "../lib/plugin-types"
import Popup from "./Popup"

type Row = { id: string; icon: string; title: string; sub: string; run: () => void }

// Spotlight-style launcher. Modes by prefix:
//   (none) apps, ranked by fuzzy match + your habits   =  calculator
//   :  run shell command   ;  clipboard history   @  switch window   ?  web search
// ↑/↓/Tab select · Enter run · Esc / click outside closes. Toggle: SUPER+Space.
export default function Launcher() {
  const [query, setQuery] = createState("")
  const [sel, setSel] = createState(0)
  let entry: Gtk.Entry | null = null

  const hide = () => app.get_window("ypsilon-launcher")?.set_visible(false)
  const done = (fn: () => void) => () => {
    try {
      fn()
    } catch (e) {
      print(`ypsilon launcher: ${e}`)
    }
    hide()
  }

  // a plugin provider whose prefix matches takes over (built-in prefixes win on conflicts)
  const pluginProvider = createComputed(() => {
    const q = query()
    if ("=:;@?".includes(q[0] ?? " ")) return null
    return providers().find((p) => p.prefix && q.startsWith(p.prefix)) ?? null
  })

  const mode = createComputed(() => {
    const q = query()
    if (pluginProvider()) return "plugin"
    return q[0] === "=" ? "calc" : q[0] === ":" ? "cmd" : q[0] === ";" ? "clip" : q[0] === "@" ? "win" : q[0] === "?" ? "web" : "apps"
  })

  /** plugin rows, isolated: a throwing provider yields nothing instead of breaking the launcher */
  const fromProvider = (p: { pluginId: string; name: string; search: (q: string) => PluginRow[] }, q: string, max: number): Row[] => {
    try {
      return p.search(q).slice(0, max).map((r, i) => ({
        id: `plugin:${p.pluginId}:${i}:${r.title}`,
        icon: r.icon || "application-x-addon-symbolic",
        title: r.title,
        sub: r.sub ?? p.name,
        run: done(() => r.run()),
      }))
    } catch (e) {
      printerr(`plugin ${p.pluginId} search failed: ${e}`)
      return []
    }
  }

  const rows = createComputed<Row[]>(() => {
    const q = query()
    const body = q.slice(1).trim()
    const max = config().launcher.maxResults
    switch (mode()) {
      case "plugin": {
        const p = pluginProvider()!
        return fromProvider(p, q.slice(p.prefix!.length).trim(), max)
      }
      case "calc": {
        const v = calc(body)
        if (v === null) return []
        const text = formatNumber(v)
        return [{ id: "calc", icon: "accessories-calculator-symbolic", title: `= ${text}`, sub: "enter copies the result", run: done(() => void execAsync(["wl-copy", text]).catch(() => {})) }]
      }
      case "cmd":
        return body === ""
          ? []
          : [{ id: "cmd", icon: "utilities-terminal-symbolic", title: body, sub: "run in shell", run: done(() => execAsync(["bash", "-c", body]).catch((e) => print(`ypsilon run: ${e}`))) }]
      case "web":
        return body === ""
          ? []
          : [{ id: "web", icon: "web-browser-symbolic", title: `search "${body}"`, sub: "open in browser", run: done(() => void execAsync(["xdg-open", config().launcher.webSearch.replace("%s", encodeURIComponent(body))]).catch(() => {})) }]
      case "clip": {
        const needle = body.toLowerCase()
        return clips()
          .filter((l) => needle === "" || clipPreview(l).toLowerCase().includes(needle))
          .slice(0, max)
          .map((l) => ({ id: l, icon: "edit-paste-symbolic", title: clipPreview(l).slice(0, 80), sub: "copy back to clipboard", run: done(() => pasteClip(l)) }))
      }
      case "win": {
        const needle = body.toLowerCase()
        return (getHypr()?.clients ?? [])
          .filter((c) => needle === "" || `${c.title} ${c.class}`.toLowerCase().includes(needle))
          .slice(0, max)
          .map((c) => ({ id: c.address, icon: (c.class || "window").toLowerCase(), title: (c.title || c.class).slice(0, 60), sub: `${c.class} · workspace ${c.workspace?.id ?? "?"}`, run: done(() => focusAddress(c.address)) }))
      }
      default: {
        const actions = matchActions(q, paletteActions()).map((a) => ({
          id: `action:${a.id}`,
          icon: a.icon,
          title: a.title,
          sub: "action",
          run: done(() => void a.run()),
        }))
        const extra = q.trim().length >= 2 ? providers().filter((p) => !p.prefix).flatMap((p) => fromProvider(p, q.trim(), 3)) : []
        return [...actions, ...extra, ...queryApps(q.trim(), Math.max(1, max - actions.length - extra.length)).map((a) => ({
          id: appId(a),
          icon: a.iconName || "application-x-executable",
          title: a.name,
          sub: (a.description || "").slice(0, 70),
          run: done(() => {
            recordLaunch(appId(a))
            a.launch()
          }),
        }))]
      }
    }
  })

  const hint = createComputed(() =>
    mode() === "plugin" ? `${pluginProvider()?.name ?? "plugin"}` : ({
      apps: "apps & actions · = calc · : cmd · ; clipboard · @ windows · ? web",
      calc: "calculator · enter copies the result",
      cmd: "run a shell command",
      clip: "clipboard history · enter copies back",
      win: "windows · enter focuses",
      web: "web search",
    } as Record<string, string>)[mode()],
  )

  const onKey = (keyval: number) => {
    const n = rows().length
    if (n === 0) return false
    if (keyval === Gdk.KEY_Down || keyval === Gdk.KEY_Tab) return (setSel((sel() + 1) % n), true)
    if (keyval === Gdk.KEY_Up || keyval === Gdk.KEY_ISO_Left_Tab) return (setSel((sel() - 1 + n) % n), true)
    return false
  }

  return (
    <Popup
      name="ypsilon-launcher"
      keymode={Astal.Keymode.EXCLUSIVE}
      onKey={onKey}
      onShow={() => {
        setQuery("")
        setSel(0)
        entry?.grab_focus()
      }}
    >
      <label class="title" label="✦ ypsilon" halign={Gtk.Align.START} />
      <entry
        class="search"
        placeholderText="search apps…"
        text={query}
        onNotifyText={({ text }) => {
          setQuery(text)
          setSel(0)
          if (text[0] === ";") loadClips()
        }}
        onActivate={() => rows()[sel()]?.run()}
        $={(self) => (entry = self)}
      />
      <box orientation={Gtk.Orientation.VERTICAL} spacing={2}>
        <For each={rows}>
          {(row, index) => (
            <button
              class={createComputed(() => `app-row${sel() === index() ? " selected" : ""}`)}
              onClicked={() => row.run()}
            >
              <box spacing={12}>
                <image iconName={row.icon} pixelSize={30} />
                <box orientation={Gtk.Orientation.VERTICAL} valign={Gtk.Align.CENTER}>
                  <label class={mode((m) => (m === "calc" ? "calc-result" : "app-name"))} label={row.title} halign={Gtk.Align.START} />
                  <label class="sub" label={row.sub} halign={Gtk.Align.START} visible={row.sub !== ""} />
                </box>
              </box>
            </button>
          )}
        </For>
      </box>
      <label class="hint" label={hint} halign={Gtk.Align.START} />
    </Popup>
  )
}
