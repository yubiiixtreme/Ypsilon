#!/usr/bin/env -S ags run
// Ypsilon shell entry — Day 1 minimal Bar. Glass + Rounded + Animated.
import app from "ags/gtk4/app"
import css from "./style.scss"
import Bar from "./widgets/Bar"
import Launcher from "./widgets/Launcher"
import ControlCenter from "./widgets/ControlCenter"

app.start({
  css,
  main() {
    // One Bar per monitor; Launcher + ControlCenter are hidden toggle windows
    app.get_monitors().map(Bar)
    Launcher()
    ControlCenter()
  },
})
