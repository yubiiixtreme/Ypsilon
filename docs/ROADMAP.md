# Ypsilon Roadmap — daily sessions

## Day 1 — Foundation (today, DONE when checked)
- [x] Repo scaffold locally, no GitHub
- [ ] `hypr/` glass+rounded+animated base (safe to source)
- [ ] `shell/` AGS minimal Bar (clock + workspaces) running via `ags run`
- [ ] `themes/tokens.json` v1
- [ ] `scripts/ypsilon` CLI v0.1 (help, theme list, reload, bar toggle)
- [ ] `install-deps.sh` tested on Arch

## Day 2 — Theme engine
- [ ] gen-theme script (tokens → hypr.conf + scss vars)
- [ ] 3 themes: ypsilon-dark, ypsilon-light, neon-gaming
- [ ] wallpaper switch + pywal/matugen hook
- [ ] GTK + foot/kitty + fuzzel theming

## Day 3 — Bar v1 (usable daily)
- [ ] Workspaces (animated pills, occupied/urgent states)
- [ ] Tray, network, bluetooth, audio, battery
- [ ] Clock + calendar popup
- [ ] Media widget (Mpris, cover art, progress)

## Day 4 — Launcher (Spotlight killer)
- [ ] Fuzzy apps (AstalApps), files, calc, emoji, clipboard
- [ ] SUPER+Space, animations, preview pane
- [ ] Actions: copy, open, run-command

## Day 5 — ControlCenter + Notifications
- [ ] Sliders (vol/bright), toggles (wifi/bt/dnd/night)
- [ ] Notifd center + history + do-not-disturb
- [ ] Quick settings pages

## Day 6 — Eye candy
- [ ] Overview (workspaces grid, SUPER+Tab)
- [ ] OSD (volume/brightness popups)
- [ ] Powermenu (glass, blur bg)
- [ ] Lockscreen (hyprlock) + login greet

## Day 7 — Polish + install
- [ ] `install.sh` (link with backup, paru deps, systemd)
- [ ] `ypsilon doctor` health checks
- [ ] Decide GitHub push + screenshots + release v0.1

Each day: build locally, test with `hyprctl reload` + `ags run`, no push until Day 7.
