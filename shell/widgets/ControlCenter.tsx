import Gtk from "gi://Gtk"
import Gdk from "gi://Gdk"
import GdkPixbuf from "gi://GdkPixbuf"
import GLib from "gi://GLib"
import { Accessor, createBinding, createComputed, createState, For } from "ags"
import { execAsync } from "ags/process"
import Network from "gi://AstalNetwork"
import Bluetooth from "gi://AstalBluetooth"
import PowerProfiles from "gi://AstalPowerProfiles"
import { speakerProp, setVolume, toggleMute } from "../services/audio"
import { shortDeviceName } from "../lib/audio"
import { brightness, refreshBrightness, setBrightness } from "../services/brightness"
import { getNotifd, setDnd } from "../services/notif"
import { currentTheme, setCurrentTheme, themeNames, setAutoTheme } from "../services/theme"
import {
  toggleWifi, toggleBt, setTheme, toggleGameMode, toggleNightlight, toggleCaffeine,
  screenshot, colorPicker, cliPath,
} from "../services/system"
import { toggleWindow, hideWindow } from "../services/shell"
import { openSettings } from "./settings/SettingsApp"
import Popup from "./Popup"
import { tiles as pluginTiles } from "../services/plugins"
import { guarded } from "../services/health"
import MediaCard from "./MediaCard"
import WifiPage, { refreshWifi } from "./pages/WifiPage"
import BluetoothPage from "./pages/BluetoothPage"
import AudioPage from "./pages/AudioPage"

type Str = string | Accessor<string>
type Page = "main" | "wifi" | "bt" | "audio"

/** Toggle tile; optional chevron opens a detail page. */
function Tile(props: { icon: Str; title: string; sub: Str; on: Accessor<boolean>; onClicked: () => void; onMore?: () => void }) {
  return (
    <box class={props.on((o) => `tile${o ? " on" : ""}`)} hexpand>
      <button class="tile-main" onClicked={props.onClicked} hexpand>
        <box spacing={10}>
          <image iconName={props.icon} pixelSize={20} />
          <box orientation={Gtk.Orientation.VERTICAL} valign={Gtk.Align.CENTER}>
            <label class="tile-title" label={props.title} halign={Gtk.Align.START} />
            <label class="tile-sub" label={props.sub} halign={Gtk.Align.START} />
          </box>
        </box>
      </button>
      {props.onMore && (
        <button class="tile-more" onClicked={props.onMore}>
          <image iconName="go-next-symbolic" pixelSize={14} />
        </button>
      )}
    </box>
  )
}

const FACE = `${GLib.get_home_dir()}/.face`
const displayName = () => {
  const real = GLib.get_real_name()
  return real && real !== "Unknown" ? real : GLib.get_user_name()
}
/** "3 h 12 min" since boot */
function uptime(): string {
  const [ok, data] = GLib.file_get_contents("/proc/uptime")
  if (!ok) return ""
  const s = Math.floor(Number(new TextDecoder().decode(data).split(" ")[0]))
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60)
  return d > 0 ? `up ${d} d ${h} h` : h > 0 ? `up ${h} h ${m} min` : `up ${m} min`
}

/** your picture (~/.face) or your initial on a tinted circle */
function Avatar() {
  try {
    if (GLib.file_test(FACE, GLib.FileTest.EXISTS)) {
      // decoded small (a Gtk.Picture would ask for the photo's full size); Gtk.Image scales it to pixelSize
      const tex = Gdk.Texture.new_for_pixbuf(GdkPixbuf.Pixbuf.new_from_file_at_scale(FACE, 96, 96, true))
      return <image class="avatar" paintable={tex} pixelSize={40} overflow={Gtk.Overflow.HIDDEN} valign={Gtk.Align.CENTER} />
    }
  } catch (e) {
    print(`ypsilon: ~/.face: ${e}`)
  }
  return (
    <box class="avatar" widthRequest={40} heightRequest={40}>
      <label class="avatar-letter" hexpand label={displayName().slice(0, 1).toUpperCase()} />
    </box>
  )
}

/** on/off state of a `ypsilon <verb> status` toggle; refreshed on open and after clicks (no background polling) */
function cliToggle(verb: string, toggle: () => Promise<unknown>) {
  const [state, setState] = createState("off")
  const refresh = () =>
    execAsync(["bash", "-c", `${cliPath} ${verb} status 2>/dev/null || echo off`])
      .then((out) => setState(out.trim() === "on" ? "on" : "off"))
      .catch(() => setState("off"))
  const flip = () => toggle().then(refresh)
  return { state, refresh, flip }
}

