import Gtk from "gi://Gtk"
import GLib from "gi://GLib"
import { Astal } from "ags/gtk4"
import { createBinding, createComputed, createEffect, createState, For, onCleanup } from "ags"
import Gdk from "gi://Gdk"
import { createPoll } from "ags/time"
import Tray from "gi://AstalTray"
import Network from "gi://AstalNetwork"
import Bluetooth from "gi://AstalBluetooth"
import Mpris from "gi://AstalMpris"
import { hyprWorkspaces, hyprFocusedWorkspace, hyprFocusedClient, gotoWorkspace, stepWorkspace } from "../services/hypr"
import { speakerProp } from "../services/audio"
import { getBattery } from "../services/battery"
import { getNotifd } from "../services/notif"
import { togglePlay } from "../services/media"
import { toggleWindow as toggle } from "../services/shell"
import { config, configValue } from "../services/config"
import { cpu, mem, temp } from "../services/sysinfo"
import { pct } from "../lib/sysinfo"
import { toggleRecording } from "../services/system"
import { barItems } from "../services/plugins"
import { updates } from "../services/updates"
import { openSettings } from "./settings/SettingsApp"
import Visualizer from "./Visualizer"
import { guarded } from "../services/health"
import { watchFile } from "../services/watch"

const RECORD_PID = `${GLib.get_user_cache_dir()}/ypsilon/record.pid`

function Workspaces() {
  const spaces = hyprWorkspaces()
  const focused = hyprFocusedWorkspace()

  // fixed strip + any occupied workspace beyond it (e.g. 7), sorted
  const ids = createComputed(() => {
    const all = new Set<number>(Array.from({ length: config().workspaces }, (_, i) => i + 1))
    for (const w of spaces()) if (w.id > 0) all.add(w.id)
    return [...all].sort((a, b) => a - b)
  })
  const state = createComputed(() => ({ active: focused()?.id ?? -1, occ: new Set(spaces().map((w) => w.id)) }))

  // scroll over the strip to step workspaces
  const scroll = (box: Gtk.Box) => {
    const c = new Gtk.EventControllerScroll({ flags: Gtk.EventControllerScrollFlags.VERTICAL })
    c.connect("scroll", (_c: unknown, _dx: number, dy: number) => {
      stepWorkspace(dy > 0 ? 1 : -1)
      return true
    })
    box.add_controller(c)
  }

  return (
    <box class="ws-strip" spacing={3} $={scroll}>
      <For each={ids}>
        {(id) => (
          <button
            class={state((s) => `ws-btn${id === s.active ? " active" : ""}${s.occ.has(id) ? " occupied" : ""}`)}
            label={String(id)}
            onClicked={() => gotoWorkspace(id)}
          />
        )}
      </For>
    </box>
  )
}

function ActiveWindow() {
  const focused = hyprFocusedClient()
  const title = createComputed(() => (focused()?.title ?? "").slice(0, 46))
  return (
    <label
      class="window-title"
      visible={createComputed(() => config().bar.showWindowTitle && title() !== "")}
      label={title}
    />
  )
}

// official AGS pattern: the dbusmenu action group can be replaced at runtime
function initTray(btn: Gtk.MenuButton, item: Tray.TrayItem, onMenu?: (open: boolean) => void) {
  const sync = () => {
    btn.menuModel = item.menuModel
    btn.insert_action_group("dbusmenu", item.actionGroup)
  }
  sync()
  item.connect("notify::action-group", sync)
  item.connect("notify::menu-model", sync)
  // an autohiding bar must stay put while one of its menus is open
  btn.connect("notify::active", () => onMenu?.(btn.active))
}

function TrayBox({ onMenu }: { onMenu?: (open: boolean) => void }) {
  const items = createBinding(Tray.get_default(), "items")
  return (
    <box class="tray-box" spacing={2} visible={config((c) => c.bar.showTray)}>
      <For each={items}>
        {(item) => (
          <menubutton class="tray-btn" tooltipMarkup={createBinding(item, "tooltipMarkup")} $={(self) => initTray(self, item, onMenu)}>
            <image gicon={createBinding(item, "gicon")} pixelSize={16} />
          </menubutton>
        )}
      </For>
    </box>
  )
}

