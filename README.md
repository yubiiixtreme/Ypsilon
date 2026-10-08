<div align="center">

# ✦ Ypsilon

**A glass, animated, fully themeable desktop environment on Hyprland + AGS v3.**

Your config is never touched — Ypsilon runs as its own login session, previews nested, and uninstalls cleanly.

[![check](https://github.com/yubiiixtreme/Ypsilon/actions/workflows/check.yml/badge.svg)](https://github.com/yubiiixtreme/Ypsilon/actions/workflows/check.yml)
![Arch](https://img.shields.io/badge/Arch-rolling-1793D1?logo=archlinux&logoColor=white)
![Hyprland](https://img.shields.io/badge/Hyprland-%3E%3D0.53-58E6D9?logo=wayland&logoColor=black)
![AGS](https://img.shields.io/badge/AGS-v3-TypeScript-3178C6?logo=typescript&logoColor=white)
![Wayland](https://img.shields.io/badge/Wayland-only-FFBC00?logo=wayland&logoColor=black)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

</div>

## Install (Arch)

```bash
git clone https://github.com/yubiiixtreme/Ypsilon.git ~/Ypsilon && cd ~/Ypsilon
./scripts/install-deps.sh      # pacman + AUR (aylurs-gtk-shell, libastal-meta)
./scripts/ypsilon doctor       # every missing piece, with the exact fix
./scripts/ypsilon try          # nested preview (uses ALT, exits with ALT+Shift+E)
./scripts/install.sh           # adds an "Ypsilon" login session — undo anytime:
./scripts/uninstall.sh
```

Non-Arch: `install-deps.sh` prints the package list for your distro. Everything lives in the repo and works from any clone location — move it and paths regenerate on next start.

## At a glance

| | |
|---|---|
| **Bar** | Per monitor, hotplug-aware: launcher, scrollable workspaces, focused window, clock → dashboard, media, CPU/RAM, REC dot, tray menus, notification badge, status group → control center |
| **Launcher** `SUPER+Space` | Fuzzy apps ranked by match + your habits, plus a command palette — type `lock`, `reboot`, `neon`, `game mode`. Prefixes: `=` calc · `:` run command · `;` clipboard · `@` switch window · `?` web search |
| **Control center** `SUPER+C` | Wi-Fi live list + join, Bluetooth devices + battery, outputs/inputs/per-app mixer, DND, night light, game mode, caffeine, power profiles, theme chips, media with art + progress |
| **Wallpaper → theme** | `ypsilon theme auto` builds a WCAG-checked palette from your wallpaper and re-themes shell, Hyprland borders, lockscreen and terminals. Opt into `theme.followWallpaper` for every change |
| **Dashboard** *(clock click)* | Big clock, calendar, live CPU/memory/temperature graphs, now playing |
| **Notifications** | Stacked image toasts, silent under DND and fullscreen apps (critical still shows), history center |
| **Settings** `SUPER+I` | 12 pages: General · Appearance · Bar · Desktop (gaps, rounding, blur, shadows applied to Hyprland live) · Keyboard & mouse · Wi-Fi · Bluetooth · Sound · Power & idle · Updates · Plugins · About |
| **Updates** | pacman (rootless `checkupdates`), AUR, Flatpak + kernel-reboot warnings, bar badge, one-click update in your terminal, Ypsilon self-update |
| **Plugins** | Runtime JS modules (bar widgets, launcher modes, tiles, commands, settings) — crash-isolated, type-checked, hot enable/disable. Bundled: **Pomodoro**, **Quick links** (`!wiki`), **Dev ports** (`port`). See [docs/PLUGINS.md](docs/PLUGINS.md) |
| **Extras** | Weather (Open-Meteo, keyless) · cava visualizer (only while music plays) · cheatsheet `SUPER+/` · overview `SUPER+Tab` · OSD · hyprlock + hypridle (dim → lock → off → suspend) |

## Keybinds

`SUPER` is the modifier (preview uses `ALT`). Full list anytime: `SUPER+/`.

| Keys | Action |
|---|---|
| `SUPER+Space` / `C` / `Shift+C` / `N` / `Tab` | Launcher · control center · dashboard · notifications · overview |
| `SUPER+Shift+Q` / `I` / `/` / `Shift+W` | Power menu · settings · cheatsheet · wallpapers |
| `SUPER+L` / `W` / `Shift+V` / `P` | Lock · next wallpaper · clipboard · color picker |
| `SUPER+Shift+G` / `Shift+N` / `M` | Game mode · night light · layout toggle |
| `SUPER+Q` / `Shift+E` / `F` / `V` / `J` / `T` | Kill · exit · fullscreen · float · split · group |
| `SUPER+1…0` / `Shift+1…0` / `S` / scroll | Workspaces · move there · scratchpad · scroll workspaces |
| `Print` / `SUPER+Print` / `SUPER+Shift+R` | Select shot · full shot · record toggle |
| Media keys | Volume/brightness + OSD · play/next/prev via playerctl |

## CLI

```bash
ypsilon doctor            # health, every MISS ships its fix
ypsilon try               # safe nested preview
ypsilon theme list|set|auto
ypsilon wallpaper list|status|set|next
ypsilon shot select|full  ypsilon record select|full|stop
ypsilon toggle NAME       # any window: launcher, control, dashboard, …
ypsilon osd volume|brightness
ypsilon gamemode|nightlight|caffeine|layout toggle
ypsilon config edit|check ypsilon keys
ypsilon health|logs|restart|stop|report
ypsilon check             # = scripts/check.sh
```

## Customize without code

```bash
ypsilon config edit       # bar, clock, modules, workspaces, battery alerts, …
```

Validated on save (`config check` suggests fixes for typos), live-reloaded, falls back to defaults with a warning instead of crashing. Themes: edit `themes/tokens.json` or drop JSON into `themes/user/`, then `ypsilon gen`.

## Quality gates

Every push runs [`scripts/check.sh`](scripts/check.sh) in CI — and you can run it locally:

| Check | How |
|---|---|
| Hyprland config | `Hyprland --verify-config` on the real compositor |
| CSS | Parsed by GTK4 itself; every `@y_*` color must be defined |
| TypeScript | Strict `tsc` — real Gtk/Gnim/AGS 3.1.2 types, Astal types transcribed from Astal's source |
| Imports / icons | Every import resolves · every icon exists in Adwaita |
| Logic | TS + Python unit tests, hermetic CLI/supervisor tests |
| Bash | `bash -n` + shellcheck |
| The checkers | Mutation tests — each checker must catch an injected fault |

## Layout

```
hypr/       ypsilon.conf + core/*.conf · generated/ (paths, user, idle, lock) · themes/
shell/      app.tsx · widgets/ (+pages/, settings/) · services/ · lib/ (pure + tested) · style.css
themes/     tokens.json · user/ (generated/custom, gitignored)
scripts/    ypsilon · check.sh · typecheck.sh · gen-theme.py · palette.py · wallpaper.sh · install/uninstall
extras/     foot · kitty · ghostty · fuzzel · gtk — extras/current/ always = active theme
plugins/    pomodoro · quicklinks · dev-ports (+ docs/PLUGINS.md)
tests/  tools/  .github/  config.example.json
```

## When something goes wrong

| Symptom | Fix |
|---|---|
| Anything | `ypsilon doctor` |
| No bar / shell missing | `ypsilon health` → `ypsilon logs --prev` → `ypsilon restart` |
| Crash loop | Supervisor stops after 5 crashes in 2 min — read the log, then restart |
| One widget broken | The rest keeps running — `ypsilon health` names it |
| Config ignored | `ypsilon config check` |
| Moved the repo | Nothing to do — paths regenerate |
| Start warned about another session | You already have hypridle/ags running — use `ypsilon try` to preview safely |
| Want it gone | `./scripts/uninstall.sh` |
| Reporting a bug | `ypsilon report` and attach the file |

## Principles

1. Your Hyprland config is never edited — Ypsilon is its own session.
2. `themes/tokens.json` is truth; generated files are never hand-edited.
3. New logic goes in `shell/lib/` **with a test**; new Astal APIs are checked against Astal's source.
4. Wayland-only. `./scripts/check.sh` before every commit.

---

Built days in a row, one session at a time. ✦