/** tiles contributed by plugins (api.controlCenter.addTile), two per row */
function PluginTiles() {
  const rows = createComputed(() => {
    const l = pluginTiles()
    const out: (typeof l)[] = []
    for (let i = 0; i < l.length; i += 2) out.push(l.slice(i, i + 2))
    return out
  })
  const always = createComputed(() => false)
  return (
    <box orientation={Gtk.Orientation.VERTICAL} spacing={8} visible={rows((r) => r.length > 0)}>
      <For each={rows}>
        {(pair) => (
          <box spacing={8} homogeneous>
            {pair.map(
              (t) =>
                guarded(`plugin ${t.pluginId} tile`, () => (
                  <Tile icon={t.icon} title={t.title} sub={t.sub} on={t.active ?? always} onClicked={() => guarded(`plugin ${t.pluginId} tile click`, t.onClick)} />
                )) ?? <box />,
            )}
          </box>
        )}
      </For>
    </box>
  )
}

// Quick settings with Wi-Fi / Bluetooth / Sound detail pages. Toggle: SUPER+C.
export default function ControlCenter() {
  const [page, setPage] = createState<Page>("main")
  const go = (p: Page) => () => {
    setPage(p)
    if (p === "wifi") refreshWifi()
  }

  const vol = speakerProp("volume")((v) => v ?? 0)
  const volIcon = speakerProp("volumeIcon")((i) => i || "audio-volume-medium-symbolic")
  const outName = speakerProp("description")((d) => shortDeviceName(d))

  const wifi = createBinding(Network.get_default(), "wifi")
  const ssid = createComputed(() => (wifi()?.enabled ? wifi()?.ssid || "Not connected" : "Off"))
  const wifiOn = createComputed(() => !!wifi()?.enabled)
  const bt = createBinding(Bluetooth.get_default(), "isPowered")
  const dnd = createBinding(getNotifd(), "dontDisturb")
  const game = cliToggle("gamemode", toggleGameMode)
  const night = cliToggle("nightlight", toggleNightlight)
  const caffeine = cliToggle("caffeine", toggleCaffeine)
  const pp = PowerProfiles.get_default()
  const profile = createBinding(pp, "activeProfile")
  const profiles = createBinding(pp, "profiles")
  const unmuted = speakerProp("mute")((m) => !m)
  const [up, setUp] = createState("")

  return (
    <Popup
      name="ypsilon-control"
      variant="corner"
      halign={Gtk.Align.END}
      spacing={12}
      onShow={() => {
        setPage("main")
        setUp(uptime())
        refreshBrightness()
        for (const t of [game, night, caffeine]) t.refresh()
      }}
    >
      <box orientation={Gtk.Orientation.VERTICAL} spacing={12} visible={page((p) => p === "main")}>
        <box class="cc-header" spacing={12}>
          <Avatar />
          <box orientation={Gtk.Orientation.VERTICAL} valign={Gtk.Align.CENTER} hexpand>
            <label class="cc-user" label={displayName()} halign={Gtk.Align.START} />
            <label class="sub" label={up} halign={Gtk.Align.START} />
          </box>
          <button class="icon-btn" tooltipText="Settings" valign={Gtk.Align.CENTER} onClicked={() => { hideWindow("ypsilon-control"); openSettings() }}>
            <image iconName="preferences-system-symbolic" pixelSize={16} />
          </button>
          <button class="icon-btn" tooltipText="Power" valign={Gtk.Align.CENTER} onClicked={() => { hideWindow("ypsilon-control"); toggleWindow("ypsilon-power") }}>
            <image iconName="system-shutdown-symbolic" pixelSize={16} />
          </button>
        </box>

        <box spacing={8} homogeneous>
          <Tile icon="network-wireless-symbolic" title="Wi-Fi" sub={ssid} on={wifiOn} onClicked={toggleWifi} onMore={go("wifi")} />
          <Tile icon="bluetooth-symbolic" title="Bluetooth" sub={bt((o) => (o ? "On" : "Off"))} on={bt} onClicked={() => toggleBt(bt())} onMore={go("bt")} />
        </box>
        <box spacing={8} homogeneous>
          <Tile icon={volIcon} title="Sound" sub={outName} on={unmuted} onClicked={toggleMute} onMore={go("audio")} />
          <Tile icon="notifications-disabled-symbolic" title="Do not disturb" sub={dnd((d) => (d ? "On" : "Off"))} on={dnd} onClicked={() => setDnd(!dnd())} />
        </box>
        <box spacing={8} homogeneous>
          <Tile icon="night-light-symbolic" title="Night light" sub={night.state((s) => (s === "on" ? "Warm screen" : "Off"))} on={night.state((s) => s === "on")} onClicked={night.flip} />
          <Tile icon="applications-games-symbolic" title="Game mode" sub={game.state((s) => (s === "on" ? "Effects off" : "Off"))} on={game.state((s) => s === "on")} onClicked={game.flip} />
        </box>
        <box spacing={8} homogeneous>
          <Tile icon="emoji-food-symbolic" title="Caffeine" sub={caffeine.state((c) => (c === "on" ? "Staying awake" : "Off"))} on={caffeine.state((c) => c === "on")} onClicked={caffeine.flip} />
          <Tile icon="applications-graphics-symbolic" title="Wallpaper colors" sub={currentTheme((t) => (t === "ypsilon-auto" ? "On" : "Off"))} on={currentTheme((t) => t === "ypsilon-auto")} onClicked={() => setAutoTheme().then(() => setCurrentTheme("ypsilon-auto"))} />
        </box>

        <PluginTiles />

        <box class="slider-row" spacing={8}>
          <button class="icon-btn" tooltipText="Mute" onClicked={toggleMute}>
            <image iconName={volIcon} pixelSize={16} />
          </button>
          <slider hexpand min={0} max={1} value={vol} onChangeValue={(_s, _scroll, value) => setVolume(value)} />
        </box>
        <box class="slider-row" spacing={8} visible={brightness((b) => b >= 0)}>
          <box class="icon-btn">
            <image iconName="display-brightness-symbolic" pixelSize={16} />
          </box>
          <slider hexpand min={0.05} max={1} value={brightness((b) => Math.max(b, 0.05))} onChangeValue={(_s, _scroll, value) => setBrightness(value)} />
        </box>

        <MediaCard />

        <box spacing={8} visible={profiles((l) => l.length > 0)}>
          <label class="section-label" label="Power" hexpand halign={Gtk.Align.START} />
          <box class="segmented">
            {(["power-saver", "balanced", "performance"] as const).map((p) => (
              <button
                class={profile((cur) => `seg-btn${cur === p ? " on" : ""}`)}
                visible={profiles((l) => l.some((x) => x.profile === p))}
                label={p === "power-saver" ? "Saver" : p === "balanced" ? "Balanced" : "Performance"}
                onClicked={() => pp.set_active_profile(p)}
              />
            ))}
          </box>
        </box>

        <box spacing={8}>
          <label class="section-label" label="Theme" hexpand halign={Gtk.Align.START} />
          <box class="segmented">
            {themeNames().map((n) => (
              <button
                class={currentTheme((cur) => `seg-btn${n === cur ? " on" : ""}`)}
                label={n.replace("ypsilon-", "").replace(/^./, (c) => c.toUpperCase())}
                onClicked={() => setTheme(n).then(() => setCurrentTheme(n))}
              />
            ))}
          </box>
        </box>

        <box spacing={8} homogeneous>
          <button class="pill-btn" onClicked={() => { hideWindow("ypsilon-control"); screenshot("select") }}>
            <box spacing={6} halign={Gtk.Align.CENTER}>
              <image iconName="applets-screenshooter-symbolic" pixelSize={14} />
              <label label="Screenshot" />
            </box>
          </button>
          <button class="pill-btn" onClicked={() => { hideWindow("ypsilon-control"); colorPicker() }}>
            <box spacing={6} halign={Gtk.Align.CENTER}>
              <image iconName="color-select-symbolic" pixelSize={14} />
              <label label="Pick color" />
            </box>
          </button>
          <button class="pill-btn" onClicked={() => { hideWindow("ypsilon-control"); toggleWindow("ypsilon-wallpapers") }}>
            <box spacing={6} halign={Gtk.Align.CENTER}>
              <image iconName="preferences-desktop-wallpaper-symbolic" pixelSize={14} />
              <label label="Wallpaper" />
            </box>
          </button>
        </box>
      </box>

      <box visible={page((p) => p === "wifi")}>
        <WifiPage onBack={go("main")} />
      </box>
      <box visible={page((p) => p === "bt")}>
        <BluetoothPage onBack={go("main")} />
      </box>
      <box visible={page((p) => p === "audio")}>
        <AudioPage onBack={go("main")} />
      </box>
    </Popup>
  )
}