function BatteryPill() {
  const bat = getBattery()
  if (!bat) return <box visible={false} /> // no UPower: no battery widget
  const pct = createBinding(bat, "percentage")
  return (
    <box spacing={4} visible={createBinding(bat, "isPresent")}>
      <image iconName={createBinding(bat, "batteryIconName")} pixelSize={15} />
      <label class="status-sub" label={pct((v) => `${Math.round(v * 100)}%`)} />
    </box>
  )
}

function Status() {
  const net = Network.get_default()
  const wifi = createBinding(net, "wifi")
  const wired = createBinding(net, "wired")
  const primary = createBinding(net, "primary")
  // wired-only machines must not show a "wifi offline" icon
  const netIcon = createComputed(() =>
    primary() === Network.Primary.WIRED
      ? wired()?.iconName || "network-wired-symbolic"
      : wifi()?.iconName || (wired() ? "network-wired-disconnected-symbolic" : "network-wireless-offline-symbolic"),
  )

  const btOn = createBinding(Bluetooth.get_default(), "isPowered")
  const volIcon = speakerProp("volumeIcon")((i) => i || "audio-volume-muted-symbolic")

  return (
    <button class="status-group" onClicked={() => toggle("ypsilon-control")} tooltipText="control center">
      <box spacing={8}>
        <image iconName={netIcon} pixelSize={15} />
        <image iconName="bluetooth-active-symbolic" pixelSize={15} visible={btOn} />
        <image iconName={volIcon} pixelSize={15} />
        <BatteryPill />
      </box>
    </button>
  )
}

function Sysinfo() {
  return (
    <button
      class="sys-pill"
      visible={config((c) => c.bar.showSysinfo)}
      onClicked={() => toggle("ypsilon-dashboard")}
      tooltipText={createComputed(() => `cpu ${pct(cpu())} · mem ${pct(mem())}${temp() === null ? "" : ` · ${temp()}°C`}`)}
    >
      <box spacing={10}>
        <box spacing={4}>
          <label class="sys-key" label="cpu" />
          <label class="status-sub" label={cpu((v) => pct(v))} />
        </box>
        <box spacing={4}>
          <label class="sys-key" label="ram" />
          <label class="status-sub" label={mem((v) => pct(v))} />
        </box>
      </box>
    </button>
  )
}

function UpdatesBadge() {
  const n = updates((l) => l.length)
  return (
    <button
      class="icon-btn updates-btn"
      visible={createComputed(() => config().bar.showUpdates && n() > 0)}
      onClicked={() => openSettings("updates")}
      tooltipText={n((c) => `${c} update${c === 1 ? "" : "s"} available`)}
    >
      <box spacing={5}>
        <image iconName="software-update-available-symbolic" pixelSize={14} />
        <label class="status-sub" label={n((c) => String(c))} />
      </box>
    </button>
  )
}

function Bell() {
  const notifd = getNotifd()
  const list = createBinding(notifd, "notifications")
  const dnd = createBinding(notifd, "dontDisturb")
  const icon = dnd((d) => (d ? "notifications-disabled-symbolic" : "preferences-system-notifications-symbolic"))
  return (
    <button class="icon-btn" onClicked={() => toggle("ypsilon-notif-center")} tooltipText="notifications">
      <box spacing={5}>
        <image iconName={icon} pixelSize={15} />
        <label class="badge" visible={list((l) => l.length > 0)} label={list((l) => String(l.length))} />
      </box>
    </button>
  )
}

function MediaMini() {
  const players = createBinding(Mpris.get_default(), "players")
  const one = createComputed(() => players().find((p) => p.available) ?? null)
  const playing = createComputed(() => one()?.playbackStatus === Mpris.PlaybackStatus.PLAYING)
  return (
    <box class="media-mini" spacing={6} visible={createComputed(() => config().bar.showMedia && one() !== null)}>
      <label class="accent" label="♪" visible={createComputed(() => !(config().bar.showVisualizer && playing()))} />
      <box visible={config((c) => c.bar.showVisualizer)}>
        <Visualizer width={44} height={14} when={playing} />
      </box>
      <label class="media-title" label={one((p) => (p?.title || "—").slice(0, 28))} />
      <button
        class="icon-btn"
        onClicked={() => {
          const p = one()
          if (p) togglePlay(p)
        }}
      >
        <image
          iconName={playing((p) => (p ? "media-playback-pause-symbolic" : "media-playback-start-symbolic"))}
          pixelSize={13}
        />
      </button>
    </box>
  )
}

