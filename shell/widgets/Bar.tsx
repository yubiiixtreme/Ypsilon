import Gtk from "gi://Gtk"
import GLib from "gi://GLib"
import { Astal } from "ags/gtk4"
import { createBinding, createComputed, createState, For, onCleanup } from "ags"
import Gdk from "gi://Gdk"
import { createPoll } from "ags/time"
import Tray from "gi://AstalTray"
import Network from "gi://AstalNetwork"
import Bluetooth from "gi://AstalBluetooth"
import Mpris from "gi://AstalMpris"
import { hyprWorkspaces, hyprFocusedWorkspace, hyprFocusedClient, gotoWorkspace, stepWorkspace } from "../services/hypr"
import { defaultSpeaker } from "../services/audio"
import { getBattery } from "../services/battery"
import { getNotifd } from "../services/notif"
import { togglePlay } from "../services/media"
import { toggleWindow as toggle } from "../services/shell"
import { config } from "../services/config"
import { cpu, mem, temp } from "../services/sysinfo"
import { pct } from "../lib/sysinfo"
import { toggleRecording } from "../services/system"
import { barItems } from "../services/plugins"
import { updates } from "../services/updates"
import { openSettings } from "./settings/SettingsApp"
import Visualizer from "./Visualizer"
import { guarded } from "../services/health"

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
function initTray(btn: Gtk.MenuButton, item: Tray.TrayItem) {
  const sync = () => {
    btn.menuModel = item.menuModel
    btn.insert_action_group("dbusmenu", item.actionGroup)
  }
  sync()
  item.connect("notify::action-group", sync)
  item.connect("notify::menu-model", sync)
}

function TrayBox() {
  const items = createBinding(Tray.get_default(), "items")
  return (
    <box class="tray-box" spacing={2} visible={config((c) => c.bar.showTray)}>
      <For each={items}>
        {(item) => (
          <menubutton class="tray-btn" tooltipMarkup={createBinding(item, "tooltipMarkup")} $={(self) => initTray(self, item)}>
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
  const speaker = defaultSpeaker()
  const volIcon = createComputed(() => speaker()?.volumeIcon || "audio-volume-muted-symbolic")

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
          <image iconName="computer-symbolic" pixelSize={13} />
          <label class="status-sub" label={cpu((v) => pct(v))} />
        </box>
        <box spacing={4}>
          <image iconName="drive-harddisk-symbolic" pixelSize={13} />
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
  const recording = createPoll(false, 1000, () => GLib.file_test(RECORD_PID, GLib.FileTest.EXISTS))
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
  // root windows are not destroyed automatically: when the monitor is unplugged, the parent
  // <For> in app.tsx disposes this scope and we destroy the window (official AGS pattern)
  const { TOP, BOTTOM, LEFT, RIGHT } = Astal.WindowAnchor
  const bottom = config().bar.position === "bottom" // position change needs a shell restart
  const autoHide = config().bar.autohide // same: restart to apply
  const [revealed, setRevealed] = createState(!autoHide)
  let hideTimer = 0
  const cancelHide = () => {
    if (hideTimer) {
      GLib.source_remove(hideTimer)
      hideTimer = 0
    }
  }
  const showBar = () => {
    cancelHide()
    setRevealed(true)
  }
  const armHide = () => {
    if (!autoHide) return
    cancelHide()
    hideTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 450, () => {
      hideTimer = 0
      setRevealed(false)
      return GLib.SOURCE_REMOVE
    })
  }
  // hover tracking without JSX signal props: plain GTK controllers (Gtk-4 API, no guessing)
  const hover = (enter: () => void, leave?: () => void) => (box: Gtk.Box | Gtk.CenterBox) => {
    const c = new Gtk.EventControllerMotion()
    c.connect("enter", enter)
    if (leave) c.connect("leave", leave)
    box.add_controller(c)
  }
  onCleanup(() => {
    cancelHide()
    win.destroy()
  })
  const clock = createPoll("", 1000, () => {
    const c = config().bar
    const time = c.clock24h ? (c.showSeconds ? "%H:%M:%S" : "%H:%M") : c.showSeconds ? "%I:%M:%S %p" : "%I:%M %p"
    return GLib.DateTime.new_now_local().format(`%a %d %b · ${time}`) ?? ""
  })

  const revealAnim = bottom ? Gtk.RevealerTransitionType.SLIDE_UP : Gtk.RevealerTransitionType.SLIDE_DOWN

  return (
    <window
      $={(self) => (win = self)}
      visible
      name={`ypsilon-bar-${gdkmonitor.connector}`}
      namespace="ypsilon-bar"
      class={`ypsilon-bar${bottom ? " bottom" : ""}`}
      gdkmonitor={gdkmonitor}
      exclusivity={autoHide ? Astal.Exclusivity.IGNORE : Astal.Exclusivity.EXCLUSIVE}
      anchor={(bottom ? BOTTOM : TOP) | LEFT | RIGHT}
    >
      <box orientation={Gtk.Orientation.VERTICAL}>
        {autoHide && !bottom && <box class="sliver" $={hover(showBar)} />}
        <revealer
          revealChild={revealed}
          transitionType={revealAnim}
          transitionDuration={250}
        >
          <centerbox class={`bar-inner${bottom ? " bottom" : ""}`} $={hover(showBar, armHide)}>
        <box $type="start" class="bar-left" spacing={8}>
          <button class="icon-btn launch-btn" onClicked={() => toggle("ypsilon-launcher")} tooltipText="launcher">
            <label class="launch-logo" label="✦" />
          </button>
          <Workspaces />
          <ActiveWindow />
          <PluginSlot position="left" />
        </box>
        <box $type="center" class="bar-center" spacing={10}>
          <button onClicked={() => toggle("ypsilon-dashboard")}>
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
          <TrayBox />
          <Bell />
          <Status />
          <button class="icon-btn power-btn" onClicked={() => toggle("ypsilon-power")} tooltipText="power">
            <image iconName="system-shutdown-symbolic" pixelSize={15} />
          </button>
        </box>
      </centerbox>
        </revealer>
        {autoHide && bottom && <box class="sliver" $={hover(showBar)} />}
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
