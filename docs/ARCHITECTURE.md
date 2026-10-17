# Ypsilon Architecture

## Stack

- **Compositor:** Hyprland 0.56+ (Wayland)
- **Shell:** AGS v3 `aylurs-gtk-shell` + the Astal `-git` libraries Ypsilon imports (io, astal3/4, hyprland, tray, network, bluetooth, battery, mpris, notifd, wireplumber, apps, power-profiles; cava optional) — installed in dependency order by `install-deps.sh`. Brightness has no Astal lib → `brightnessctl`.
- **Lang:** TypeScript + JSX (Gnim) on GJS, GTK4 (`ags/gtk4`)
- **Style:** `shell/style.css` (layout, only `@y_*` named colors) + `shell/style/_generated.css` (`@define-color`s from gen-theme.py). Both are read **from disk at runtime** and hot-reloaded via `watchFile` (services/watch.ts), so `ypsilon theme set X` re-themes the live shell with no rebuild.
- **Theme:** `themes/tokens.json` → `hypr/themes/*.lua` + `_generated.css` + `extras/` (foot/kitty/ghostty/fuzzel/gtk) — see `scripts/gen-theme.py`
- **CLI:** `scripts/ypsilon` (bash) is a thin dispatcher over `scripts/cli/*.sh` (core helpers + styling, session, display, toggles, capture, menu) and Python helpers (`status.py`, `calc.py`). `theme set` regenerates repo files; live-apply needs `--apply`. Night light and gamma share one hyprsunset daemon driven over its IPC (`scripts/cli/display.sh`), stopped again once the screen is neutral.

## Hyprland layering

`hypr/ypsilon.lua` is a **complete** Lua config (Hyprland ≥ 0.55, `require()` modules): generated.paths → core/env → core/monitors → core/general → core/decoration → core/animations → core/input → core/keybinds → core/rules → core/execs → core/misc → 3d (cube) → generated/user.lua (your Settings) → themes/current.lua (theme LAST).

It is validated against the installed compositor (`Hyprland --verify-config`, run by `scripts/check.sh`). Lua API: `hl.config`, `hl.bind` (+ `description` flags read by the cheatsheet), `hl.window_rule` / `hl.layer_rule` / `hl.workspace_rule`, `hl.curve` / `hl.animation`, `hl.gesture`, `hl.on("hyprland.start", …)`.

It is **not** sourced into your own config. Ypsilon ships as its own session: `Hyprland -c .../ypsilon.lua` (`install.sh` registers it; `ypsilon try` previews it nested with ALT as the modifier via `YPSILON_TRY_MOD`).

### 3D cube workspaces (`hypr/3d.lua`)

Workspace switches swing with depth (`slidefade 30%` on the `glide` curve + dimmed inactive windows). Toggle: `SUPER+Z` / `ypsilon 3d toggle` / Settings → Desktop → 3D cube (writes `hypr.cube` in config.json → `generated/user.lua` flattens the swing when off; `reduceMotion` disables all animation).

## Shell layering

```
shell/app.tsx  (reads css from disk, watches it; requestHandler: reload-css, osd)
  ├─ Bar(i) per monitor — floating glass island; always shown or auto-hide (3px edge strip reveals it), position + autohide live
  │    left: launcher btn · workspaces (scroll to switch) · focused window title
  │    center: clock (opens calendar) · media mini
  │    right: tray (dbusmenu popovers) · bell+count · status (wifi/bt/vol/battery → control) · power
  ├─ Popup (widgets/Popup.tsx) — shared shell: full-screen transparent scrim + one glass card.
  │    Esc or click outside closes; clicks on the card are claimed. Used by:
  │    Launcher (apps/calc/cmd/clipboard/windows/web) · ControlCenter (tiles → Wi-Fi/Bluetooth/Sound pages, sliders, profile, media, theme chips)
  │    NotificationCenter (grouped by app) · Dashboard (clock, calendar, cpu/mem/temp, media) · Wallpapers (thumbnails) · Cheatsheet
  │    Powermenu (l/e/s/r/p) · Overview (each workspace as a scaled miniature with its windows in place)
  ├─ Toast — stacked (max 3), respects DND (critical still shows)
  └─ OSD — bottom pill, `ags request -i ypsilon osd volume|brightness|gamma`
Per monitor, next to the bar (widgets/Desktop.tsx, click-through, idle at rest):
  ├─ ScreenCorners — 4 tiny TOP-layer surfaces drawing the rounded screen corners once (cairo)
  └─ DesktopClock — BOTTOM-layer clock on the wallpaper (windows cover it)
```