/** widgets contributed by plugins (api.bar.add); a failing widget only drops itself */
function PluginSlot({ position }: { position: "left" | "center" | "right" }) {
  const items = createComputed(() =>
    barItems()
      .filter((i) => i.position === position)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
  )
  return (
    <box class="plugin-slot" spacing={6}>
      <For each={items}>
        {(item) => guarded(`plugin ${item.pluginId} bar widget`, () => item.widget()) ?? <box />}
      </For>
    </box>
  )
}

function RecordingDot() {
  // event driven (no polling): record.sh creates/deletes the pid file
  const isRecording = () => GLib.file_test(RECORD_PID, GLib.FileTest.EXISTS)
  const [recording, setRecording] = createState(isRecording())
  onCleanup(watchFile(RECORD_PID, () => setRecording(isRecording())))
  return (
    <button class="rec-btn" visible={recording} onClicked={toggleRecording} tooltipText="recording — click to stop">
      <box spacing={6}>
        <image iconName="media-record-symbolic" pixelSize={13} />
        <label class="status-sub" label="REC" />
      </box>
    </button>
  )
}

export default function Bar({ gdkmonitor }: { gdkmonitor: Gdk.Monitor }) {
  let win: Astal.Window
  const { TOP, BOTTOM, LEFT, RIGHT } = Astal.WindowAnchor
  // position and autohide apply live from Settings → Bar (no restart)
  const bottom = configValue((c) => c.bar.position === "bottom")
  const autohide = configValue((c) => c.bar.autohide)
  const [revealed, setRevealed] = createState(true)

  // Autohide: while hidden the window shrinks to a 3px strip at the screen edge; the pointer
  // entering it reveals the bar, leaving the bar hides it again. The strip needs a (practically
  // invisible) background: a fully transparent GTK4 layer surface never gets a buffer, receives
  // no pointer events and keeps the shell + compositor busy re-rendering.
  let inside = false
  let menusOpen = 0
  let hideTimer = 0
  const cancelHide = () => {
    if (hideTimer) GLib.source_remove(hideTimer)
    hideTimer = 0
  }
  const show = () => {
    cancelHide()
    setRevealed(true)
  }
  const armHide = (ms = 450) => {
    cancelHide()
    if (!autohide.peek()) return
    hideTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, () => {
      hideTimer = 0
      if (!inside && menusOpen === 0) setRevealed(false)
      return GLib.SOURCE_REMOVE
    })
  }
  const track = (w: Astal.Window) => {
    const c = new Gtk.EventControllerMotion()
    c.connect("enter", () => {
      inside = true
      show()
    })
    c.connect("leave", () => {
      inside = false
      armHide()
    })
    w.add_controller(c)
  }
  const onMenu = (open: boolean) => {
    menusOpen = Math.max(0, menusOpen + (open ? 1 : -1))
    if (!open) armHide()
  }
  // GTK windows grow but never shrink by themselves: give the space back once the bar is gone,
  // otherwise an invisible strip would keep eating clicks at the top of your windows
  // (1×1, not -1×-1: "unset" would also drop the full-width stretch and leave a narrow bar)
  const shrink = (r: Gtk.Revealer) => {
    if (!r.childRevealed) win.set_default_size(1, 1)
  }
  // turning autohide on hides the bar after a moment (also a hint at login that it is there);
  // turning it off brings it back for good
  createEffect(() => (autohide() ? armHide(1500) : show()))
  // peek on workspace switches so you always see where you landed
  const focusedWs = hyprFocusedWorkspace()
  onCleanup(
    focusedWs.subscribe(() => {
      if (!autohide.peek() || inside) return
      show()
      armHide(1200)
    }),
  )
  // root windows are not destroyed automatically: when the monitor is unplugged, the parent
  // <For> in app.tsx disposes this scope and we destroy the window (official AGS pattern)
  onCleanup(() => {
    cancelHide()
    win.destroy()
  })

  const clock = createPoll("", 1000, () => {
    const c = config().bar
    const time = c.clock24h ? (c.showSeconds ? "%H:%M:%S" : "%H:%M") : c.showSeconds ? "%I:%M:%S %p" : "%I:%M %p"
    return GLib.DateTime.new_now_local().format(`%a %d %b · ${time}`) ?? ""
  })

  return (
    <window
      $={(self) => {
        win = self
        track(self)
      }}
      visible
      name={`ypsilon-bar-${gdkmonitor.connector}`}
      namespace="ypsilon-bar"
      class={bottom((b) => `ypsilon-bar${b ? " bottom" : ""}`)}
      gdkmonitor={gdkmonitor}
      exclusivity={autohide((a) => (a ? Astal.Exclusivity.IGNORE : Astal.Exclusivity.EXCLUSIVE))}
      anchor={bottom((b) => (b ? BOTTOM : TOP) | LEFT | RIGHT)}
    >
      <box orientation={Gtk.Orientation.VERTICAL}>
        <box class="sliver" visible={createComputed(() => autohide() && !bottom())} />
        <revealer
          revealChild={revealed}
          transitionType={bottom((b) => (b ? Gtk.RevealerTransitionType.SLIDE_UP : Gtk.RevealerTransitionType.SLIDE_DOWN))}
          transitionDuration={configValue((c) => (c.reduceMotion ? 0 : 220))}
          onNotifyChildRevealed={shrink}
        >
          <centerbox class={bottom((b) => `bar-inner${b ? " bottom" : ""}`)}>
            <box $type="start" class="bar-left" spacing={8}>
              <button class="icon-btn launch-btn" onClicked={() => toggle("ypsilon-launcher")} tooltipText="launcher">
                <label class="launch-logo" label="✦" />
              </button>
              <Workspaces />
              <ActiveWindow />
              <PluginSlot position="left" />
            </box>
            <box $type="center" class="bar-center" spacing={10}>
              <button onClicked={() => toggle("ypsilon-dashboard")} tooltipText="dashboard">
                <label class="clock" label={clock} />
              </button>
              <MediaMini />
              <PluginSlot position="center" />
            </box>
            <box $type="end" class="bar-right" spacing={6}>
              <PluginSlot position="right" />
              <RecordingDot />
              <Sysinfo />
              <UpdatesBadge />
              <TrayBox onMenu={onMenu} />
              <Bell />
              <Status />
              <button class="icon-btn power-btn" onClicked={() => toggle("ypsilon-power")} tooltipText="power">
                <image iconName="system-shutdown-symbolic" pixelSize={15} />
              </button>
            </box>
          </centerbox>
        </revealer>
        <box class="sliver" visible={createComputed(() => autohide() && bottom())} />
      </box>
    </window>
  )
}

/** Minimal bar used when the real one fails to build: clock + launcher + a hint. */
export function FallbackBar({ gdkmonitor }: { gdkmonitor: Gdk.Monitor }) {
  let win: Astal.Window
  onCleanup(() => win.destroy())
  const { TOP, LEFT, RIGHT } = Astal.WindowAnchor
  const clock = createPoll("", 1000, () => GLib.DateTime.new_now_local().format("%H:%M") ?? "")
  return (
    <window $={(self) => (win = self)} visible namespace="ypsilon-bar" class="ypsilon-bar" gdkmonitor={gdkmonitor} exclusivity={Astal.Exclusivity.EXCLUSIVE} anchor={TOP | LEFT | RIGHT}>
      <centerbox class="bar-inner">
        <button $type="start" class="icon-btn launch-btn" onClicked={() => toggle("ypsilon-launcher")}>
          <label class="launch-logo" label="✦" />
        </button>
        <label $type="center" class="clock" label={clock} />
        <label $type="end" class="status-sub" label="bar failed to load · ypsilon logs" />
      </centerbox>
    </window>
  )
}
