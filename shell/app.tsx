#!/usr/bin/env -S ags run
// Ypsilon shell entry — AGS v3 + GTK4. One Bar per monitor + toggle windows.
// Run:  ags run ./app.tsx
// CLI:  ags toggle <window-name> · ags request reload-css · ags request osd <volume|brightness>
import app from "ags/gtk4/app"
import base from "./style.scss"
import generated from "./style/_generated.css"
import Bar from "./widgets/Bar"
import Launcher from "./widgets/Launcher"
import ControlCenter from "./widgets/ControlCenter"
import { NotificationCenter, Toast } from "./widgets/Notifications"
import OSD from "./widgets/OSD"
import Powermenu from "./widgets/Powermenu"
import Overview from "./widgets/Overview"
import { showOsd } from "./services/osd"

const css = `${base}\n${generated}`

app.start({
  css,
  requestHandler(argv, response) {
    const [cmd, arg] = argv
    if (cmd === "reload-css") {
      app.reset_css()
      app.apply_css(css)
      response("css reloaded")
      return
    }
    if (cmd === "osd") {
      showOsd(arg === "brightness" ? "brightness" : "volume")
      response("osd shown")
      return
    }
    response("unknown command (try: reload-css, osd <volume|brightness>)")
  },
  main() {
    Launcher()
    ControlCenter()
    NotificationCenter()
    Toast()
    OSD()
    Powermenu()
    Overview()
    app.get_monitors().forEach((_, i) => Bar(i))
  },
})
