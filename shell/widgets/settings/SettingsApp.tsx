import app from "ags/gtk4/app"
import Gtk from "gi://Gtk"
import { Astal } from "ags/gtk4"
import { createState, createComputed, With } from "ags"
import Popup from "../Popup"
import { GeneralPage, AppearancePage, BarPage, DesktopPage, InputPage, PowerPage } from "./pages"
import UpdatesPage from "./UpdatesPage"
import PluginsPage from "./PluginsPage"
import AboutPage from "./AboutPage"
import WifiPage, { refreshWifi } from "../pages/WifiPage"
import BluetoothPage from "../pages/BluetoothPage"
import AudioPage from "../pages/AudioPage"
import { currentTheme } from "../../services/theme"
import { updates } from "../../services/updates"
import { plugins } from "../../services/plugins"

export const PAGES = [
  ["general", "General", "preferences-system-symbolic"],
  ["appearance", "Appearance", "preferences-desktop-appearance-symbolic"],
  ["bar", "Bar", "view-app-grid-symbolic"],
  ["desktop", "Desktop", "preferences-desktop-display-symbolic"],
  ["input", "Keyboard & mouse", "input-keyboard-symbolic"],
  ["network", "Wi-Fi", "network-wireless-symbolic"],
  ["bluetooth", "Bluetooth", "bluetooth-symbolic"],
  ["sound", "Sound", "audio-volume-high-symbolic"],
  ["power", "Power & idle", "system-shutdown-symbolic"],
  ["updates", "Updates", "software-update-available-symbolic"],
  ["plugins", "Plugins", "application-x-addon-symbolic"],
  ["about", "About", "help-about-symbolic"],
] as const
export type PageId = (typeof PAGES)[number][0]

const [page, setPage] = createState<PageId>("general")
const [search, setSearch] = createState("")

/** open Settings (optionally at a page): `ags request -i ypsilon settings updates` */
export function openSettings(id?: string) {
  if (id && PAGES.some(([p]) => p === id)) setPage(id as PageId)
  if (page.peek() === "network") refreshWifi()
  app.get_window("ypsilon-settings")?.set_visible(true)
}

const noop = () => {}

function Content({ id }: { id: PageId }) {
  switch (id) {
    case "general": return <GeneralPage />
    case "appearance": return <AppearancePage />
    case "bar": return <BarPage />
    case "desktop": return <DesktopPage />
    case "input": return <InputPage />
    case "network": return <box class="embedded-page"><WifiPage onBack={noop} /></box>
    case "bluetooth": return <box class="embedded-page"><BluetoothPage onBack={noop} /></box>
    case "sound": return <box class="embedded-page"><AudioPage onBack={noop} /></box>
    case "power": return <PowerPage />
    case "updates": return <UpdatesPage />
    case "plugins": return <PluginsPage />
    case "about": return <AboutPage />
  }
}

const filteredPages = createComputed(() => {
  const q = search().trim().toLowerCase()
  if (!q) return PAGES
  return PAGES.filter(([id, title]) => id.includes(q) || title.toLowerCase().includes(q))
})

function NavButton({ id, title, icon }: { id: PageId; title: string; icon: string }) {
  const badge = createComputed(() =>
    id === "updates" ? (updates().length ? String(updates().length) : "")
    : id === "plugins" ? (plugins().some((p) => p.status === "error") ? "!" : "")
    : "",
  )
  return (
    <button class={page((p) => `nav-btn${p === id ? " on" : ""}`)} onClicked={() => { setPage(id); if (id === "network") refreshWifi() } }>
      <box spacing={10}>
        <image iconName={icon} pixelSize={16} />
        <label label={title} hexpand halign={Gtk.Align.START} />
        <label class="badge" visible={badge((b) => b !== "")} label={badge} />
      </box>
    </button>
  )
}

// The Ypsilon control panel. SUPER+I, the gear in the control center, or `ypsilon settings [page]`.
export default function SettingsApp() {
  const title = page((p) => PAGES.find(([id]) => id === p)?.[1] ?? "")
  const activeThemeName = currentTheme((t) => t.replace("ypsilon-", ""))
  return (
    <Popup name="ypsilon-settings" variant="panel" valign={Gtk.Align.CENTER} keymode={Astal.Keymode.ON_DEMAND} spacing={0}>
      <box class="settings-root">
        <box class="settings-header" orientation={Gtk.Orientation.HORIZONTAL} hexpand>
          <box orientation={Gtk.Orientation.VERTICAL} spacing={2} valign={Gtk.Align.CENTER}>
            <label class="settings-brand" label="✦ Ypsilon Settings" halign={Gtk.Align.START} />
            <label class="settings-sub" label={`theme · ${activeThemeName}`} halign={Gtk.Align.START} />
          </box>
          <entry class="settings-search" primaryIconName="edit-find-symbolic" placeholderText="Search settings…" text={search} onNotifyText={({ text }) => setSearch(text)} />
        </box>
        <box class="settings-body" orientation={Gtk.Orientation.HORIZONTAL} hexpand vexpand>
          <box class="settings-nav" orientation={Gtk.Orientation.VERTICAL} spacing={2}>
            {filteredPages().map(([id, t, icon]) => (
              <NavButton id={id} title={t} icon={icon} />
            ))}
            <label class="settings-nav-foot" label={`${filteredPages().length} of ${PAGES.length} pages`} halign={Gtk.Align.START} />
          </box>
          <box class="settings-main" orientation={Gtk.Orientation.VERTICAL} hexpand>
            <label class="settings-page-title" label={title} halign={Gtk.Align.START} />
            <scrolledwindow hscrollbarPolicy={Gtk.PolicyType.NEVER} vexpand>
              <box class="settings-page">
                <With value={page}>{(id) => <Content id={id} />}</With>
              </box>
            </scrolledwindow>
          </box>
        </box>
      </box>
    </Popup>
  )
}
