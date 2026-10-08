# Ypsilon Architecture

## Stack

- **Compositor:** Hyprland 0.56+ (Wayland)
- **Shell:** AGS v3 `aylurs-gtk-shell` + `libastal-meta` (hyprland, tray, network, bluetooth, battery, mpris, notifd, wireplumber, apps, io)
- **Lang:** TypeScript + JSX (Gnim) running on GJS
- **Style:** GTK4 CSS / SCSS → glass, rounded, animated
- **Theme:** `themes/tokens.json` → `shell/style.scss` + `hypr/themes/*.conf` (gen script coming Day 2)
- **CLI:** `scripts/ypsilon` (bash) → later Rust/TS rewrite

## Hyprland layering

`hypr/ypsilon.conf` sources `core/*.conf` in order:
monitors → env → execs → general → decoration → animations → input → keybinds → rules → misc

- `general`: gaps 12, border 2, layout dwindle
- `decoration`: rounding 18, blur enabled (size 12, passes 3, noise, vibrancy), shadows, dim inactive
- `animations`: bezier curves, 250ms workspaces, 200ms windows, fade+slide+pop. This is where "a lot of effects" lives.
- All colors reference theme vars, defaults to Tokyo-Night-ish Ypsilon palette (see tokens.json).

Safe by design: our conf lives in repo, never auto-linked. User opts in with one `source =` line.

## Shell layering

```
shell/app.tsx
  └─ Bar (per monitor, TOP anchored, layer-shell exclusive)
       ├─ left: Launcher btn + Workspaces (Hyprland service)
       ├─ center: Clock + Media (Mpris stub Day 1)
       └─ right: Tray + Network + Audio + Battery + Power btn
  └─ Launcher (stub, hidden window, SUPER+Space)
  └─ ControlCenter (stub, hidden, SUPER+C)
```

Services:
- `services/theme.ts` — reads tokens, exposes css vars, `applyTheme(name)`
- `services/hypr.ts` — thin wrapper around `AstalHyprland` (workspaces/clients)

Styling:
- `style.scss` — glass mixin, `.ypsilon-bar`, pills, buttons, animations (fadeSlideIn, pop)
- GTK4 CSS, no web-only props. Blur comes from Hyprland `layerrule blur, gtk4-layer-shell`.

## Data flow

User keybind (Hyprland) → `ags -t <window>` or `ypsilon <cmd>` → Astal service → widget update → CSS transition.

Theme switch: `ypsilon theme set <name>` → writes `hypr/themes/current.conf` + `app.apply_css()` → `hyprctl reload`.

## Tomorrow hooks

- [ ] `scripts/gen-theme.py`: tokens.json → hypr + scss
- [ ] Launcher: app fuzzy search (AstalApps) + calc + clipboard
- [ ] ControlCenter: sliders, wifi/bt toggles
- [ ] Notifications: AstalNotifd center + history
- [ ] Wallpaper daemon: swww/hyprpaper + scheme switch
- [ ] Lockscreen: hyprlock + 한 glass theme
