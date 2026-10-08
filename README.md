# Ypsilon DE

> Our own Wayland desktop environment on top of Hyprland.
> Local-only — no GitHub push until review is green (see docs/REVIEW.md).

## Vision

Better than Caelestia, but ours:
- **Compositor:** Hyprland (Wayland)
- **Shell:** AGS v3 + Astal + GTK4 + TypeScript/JSX
- **Style:** glassmorphism, rounded, animated everywhere
- **Theme engine:** `themes/tokens.json` → Hyprland confs + AGS css (`scripts/gen-theme.py`)
- **CLI:** `scripts/ypsilon` (theme, wallpaper, toggle, osd, doctor)

## Layout

```
Ypsilon/
  hypr/
    ypsilon.conf     entry — source one line to try, remove to revert
    core/            monitors env general decoration animations input keybinds rules execs misc
    themes/          GENERATED per-theme colors + current.conf (via gen-theme.py)
    hyprlock.conf    standalone lockscreen
    hypridle.conf    standalone idle daemon
  shell/
    app.tsx          entry (ags run ./app.tsx) + requestHandler
    widgets/         Bar Launcher ControlCenter Notifications OSD Powermenu Overview
    services/        theme hypr audio brightness media notif apps system osd
    style.scss       layout; style/_generated.css = theme colors
  themes/tokens.json single source of truth
  scripts/
    gen-theme.py       tokens → hypr + css (safe, repo files only)
    make-wallpaper.py  stdlib PNG gradients (safe)
    ypsilon            CLI v0.2
    wallpaper.sh       swww/hyprpaper/swaybg manager (runs only when invoked)
    install-deps.sh    paru/pacman deps (explicit only)
    install.sh         backup + link + hook (explicit only)
    dev.sh / link.sh   dev run / opt-in link helpers
  docs/  ARCHITECTURE.md ROADMAP.md REVIEW.md
  assets/wallpapers/   GENERATED PNGs (1366x768)
```

## Status

Built, not yet live-tested. Next: `docs/REVIEW.md` → install-deps → `ags run`.

```bash
cd ~/Projects/Ypsilon
./scripts/ypsilon doctor
./scripts/ypsilon gen
./scripts/ypsilon theme list
```

## Rules

1. Nothing touches `~/.config` unless you run `install.sh` / `link.sh` yourself.
2. `themes/tokens.json` is truth; generated files are never hand-edited.
3. Every widget: glass bg, rounded, animated, hover/active states.
4. Wayland-only. Local git only, no remote until we decide.

See `docs/ARCHITECTURE.md` for the full design, `docs/ROADMAP.md` for what's next.