Services (`shell/services/`): `theme` (runtime tokens/css), `config` (user json, reactive), `hypr`, `audio`, `brightness` (brightnessctl), `media`, `notif`, `apps` + `usage` (frecency ranking), `clip` (cliphist), `wifi` (nmcli), `sysinfo` (/proc sampler), `battery` (low-battery alerts), `system` (exec helpers → CLI), `osd`, `shell` (window helpers), `clock` (one shared minute-aligned wall clock), `gamma` (hyprsunset), `aether` (displays whatever Aether's latest apply dropped in its backgrounds dir).

Pure logic lives in `shell/lib/` with **no gi/ags imports** so it is unit-tested under plain Node: `calc` `config` `sysinfo` `rank` `keys` `net` `battery`. Keep new logic there when it can be.

Patterns taken from the official AGS 3.1.2 examples (source in `.cache/typecheck/vendor/ags-src`): popups close on Esc / click outside the card's `compute_bounds`; tray items re-insert their `dbusmenu` action group on `notify::action-group`; bars are created with `<For each={createBinding(app, "monitors")}>` + `onCleanup(win.destroy)`; controllers are JSX children (`<Gtk.GestureClick onPressed>`). The shell runs as AGS instance `ypsilon` (`ags toggle -i ypsilon …`).

Theme pipeline: `tokens.json` + `themes/user/*.json` (e.g. `ypsilon-auto` from `scripts/palette.py`) → `gen-theme.py` → hypr colors, lock colors, `_generated.css` (hot-reloaded by the shell), `extras/` and `extras/current/`.

Settings data flow: control → `writeConfig(path, value)` (validated by `lib/config.ts`, other keys preserved, broken JSON backed up) → config.json → `watchFile` → reactive `config` → widgets. Compositor keys (`hypr.*`, `input.*`, `idle.*`, `reduceMotion`) additionally run `ypsilon apply` → `scripts/userconf.py` renders `hypr/generated/user.lua` (+ `hypridle.conf`) → `hyprctl reload` + hypridle restart. Python and TS defaults are kept identical by a cross-language test.

Plugins: `services/plugins.ts` discovers `plugins/` + `~/.config/ypsilon/plugins/`, validates manifests (`lib/plugins.ts`), `import()`s enabled ones from `file://`, and gives each an API object (`lib/plugin-types.ts`). Contributions (bar items, launcher providers, tiles, commands) are owned per plugin and removed on disable. See docs/PLUGINS.md.

Validation (`scripts/check.sh`): hypr Lua via `Hyprland --verify-config`, CSS via the real GTK parser, theme sync, TS parse, import/export audit (`check-imports.mjs`), unit tests.

Conventions that prevent whole-shell crashes:
- Only import `gi://Astal*` libs that `install-deps.sh` installs (add new ones to its AUR_STAGES and to the supervisor preflight); one missing typelib kills the shell at startup.
- Optional CLIs (powerprofilesctl, playerctl, brightnessctl) are called through `execAsync(...).catch` — absence degrades a feature, never the shell.
- `name` prop before `application={app}`; popups use `Popup`, never hand-rolled windows.

## Data flow

Hyprland keybind → `ags toggle -i ypsilon <name>` → window visibility flips.
`ags request -i ypsilon osd volume` → requestHandler → OSD state → GLib auto-hide.
`ypsilon theme set NAME` → tokens.json `active` + regenerate → shell hot-reloads the css file by itself; `--apply` also `hyprctl reload`s.
Session: `ypsilon start` on `hyprland.start` (idempotent: wallpaper daemon+restore, hypridle, polkit agent, cliphist, shell).
