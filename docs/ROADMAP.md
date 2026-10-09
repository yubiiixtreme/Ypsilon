# Ypsilon Roadmap

## Done
- [x] Hypr glass base, validated against Hyprland 0.56.2 (`scripts/check.sh`)
- [x] Theme engine (tokens → hypr + css + terminal/launcher extras), runtime hot-reload in the shell
- [x] Shell: bar, launcher, control center, notifications+toasts, OSD, powermenu, overview, calendar
- [x] CLI v0.3: start/try/check/doctor/shot/clip/lock, idempotent session bring-up
- [x] Own login session instead of editing the user's Hyprland config

- [x] Launcher modes + frecency, control-center pages, dashboard, wallpaper picker, keybind cheatsheet, game mode, night light, battery alerts, user config, hyprlock theming, import audit
- [x] Strict typecheck + icon audit, wallpaper-generated themes, command palette, per-app mixer, live Wi-Fi list, album art, hotplug bars, caffeine, layout toggle, smart toast quiet mode, own AGS instance + logs
- [x] Reliability pass: portable paths, null-safe services, crash isolation + supervisor, config diagnostics (did-you-mean), doctor with fix hints, `report`/`health`/`stop`, uninstall, start-hyprland session, Hyprland version gate, non-Arch guidance, shellcheck, CI workflow, checker mutation tests, keybind conflict test, reduceMotion
- [x] Settings app (12 pages, live Hyprland/idle/input control), Updates page (pacman/AUR/flatpak + self-update), plugin system (API v1, isolation, CLI, 3 bundled plugins, docs), weather, cava visualizer, CPU/mem graphs
- [x] Test-suite fix (root `package.json` type:module so Node strips types + loads ESM plugins), calculator with functions/constants/factorial, 3 new plugins (pass/color/clock), ocean + sunset themes, `ypsilon calc` + `ypsilon pw` CLI, full config example

## Next (needs a live `ags run`)
- [ ] First live run, fix runtime/API surprises (see docs/REVIEW.md)
- [ ] Monitor layout / scaling panel
- [ ] Per-monitor popup placement, workspace window thumbnails in the overview
- [ ] Screenshots in the README after the first live run
