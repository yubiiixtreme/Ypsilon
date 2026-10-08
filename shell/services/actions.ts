// Launcher command palette: system actions searchable by name/keyword.
import { type PaletteAction } from "../lib/actions"
import { themeNames, setAutoTheme } from "./theme"
import { toggleWindow } from "./shell"
import { openSettings } from "../widgets/settings/SettingsApp"
import { getNotifd, setDnd } from "./notif"
import {
  lock, logout, suspend, reboot, poweroff, screenshot, colorPicker, toggleGameMode, toggleNightlight,
  toggleCaffeine, toggleRecording, wallpaperNext, setTheme,
} from "./system"

export type RunnableAction = PaletteAction & { run: () => unknown }

const A = (id: string, title: string, icon: string, keywords: string[], run: () => unknown): RunnableAction => ({ id, title, icon, keywords, run })

export function paletteActions(): RunnableAction[] {
  return [
    A("lock", "Lock screen", "system-lock-screen-symbolic", ["screensaver", "away"], lock),
    A("suspend", "Suspend", "weather-clear-night-symbolic", ["sleep"], suspend),
    A("reboot", "Reboot", "system-reboot-symbolic", ["restart"], reboot),
    A("poweroff", "Power off", "system-shutdown-symbolic", ["shutdown", "turn off"], poweroff),
    A("logout", "Log out", "system-log-out-symbolic", ["exit", "quit session"], logout),
    A("shot", "Screenshot region", "applets-screenshooter-symbolic", ["capture", "print"], () => screenshot("select")),
    A("shotfull", "Screenshot full screen", "applets-screenshooter-symbolic", ["capture", "print"], () => screenshot("full")),
    A("record", "Screen recording", "media-record-symbolic", ["video", "capture", "record"], toggleRecording),
    A("pick", "Color picker", "color-select-symbolic", ["eyedropper", "hex"], colorPicker),
    A("game", "Game mode", "applications-games-symbolic", ["performance", "fps"], toggleGameMode),
    A("night", "Night light", "night-light-symbolic", ["warm", "blue light", "redshift"], toggleNightlight),
    A("caffeine", "Caffeine (stay awake)", "emoji-food-symbolic", ["idle", "awake", "inhibit"], toggleCaffeine),
    A("dnd", "Do not disturb", "notifications-disabled-symbolic", ["silence", "focus"], () => setDnd(!getNotifd().dontDisturb)),
    A("wallnext", "Next wallpaper", "preferences-desktop-wallpaper-symbolic", ["background"], wallpaperNext),
    A("wallpapers", "Wallpapers", "preferences-desktop-wallpaper-symbolic", ["background", "picker"], () => toggleWindow("ypsilon-wallpapers")),
    A("autotheme", "Theme from wallpaper", "applications-graphics-symbolic", ["material", "auto", "colors", "dynamic"], () => setAutoTheme()),
    A("settings", "Settings", "preferences-system-symbolic", ["control panel", "preferences", "config"], () => openSettings()),
    A("updates", "Check for updates", "software-update-available-symbolic", ["upgrade", "pacman", "packages"], () => openSettings("updates")),
    A("plugins", "Plugins", "application-x-addon-symbolic", ["extensions", "addons"], () => openSettings("plugins")),
    A("keys", "Keybind cheatsheet", "input-keyboard-symbolic", ["shortcuts", "help", "binds"], () => toggleWindow("ypsilon-cheatsheet")),
    A("dashboard", "Dashboard", "view-grid-symbolic", ["calendar", "stats"], () => toggleWindow("ypsilon-dashboard")),
    ...themeNames().map((n) => A(`theme-${n}`, `Theme · ${n.replace("ypsilon-", "")}`, "preferences-desktop-appearance-symbolic", ["colors", "theme"], () => setTheme(n))),
  ]
}
