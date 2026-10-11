// Desktop widgets, one set per monitor on the wallpaper layer (BOTTOM: windows cover
// them, empty workspaces show them). Nothing renders unless it is enabled in
// config.json (`widgets.enabled`, Settings → Desktop) or contributed by a plugin
// (`api.desktop.add()`). Display widgets are click-through and idle at rest:
// the clock text ticks once a minute through the shared wall clock, and the empty
// input region is re-applied every minute in case new text resized the surface.
import Gtk from "gi://Gtk"
import Gdk from "gi://Gdk"
import Cairo from "cairo"
import GLib from "gi://GLib"
import { Astal } from "ags/gtk4"
import { createComputed, For, onCleanup, type Accessor } from "ags"
import { config } from "../services/config"
import { wallClock } from "../services/clock"
import { cpu, mem, temp } from "../services/sysinfo"
import { pct } from "../lib/sysinfo"
import { desktopItems } from "../services/plugins"
import { guarded } from "../services/health"
import { clickThrough } from "./Desktop"
import { widgetPosition, isWidgetPosition, type WidgetPosition, type BuiltinWidgetId } from "../lib/widgets"
import type { MaybeAccessor } from "../lib/plugin-types"

const { TOP, BOTTOM, LEFT, RIGHT } = Astal.WindowAnchor

function anchorFor(pos: WidgetPosition): Astal.WindowAnchor {
  switch (pos) {
    case "top-left": return TOP | LEFT
    case "top-center": return TOP
    case "top-right": return TOP | RIGHT
    case "bottom-left": return BOTTOM | LEFT
    case "bottom-center": return BOTTOM
    case "bottom-right": return BOTTOM | RIGHT
    case "center": return 0 as Astal.WindowAnchor
  }
}

function alignFor(pos: WidgetPosition): Gtk.Align {
  if (pos.endsWith("right")) return Gtk.Align.END
  if (pos === "center" || pos.endsWith("center")) return Gtk.Align.CENTER
  return Gtk.Align.START
}

/** one wallpaper window: click-through unless the widget takes input (plugin `interactive`) */
function WidgetWindow({ gdkmonitor, position, interactive, children }: {
  gdkmonitor: Gdk.Monitor
  position: WidgetPosition | Accessor<WidgetPosition>
  interactive?: boolean
  children?: JSX.Element | JSX.Element[]
}) {
  let win: Astal.Window
  let timer = 0
  onCleanup(() => {
    if (timer) GLib.source_remove(timer)
    win.destroy()
  })
  const anchor = typeof position === "function" ? position((p) => anchorFor(p)) : anchorFor(position)
  return (
    <window
      $={(self) => {
        win = self
        if (interactive) return
        const reapply = clickThrough(self)
        // new text can resize the surface: keep the input region empty
        timer = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 60, () => {
          reapply()
          return GLib.SOURCE_CONTINUE
        })
      }}
      visible
      namespace="ypsilon-widget"
      class="ypsilon-widget"
      gdkmonitor={gdkmonitor}
      layer={Astal.Layer.BOTTOM}
      exclusivity={Astal.Exclusivity.NORMAL}
      anchor={anchor}
    >
      {children}
    </window>
  )
}

/** big time + date (the old permanent clock, now opt-in via Settings → Desktop → Widgets) */
function ClockWidget({ gdkmonitor }: { gdkmonitor: Gdk.Monitor }) {
  const pos = config((c) => widgetPosition(c.widgets.settings, "clock"))
  const time = wallClock(() => (config().bar.clock24h ? "%H:%M" : "%-I:%M"))
  const date = wallClock(() => "%A, %-d %B")
  const align = pos((p) => alignFor(p))
  return (
    <WidgetWindow gdkmonitor={gdkmonitor} position={pos}>
      <box class="desk-clock" orientation={Gtk.Orientation.VERTICAL} halign={align}>
        <label class="desk-time" label={time} halign={align} />
        <label class="desk-date" label={date} halign={align} />
      </box>
    </WidgetWindow>
  )
}

function SysinfoWidget({ gdkmonitor }: { gdkmonitor: Gdk.Monitor }) {
  const pos = config((c) => widgetPosition(c.widgets.settings, "sysinfo"))
  const align = pos((p) => alignFor(p))
  const sub = createComputed(() => `CPU ${pct(cpu())} · MEM ${pct(mem())}${temp() === null ? "" : ` · ${temp()}°C`}`)
  return (
    <WidgetWindow gdkmonitor={gdkmonitor} position={pos}>
      <box class="desk-sys" orientation={Gtk.Orientation.VERTICAL} halign={align}>
        <label class="desk-sys-cpu" label={cpu((v) => pct(v))} halign={align} />
        <label class="desk-sys-sub" label={sub} halign={align} />
      </box>
    </WidgetWindow>
  )
}

const KNOWN: BuiltinWidgetId[] = ["clock", "sysinfo"]

function Builtin({ id, gdkmonitor }: { id: string; gdkmonitor: Gdk.Monitor }) {
  if (id === "clock") return <ClockWidget gdkmonitor={gdkmonitor} />
  if (id === "sysinfo") return <SysinfoWidget gdkmonitor={gdkmonitor} />
  return <box visible={false} />
}

/** widgets contributed by plugins (api.desktop.add); a failing widget only drops itself */
function PluginWidgets({ gdkmonitor }: { gdkmonitor: Gdk.Monitor }) {
  return (
    <For each={desktopItems}>
      {(item) => {
        const raw = item.position as MaybeAccessor<WidgetPosition> | undefined
        const position: WidgetPosition | Accessor<WidgetPosition> =
          typeof raw === "function" ? raw : isWidgetPosition(raw) ? raw : "bottom-left"
        return (
          guarded(`plugin ${item.pluginId} desktop widget`, () => (
            <WidgetWindow gdkmonitor={gdkmonitor} position={position} interactive={item.interactive}>
              {item.widget()}
            </WidgetWindow>
          )) ?? <box visible={false} />
        )
      }}
    </For>
  )
}

/** plain function (like ScreenCorners): one host per monitor, mounted by app.tsx */
export function DesktopWidgets({ gdkmonitor }: { gdkmonitor: Gdk.Monitor }) {
  const enabled = createComputed(() => config().widgets.enabled.filter((id) => (KNOWN as string[]).includes(id)))
  return [
    <For each={enabled}>{(id) => <Builtin id={id} gdkmonitor={gdkmonitor} />}</For>,
    <PluginWidgets gdkmonitor={gdkmonitor} />,
  ]
}
