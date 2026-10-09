# Ypsilon Review Guide

## Verified so far (machine-checked, `scripts/check.sh`)

- [x] Hypr conf parses under Hyprland 0.56.2 (`--verify-config`) — caught 17 real errors from old syntax
- [x] CSS parses under GTK 4.22, every `@y_*` color defined
- [x] **Strict TypeScript type-check** against real Gtk 4 / GLib / Gnim 1.9.1 / AGS 3.1.2 types; Astal types
      hand-written from the Astal sources (`tools/typecheck/astal.d.ts`) — every Astal property used was checked there
- [x] Every relative import resolves; every icon name exists in Adwaita
- [x] Unit tests: calculator, config merge, /proc parsing, app ranking, palette actions, keybind parser, nmcli parsing, battery alerts, wallpaper palette (contrast ≥ WCAG targets)
- [x] Theme switch (dark/neon/light/auto) regenerates cleanly and re-validates
- [x] Patterns aligned with the official AGS examples: click-away via `compute_bounds`, tray action-group refresh, per-monitor `<For>` bars with `onCleanup`
- [x] Null-safety from Astal's source: `Hyprland.get_default()`, `Battery.get_default()`, `Wp.get_default()`, default speaker, focused client/workspace can be null → typed as such, 36 crash sites fixed (widgets degrade instead of throwing)
- [x] Crash isolation (per-component `guarded`, fallback bar), shell supervisor (preflight, backoff restarts, gives up after 5 crashes/2 min)
- [x] Works from any clone location (relocation test), hermetic CLI tests incl. idempotent `start`/`stop`, mutation tests prove every checker can fail
- [x] Bug found via Astal source: `Astal.Slider` fires `change-value` before `value` updates → sliders now use the signal's value argument

## NOT verified — `ags` is not installed here, nothing has run yet

Remaining risks: libastal-hyprland vs. Hyprland 0.56 IPC; the installed libastal version vs. the source the
types were written from (e.g. older builds may lack a property → a console error, fix in astal.d.ts + widget).

The shell has never been executed. Type-checking needs `ags types`. First live run is the real test:

```bash
./scripts/install-deps.sh     # sudo + AUR
./scripts/ypsilon doctor      # every typelib should say OK
./scripts/ypsilon try         # nested preview — your session is untouched
```

Verify-live list (APIs used from memory of Astal/Gnim docs; fix whatever the console says):
- [ ] launcher: focus on open, ↑↓/Enter, icons, `=2+2`, `:foot`
- [ ] click-outside closes popups; clicks inside a card do NOT close it (GestureClick claim)
- [ ] tray: `menubutton` + `insert_action_group("dbusmenu", …)` shows app menus
- [ ] bar status icons: `wifi.iconName`, `speaker.volumeIcon`, `bat.batteryIconName`, `bt.isPowered`
- [ ] workspaces: scroll over the strip switches; extra occupied workspaces appear
- [ ] control center: tiles, volume/brightness sliders (brightnessctl), power profile row, media card, theme chips switch the live shell
- [ ] notifications: toast stack, DND suppresses non-critical, center scrolls, actions fire
- [ ] OSD shows from media keys (volume + brightness)
- [ ] dashboard opens from the clock (calendar, stats update every 2s, media)
- [ ] launcher modes: `;` clipboard, `@` windows, `?` web, empty query shows your most-used apps
- [ ] control center pages: Wi-Fi list/connect (+ password row), Bluetooth connect, Sound output/input switch
- [ ] game mode / night light tiles reflect state (`ypsilon gamemode status`)
- [ ] wallpaper picker thumbnails render + apply; cheatsheet lists binds
- [ ] `~/.config/ypsilon/config.json` edits apply live (bar position/workspaces need restart)
- [ ] popups slide in (Revealer); overview lists windows and focuses them
- [ ] wallpaper themes: `ypsilon theme auto --apply`; the "Wallpaper colors" tile; `theme.followWallpaper`
- [ ] per-app mixer sliders, Bluetooth battery %, album art + progress
- [ ] command palette rows in the launcher (type "lock", "neon")
- [ ] toasts stay quiet over a fullscreen video; REC pill while `ypsilon record` runs
- [ ] unplug/replug a monitor: bars follow
- [ ] Settings (`SUPER+I`): every page opens; Desktop sliders change gaps/rounding live; keyboard layout applies; idle timers regenerate hypridle
- [ ] Updates page lists pending pacman/AUR/flatpak updates (verified offline: real checkupdates/paru output parses 100%); "Update all" opens a terminal
- [ ] Plugins: enable Pomodoro (bar timer + tile + `pomo` in launcher), Quick links (`!wiki`), Dev ports (`port`); disable removes them without restart
- [ ] Weather card after setting a location; visualizer bars move while music plays (and stop capturing when paused)
- [ ] no console errors: `ypsilon logs`

## Publishing

Before pushing: `./scripts/check.sh && tests/checkers.test.sh`. `.github/workflows/check.yml` runs the same on every push.

## Daily-drive

Ypsilon does not edit your Hyprland config (yours may be Lua). `./scripts/install.sh` registers an
"Ypsilon" login session; pick it at your display manager. Revert: delete `/usr/share/wayland-sessions/ypsilon.desktop`.

## Learned from live runs

- A layer window whose content renders nothing (e.g. a fully transparent hover strip) never gets a
  real surface: Hyprland lists it as an empty 200×200 layer, it receives no pointer events, and the
  shell re-renders it in a loop (~120 wakeups/s, plus constant compositor frames → hot laptop).
  Anything meant to be invisible but hoverable needs a tiny alpha (`rgba(0,0,0,0.01)`).
- GTK4 windows grow but never shrink on their own: after hiding content, `set_default_size(1, 1)`
  (not `-1, -1`, which also drops the full-width stretch of a left+right anchored bar).
- `ags/file` `monitorFile` stops for good once the file is deleted → `services/watch.ts` watches the folder.
- No infinite CSS animations: each one redraws its window every frame for as long as the shell runs.

## Known gaps

- hyprlock colors follow the theme (lock-current.conf) but hyprlock itself can't be validated offline.
- Wi-Fi password is passed to `nmcli` as an argument (briefly visible in `ps`).
- Single-monitor assumption for popups (they open on the focused output by compositor default).
