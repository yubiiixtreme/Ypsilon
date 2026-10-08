#!/usr/bin/env -S ags run
// Ypsilon shell entry — AGS v3 + GTK4. One Bar per monitor + popup windows.
// Run:  ags run ./app.tsx
// CLI:  ags toggle -i ypsilon <window> · ags request -i ypsilon reload-css|osd <volume|brightness>
import app from "ags/gtk4/app"
import { createBinding, For, This } from "ags"
import { monitorFile } from "ags/file"
import GLib from "gi://GLib"
import Bar, { FallbackBar } from "./widgets/Bar"
import Launcher from "./widgets/Launcher"
import ControlCenter from "./widgets/ControlCenter"
import Dashboard from "./widgets/Dashboard"
import Wallpapers from "./widgets/Wallpapers"
import Cheatsheet from "./widgets/Cheatsheet"
import { NotificationCenter, Toast } from "./widgets/Notifications"
import OSD from "./widgets/OSD"
import Powermenu from "./widgets/Powermenu"
import Overview from "./widgets/Overview"
import SettingsApp, { openSettings } from "./widgets/settings/SettingsApp"
import { showOsd } from "./services/osd"
import { refreshBrightness } from "./services/brightness"
import { initConfig, configProblems } from "./services/config"
import { startSysinfo } from "./services/sysinfo"
import { startBatteryWatch } from "./services/battery"
import { guarded, healthReport } from "./services/health"
import { startPlugins, runPluginCommand, rescanPlugins } from "./services/plugins"
import { startUpdateChecks } from "./services/updates"
import { startWeather } from "./services/weather"
import { baseCssPath, generatedCssPath, readCss, readTokens, setCurrentTheme } from "./services/theme"

// CSS is read from disk (not bundled) so theme switches and style edits apply live.
function reloadCss() {
  const css = readCss()
  if (css === "") return false
  app.reset_css()
  app.apply_css(css)
  setCurrentTheme(readTokens().active ?? "ypsilon-dark")
  return true
}

let debounce = 0
const onStyleChange = () => {
  if (debounce) return
  debounce = 1
  GLib.timeout_add(GLib.PRIORITY_DEFAULT, 120, () => {
    debounce = 0
    reloadCss()
    return GLib.SOURCE_REMOVE
  })
}

app.start({
  // own DBus instance: `ags toggle -i ypsilon <window>` never hits another AGS config
  instanceName: "ypsilon",
  requestHandler(argv, response) {
    const [cmd, arg] = argv
    if (cmd === "reload-css") return response(reloadCss() ? "css reloaded" : "css reload failed (see log)")
    if (cmd === "health") return response(healthReport())
    if (cmd === "settings") return response((openSettings(arg), "settings opened"))
    if (cmd === "plugin") return response(runPluginCommand(argv.slice(1)))
    if (cmd === "plugins-rescan") return response((rescanPlugins(), "rescanned"))
    if (cmd === "config") return response(configProblems().join("\n") || "config ok")
    if (cmd === "osd") {
      showOsd(arg === "brightness" ? "brightness" : "volume")
      return response("osd shown")
    }
    response("unknown command (try: reload-css, health, config, settings [page], plugin …, osd <volume|brightness>)")
  },
  main() {
    guarded("css", () => {
      reloadCss()
      monitorFile(generatedCssPath(), onStyleChange)
      monitorFile(baseCssPath(), onStyleChange)
    })
    guarded("config", initConfig)
    guarded("sysinfo", startSysinfo)
    guarded("battery alerts", startBatteryWatch)
    guarded("brightness", refreshBrightness)
    guarded("update checks", startUpdateChecks)
    guarded("weather", startWeather)

    // each window is isolated: a failure is logged + notified, the rest keeps working
    const components: [string, () => unknown][] = [
      ["Launcher", Launcher], ["ControlCenter", ControlCenter], ["Dashboard", Dashboard],
      ["Wallpapers", Wallpapers], ["Cheatsheet", Cheatsheet], ["NotificationCenter", NotificationCenter],
      ["Toasts", Toast], ["OSD", OSD], ["Powermenu", Powermenu], ["Overview", Overview], ["Settings", SettingsApp],
    ]
    for (const [name, build] of components) guarded(name, build)
    // plugins last: they contribute into the bar/launcher/control center built above
    guarded("plugins", startPlugins)
    // one bar per monitor; follows hotplug (bars are created/destroyed as monitors come and go)
    const monitors = createBinding(app, "monitors")
    return (
      <For each={monitors}>
        {(monitor) => (
          <This this={app}>
            {guarded(`Bar(${monitor.connector})`, () => <Bar gdkmonitor={monitor} />, () => <FallbackBar gdkmonitor={monitor} />)}
          </This>
        )}
      </For>
    )
  },
})
