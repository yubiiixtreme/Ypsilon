import Gtk from "gi://Gtk"
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
  screenshot, colorPicker, lock, logout, poweroff, cliPath,
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
  const ssid = createComputed(() => (wifi()?.enabled ? wifi()?.ssid || "on" : "off"))
  const wifiOn = createComputed(() => !!wifi()?.enabled)
  const bt = createBinding(Bluetooth.get_default(), "isPowered")
  const dnd = createBinding(getNotifd(), "dontDisturb")
  const game = cliToggle("gamemode", toggleGameMode)
  const night = cliToggle("nightlight", toggleNightlight)
  const caffeine = cliToggle("caffeine", toggleCaffeine)
  const pp = PowerProfiles.get_default()
  const profile = createBinding(pp, "activeProfile")
  const profiles = createBinding(pp, "profiles")
  const always = createComputed(() => true)

  return (
    <Popup
      name="ypsilon-control"
      variant="corner"
      halign={Gtk.Align.END}
      spacing={12}
      onShow={() => {
        setPage("main")
        refreshBrightness()
        for (const t of [game, night, caffeine]) t.refresh()
      }}
    >
      <box orientation={Gtk.Orientation.VERTICAL} spacing={12} visible={page((p) => p === "main")}>
        <label class="title" label="control" halign={Gtk.Align.START} />

        <box spacing={8} homogeneous>
          <Tile icon="network-wireless-symbolic" title="Wi-Fi" sub={ssid} on={wifiOn} onClicked={toggleWifi} onMore={go("wifi")} />
          <Tile icon="bluetooth-symbolic" title="Bluetooth" sub={bt((o) => (o ? "on" : "off"))} on={bt} onClicked={() => toggleBt(bt())} onMore={go("bt")} />
        </box>
        <box spacing={8} homogeneous>
          <Tile icon={volIcon} title="Sound" sub={outName} on={always} onClicked={toggleMute} onMore={go("audio")} />
          <Tile icon="notifications-disabled-symbolic" title="Do not disturb" sub={dnd((d) => (d ? "on" : "off"))} on={dnd} onClicked={() => setDnd(!dnd())} />
        </box>
        <box spacing={8} homogeneous>
          <Tile icon="night-light-symbolic" title="Night light" sub={night.state} on={night.state((s) => s === "on")} onClicked={night.flip} />
          <Tile icon="applications-games-symbolic" title="Game mode" sub={game.state} on={game.state((s) => s === "on")} onClicked={game.flip} />
        </box>
        <box spacing={8} homogeneous>
          <Tile icon="emoji-food-symbolic" title="Caffeine" sub={caffeine.state((c) => (c === "on" ? "staying awake" : "off"))} on={caffeine.state((c) => c === "on")} onClicked={caffeine.flip} />
          <Tile icon="applications-graphics-symbolic" title="Wallpaper colors" sub={currentTheme((t) => (t === "ypsilon-auto" ? "on" : "generate"))} on={currentTheme((t) => t === "ypsilon-auto")} onClicked={() => setAutoTheme().then(() => setCurrentTheme("ypsilon-auto"))} />
        </box>

        <PluginTiles />

        <box class="slider-row" spacing={10}>
          <button class="icon-btn" onClicked={toggleMute}>
            <image iconName={volIcon} pixelSize={16} />
          </button>
          <slider hexpand min={0} max={1} value={vol} onChangeValue={(_s, _scroll, value) => setVolume(value)} />
        </box>
        <box class="slider-row" spacing={10} visible={brightness((b) => b >= 0)}>
          <image iconName="display-brightness-symbolic" pixelSize={16} />
          <slider hexpand min={0.05} max={1} value={brightness((b) => Math.max(b, 0.05))} onChangeValue={(_s, _scroll, value) => setBrightness(value)} />
        </box>

        <box spacing={6} visible={profiles((l) => l.length > 0)}>
          <label class="sub" label="profile" hexpand halign={Gtk.Align.START} />
          {(["power-saver", "balanced", "performance"] as const).map((p) => (
            <button
              class={profile((cur) => `pill-btn${cur === p ? " on" : ""}`)}
              visible={profiles((l) => l.some((x) => x.profile === p))}
              label={p === "power-saver" ? "saver" : p}
              onClicked={() => pp.set_active_profile(p)}
            />
          ))}
        </box>

        <MediaCard />

        <box spacing={6}>
          <label class="sub" label="theme" hexpand halign={Gtk.Align.START} />
          {themeNames().map((n) => (
            <button
              class={currentTheme((cur) => `pill-btn theme-chip${n === cur ? " on" : ""}`)}
              label={n.replace("ypsilon-", "")}
              onClicked={() => setTheme(n).then(() => setCurrentTheme(n))}
            />
          ))}
        </box>

        <box spacing={6}>
          <button class="icon-btn" tooltipText="screenshot region" onClicked={() => { hideWindow("ypsilon-control"); screenshot("select") }}>
            <image iconName="applets-screenshooter-symbolic" pixelSize={15} />
          </button>
          <button class="icon-btn" tooltipText="color picker" onClicked={() => { hideWindow("ypsilon-control"); colorPicker() }}>
            <image iconName="color-select-symbolic" pixelSize={15} />
          </button>
          <button class="icon-btn" tooltipText="wallpapers" onClicked={() => { hideWindow("ypsilon-control"); toggleWindow("ypsilon-wallpapers") }}>
            <image iconName="preferences-desktop-wallpaper-symbolic" pixelSize={15} />
          </button>
          <box hexpand />
          <button class="icon-btn" tooltipText="settings" onClicked={() => { hideWindow("ypsilon-control"); openSettings() }}>
            <image iconName="preferences-system-symbolic" pixelSize={15} />
          </button>
          <button class="icon-btn" tooltipText="lock" onClicked={lock}>
            <image iconName="system-lock-screen-symbolic" pixelSize={15} />
          </button>
          <button class="icon-btn" tooltipText="log out" onClicked={logout}>
            <image iconName="system-log-out-symbolic" pixelSize={15} />
          </button>
          <button class="icon-btn" tooltipText="power off" onClicked={poweroff}>
            <image iconName="system-shutdown-symbolic" pixelSize={15} />
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
