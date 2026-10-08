// Settings pages backed by config.json. Compositor-related rows apply to Hyprland live
// (writeConfig -> `ypsilon apply` -> hypr/generated/user.conf + hyprctl reload).
import Gtk from "gi://Gtk"
import PowerProfiles from "gi://AstalPowerProfiles"
import { createBinding } from "ags"
import { execAsync } from "ags/process"
import { Section, SwitchRow, SliderRow, EntryRow, ChoiceRow, ButtonRow, SettingsRow } from "./controls"
import { currentTheme, setCurrentTheme, themeNames, themePalette, setAutoTheme, ROOT } from "../../services/theme"
import { setTheme } from "../../services/system"
import { WallpaperGrid, loadWallpapers } from "../Wallpapers"

const cli = (...a: string[]) => execAsync([`${ROOT}/scripts/ypsilon`, ...a]).catch((e) => printerr(`ypsilon ${a[0]}: ${e}`))
const minutes = (s: number) => (s === 0 ? "off" : s < 60 ? `${s}s` : `${Math.round(s / 6) / 10} min`)

export function GeneralPage() {
  return (
    <box orientation={Gtk.Orientation.VERTICAL} spacing={18}>
      <Section title="Weather">
        <SwitchRow label="Show weather" sub="Dashboard card, powered by Open-Meteo (no account)" path="weather.enabled" />
        <EntryRow label="Location" sub="City name; nothing is fetched until this is set" path="weather.location" placeholder="e.g. Berlin" />
        <ChoiceRow label="Units" path="weather.units" options={[["metric", "°C"], ["imperial", "°F"]]} />
      </Section>
      <Section title="Launcher">
        <EntryRow label="Web search" sub="Used by the ? prefix; %s is the query" path="launcher.webSearch" />
        <SliderRow label="Results" path="launcher.maxResults" min={3} max={12} />
      </Section>
      <Section title="Apps">
        <EntryRow label="Terminal" sub="Empty = auto-detect (foot, kitty, ghostty, alacritty, …)" path="terminal" placeholder="auto" />
      </Section>
      <Section title="Feedback">
        <SliderRow label="OSD duration" path="osdTimeoutMs" min={600} max={6000} step={100} format={(v) => `${(v / 1000).toFixed(1)}s`} />
      </Section>
    </box>
  )
}

function ThemeChip({ name }: { name: string }) {
  const p = themePalette(name)
  const sw = (c: string | undefined) => <box class="swatch" css={`background: ${c ?? "#888"};`} />
  return (
    <button class={currentTheme((cur) => `theme-card${cur === name ? " on" : ""}`)} onClicked={() => setTheme(name).then(() => setCurrentTheme(name))}>
      <box orientation={Gtk.Orientation.VERTICAL} spacing={6}>
        <box class="swatches" css={`background: ${p.bg ?? "#111"};`} spacing={4}>
          {sw(p.primary)}
          {sw(p.accent)}
          {sw(p.fg)}
        </box>
        <label class="settings-sub" label={name.replace("ypsilon-", "")} />
      </box>
    </button>
  )
}

export function AppearancePage() {
  return (
    <box orientation={Gtk.Orientation.VERTICAL} spacing={18} $={() => loadWallpapers()}>
      <Section title="Theme">
        <box class="settings-row" spacing={10}>
          {themeNames().map((n) => (
            <ThemeChip name={n} />
          ))}
        </box>
      </Section>
      <Section title="Wallpaper colors (Material-You style)">
        <ButtonRow label="Generate from wallpaper" sub="Builds a contrast-checked theme from your current wallpaper" button="Generate" icon="applications-graphics-symbolic" onClicked={() => setAutoTheme().then(() => setCurrentTheme("ypsilon-auto"))} />
        <SwitchRow label="Follow wallpaper" sub="Regenerate the theme whenever the wallpaper changes" path="theme.followWallpaper" />
        <SwitchRow label="Light variant" sub="Generated themes use light surfaces" path="theme.autoLight" />
      </Section>
      <Section title="Wallpaper">
        <box class="settings-row">
          <WallpaperGrid maxHeight={300} />
        </box>
      </Section>
      <Section title="Accessibility">
        <SwitchRow label="Reduce motion" sub="No slide/fade animations in the shell or Hyprland" path="reduceMotion" />
      </Section>
    </box>
  )
}

export function BarPage() {
  return (
    <box orientation={Gtk.Orientation.VERTICAL} spacing={18}>
      <Section title="Position">
        <ChoiceRow label="Bar position" sub="Takes effect after a shell restart" path="bar.position" options={[["top", "Top"], ["bottom", "Bottom"]]} />
        <ButtonRow label="Restart shell" button="Restart" icon="view-refresh-symbolic" onClicked={() => cli("restart")} />
        <SliderRow label="Workspaces shown" path="workspaces" min={1} max={10} />
      </Section>
      <Section title="Clock">
        <SwitchRow label="24-hour clock" path="bar.clock24h" />
        <SwitchRow label="Show seconds" path="bar.showSeconds" />
      </Section>
      <Section title="Modules">
        <SwitchRow label="Focused window title" path="bar.showWindowTitle" />
        <SwitchRow label="Media" path="bar.showMedia" />
        <SwitchRow label="Audio visualizer" sub="Needs libastal-cava; only runs while music plays" path="bar.showVisualizer" />
        <SwitchRow label="CPU / memory" path="bar.showSysinfo" />
        <SwitchRow label="System tray" path="bar.showTray" />
        <SwitchRow label="Updates badge" path="bar.showUpdates" />
      </Section>
    </box>
  )
}

