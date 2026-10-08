# Ypsilon DE

> Our own Wayland desktop environment on top of Hyprland.
> Local-only for now — no GitHub push until we say so.
> Day 1: Foundation. Glass + Rounded + Animated + Effects.

## Vision

Better than Caelestia, but ours:
- **Compositor:** Hyprland (Wayland)
- **Shell:** AGS v3 (Aylur's GTK Shell) + Astal + GTK4 + TypeScript/JSX
- **Style:** glassmorphism, rounded 18-24px, animated everywhere, heavy blur/layers
- **Theme engine:** single `themes/tokens.json` → generates Hyprland conf + AGS SCSS + GTK + foot/kitty/etc
- **CLI:** `ypsilon` command (theme, wallpaper, reload, screenshot, record)

## Layout

```
Ypsilon/
  hypr/            Hyprland config (safe, does NOT touch ~/.config/hypr yet)
    ypsilon.conf   entry — source this to try
    core/          monitors, env, execs, general, decoration, animations, input, keybinds, rules
    themes/        generated per-theme hypr colors (future)
  shell/           AGS v3 shell (GTK4)
    app.tsx        entry (ags run ./app.tsx)
    widgets/       Bar, Launcher (stub), ControlCenter (stub)
    services/      theme, hypr helpers
    style.scss     glass + rounded + animated
  themes/
    tokens.json    single source of truth for colors/radius/blur
  scripts/
    install-deps.sh  paru install ags + astal + tools
    dev.sh           run shell in dev mode
    link.sh          SAFELY link into ~/.config (backs up, opt-in)
    ypsilon          CLI
  docs/
    ARCHITECTURE.md
    ROADMAP.md
  assets/wallpapers/
```

## Day 1 quickstart (safe, non-destructive)

```bash
cd ~/Projects/Ypsilon

# 1. install deps (needs sudo, AUR)
./scripts/install-deps.sh

# 2. try Hyprland config without breaking Caelestia:
#    add ONE line to your Hyprland config to test, remove to revert:
#    source = ~/Projects/Ypsilon/hypr/ypsilon.conf
hyprctl reload

# 3. run shell in dev (does not autostart, just a window):
ags run ./shell/app.tsx
# or
./scripts/dev.sh

# 4. CLI
./scripts/ypsilon help
```

## Rules for this repo

1. Never touch `~/.config/hypr` or `~/.config/caelestia` automatically — only via `link.sh` with backup.
2. `themes/tokens.json` is truth. Everything else generates from it.
3. Every widget: glass bg, rounded, 200-300ms animation, hover/active states.
4. Wayland-only. No X11-isms.
5. Local git only. No `gh push`, no remote until we decide.

— Day 1, foundation. More tomorrow.
