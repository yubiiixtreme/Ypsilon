# Ypsilon Architecture

## Stack

- **Compositor:** Hyprland 0.56+ (Wayland)
- **Shell:** AGS v3 `aylurs-gtk-shell` + `libastal-meta` (hyprland, tray, network, bluetooth, battery, mpris, notifd, wireplumber, apps, brightness)
- **Lang:** TypeScript + JSX (Gnim) on GJS, GTK4 (`ags/gtk4`)
- **Style:** `shell/style.scss` (layout) + `shell/style/_generated.css` (theme colors, via gen-theme.py), concatenated in `app.tsx`
- **Theme:** `themes/tokens.json` → `hypr/themes/*.conf` + `_generated.css` + `extras/` (foot/kitty/ghostty/fuzzel/gtk) — see `scripts/gen-theme.py`
- **CLI:** `scripts/ypsilon` (bash). `theme set` regenerates repo files; live-apply needs `--apply`.

## Hyprland layering

`hypr/ypsilon.conf` sources `core/*.conf` in order, theme colors LAST:
monitors → env → general → decoration → animations → input → keybinds → rules → execs → misc → themes/current.conf

- `general`: gaps 6/12, border 2, dwindle, gradient active border
- `decoration`: rounding 18, blur 12x3 + noise + vibrancy, shadows, dim inactive
- `animations`: ypsilon bezier, windows/workspaces slide, layers pop
- `rules`: generic gtk-layer-shell blur + per-surface `layerrule = blur, ypsilon-*` (matches `namespace` prop)
- Standalone (not sourced, opt-in later): `hyprlock.conf`, `hypridle.conf`

Safe by design: everything lives in the repo. Nothing links to `~/.config` unless you run `install.sh`.

## Shell layering

```
shell/app.tsx  (css = style.scss + _generated.css; requestHandler: reload-css, osd)
  ├─ Bar(i) per monitor — TOP|LEFT|RIGHT, EXCLUSIVE, name ypsilon-bar-N
  │    left: apps btn + Workspaces (AstalHyprland, hyprctl actions)
  │    center: clock (poll) + MediaMini (AstalMpris)
  │    right: Tray (AstalTray) + wifi (AstalNetwork) + vol (AstalWp) + bat (AstalBattery) + power
  ├─ Launcher — TOP sheet, ON_DEMAND keys, AstalApps fuzzy + `=calc` + `:cmd`
  ├─ ControlCenter — TOP|RIGHT, vol/bright sliders, wifi/bt buttons, DND switch
  ├─ NotificationCenter — TOP|RIGHT, AstalNotifd list + Toast (auto-hide)
  ├─ OSD — BOTTOM pill, `ags request osd volume|brightness`, GLib timeout hide
  ├─ Powermenu — TOP sheet, systemctl/hyprlock actions
  └─ Overview — TOP sheet, workspace grid + clients count + focused title
```

Services (`shell/services/`, lazy singletons — module import is client-process safe):
- `theme.ts` — tokens read + generated-artifact paths (inert, no Astal)
- `hypr.ts` — AstalHyprland state; actions via `hyprctl` (always present)
- `audio.ts` / `brightness.ts` / `media.ts` / `notif.ts` / `apps.ts` — Astal singletons + guarded actions
- `system.ts` — pure exec helpers (lock, power, wifi/bt toggle, screenshots)
- `osd.ts` — OSD state + GLib timeout (no Astal import)

Conventions that prevent whole-shell crashes:
- `name` prop always BEFORE `application={app}`; only verified anchors (no CENTER anchor).
- Only docs-verified signals: onClicked, onNotifyText, onActivate, onChangeValue, onNotifyActive, onToggled.
- Unverified Astal props/methods are read guarded (`?.`, `??`) and written in try/catch.
- Toggle-buttons that run non-idempotent shell commands are plain buttons (no notify-loop).

## Data flow

Hyprland keybind → `ags toggle <name>` → window visibility flips.
`ags request osd volume` → requestHandler → OSD state → GLib auto-hide.
`ypsilon theme set NAME` → tokens.json + regenerate → (with --apply) `hyprctl reload` + `ags request reload-css`.