export function DesktopPage() {
  return (
    <box orientation={Gtk.Orientation.VERTICAL} spacing={18}>
      <Section title="Windows">
        <SliderRow label="Inner gaps" path="hypr.gapsIn" min={0} max={40} unit="px" />
        <SliderRow label="Outer gaps" path="hypr.gapsOut" min={0} max={60} unit="px" />
        <SliderRow label="Border" path="hypr.borderSize" min={0} max={8} unit="px" />
        <SliderRow label="Corner rounding" path="hypr.rounding" min={0} max={40} unit="px" />
      </Section>
      <Section title="Effects">
        <SwitchRow label="Blur" sub="Glass behind windows and the shell" path="hypr.blur" />
        <SwitchRow label="Shadows" path="hypr.shadows" />
        <SwitchRow label="Dim inactive windows" path="hypr.dimInactive" />
      </Section>
      <Section title="Layout">
        <ButtonRow label="Tiling layout" sub="Switch between dwindle and master (SUPER+M)" button="Toggle" onClicked={() => cli("layout", "toggle")} />
        <ButtonRow label="Game mode" sub="No animations, blur, gaps or rounding until toggled off" button="Toggle" onClicked={() => cli("gamemode", "toggle")} />
      </Section>
    </box>
  )
}

export function InputPage() {
  return (
    <box orientation={Gtk.Orientation.VERTICAL} spacing={18}>
      <Section title="Keyboard">
        <EntryRow label="Layouts" sub="Comma separated, e.g. us,de" path="input.kbLayout" placeholder="us" />
        <EntryRow label="Variants" sub="Per layout, e.g. ,nodeadkeys" path="input.kbVariant" />
        <EntryRow label="Options" sub="e.g. grp:alt_shift_toggle,caps:escape" path="input.kbOptions" />
        <SliderRow label="Repeat rate" path="input.repeatRate" min={5} max={100} unit="/s" />
        <SliderRow label="Repeat delay" path="input.repeatDelay" min={100} max={1500} step={50} unit="ms" />
      </Section>
      <Section title="Mouse & touchpad">
        <SliderRow label="Pointer speed" path="input.sensitivity" min={-1} max={1} step={0.05} />
        <SwitchRow label="Natural scrolling (touchpad)" path="input.naturalScroll" />
      </Section>
      <Section title="Shortcuts">
        <ButtonRow label="Keybind cheatsheet" sub="All shortcuts, read live from keybinds.conf" button="Open" icon="input-keyboard-symbolic" onClicked={() => cli("keys")} />
      </Section>
    </box>
  )
}

export function PowerPage() {
  const pp = PowerProfiles.get_default()
  const active = createBinding(pp, "activeProfile")
  const profiles = createBinding(pp, "profiles")
  return (
    <box orientation={Gtk.Orientation.VERTICAL} spacing={18}>
      <Section title="Power profile">
        <SettingsRow label="Profile" sub={profiles((l) => (l.length ? "power-profiles-daemon" : "power-profiles-daemon is not running"))}>
          <box class="segmented" valign={Gtk.Align.CENTER}>
            {(["power-saver", "balanced", "performance"] as const).map((p) => (
              <button
                class={active((cur) => `seg-btn${cur === p ? " on" : ""}`)}
                visible={profiles((l) => l.some((x) => x.profile === p))}
                label={p === "power-saver" ? "Saver" : p[0].toUpperCase() + p.slice(1)}
                onClicked={() => pp.set_active_profile(p)}
              />
            ))}
          </box>
        </SettingsRow>
      </Section>
      <Section title="When idle (0 = never)">
        <SliderRow label="Dim screen after" path="idle.dimSec" min={0} max={1800} step={30} format={minutes} />
        <SliderRow label="Lock after" path="idle.lockSec" min={0} max={3600} step={30} format={minutes} />
        <SliderRow label="Screen off after" path="idle.screenOffSec" min={0} max={3600} step={30} format={minutes} />
        <SliderRow label="Suspend after" path="idle.suspendSec" min={0} max={7200} step={60} format={minutes} />
      </Section>
      <Section title="Battery">
        <SliderRow label="Low battery warning" path="battery.warnAt" min={5} max={60} unit="%" />
        <SliderRow label="Critical warning" path="battery.criticalAt" min={1} max={30} unit="%" />
      </Section>
    </box>
  )
}
