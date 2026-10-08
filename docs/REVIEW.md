# Ypsilon Review Guide — for the human pass

Read top to bottom. Check boxes as you go. Nothing here changes your live
system until the "Live test" section, and even that is fully revertible.

## 1. Static read (no commands)

- [ ] `themes/tokens.json` — palette sane? radii/blur/anim to taste?
- [ ] `scripts/gen-theme.py` — outputs match `hypr/themes/*.conf` + `shell/style/_generated.css`?
- [ ] `hypr/ypsilon.conf` + `hypr/core/*.conf` — any bind that clashes with your Caelestia muscle memory?
- [ ] `hypr/hyprlock.conf`, `hypr/hypridle.conf` — paths + timeouts OK?
- [ ] `shell/app.tsx` — windows + requestHandler make sense?
- [ ] `shell/services/*.ts` — any helper you distrust?
- [ ] `shell/widgets/*.tsx` — Bar, Launcher, ControlCenter, Notifications, OSD, Powermenu, Overview
- [ ] `shell/style.scss` — every class used in widgets exists here or in `_generated.css`?
- [ ] `scripts/ypsilon`, `wallpaper.sh`, `install.sh`, `install-deps.sh`, `dev.sh`, `link.sh`

## 2. Safe commands (repo files only, zero live impact)

```bash
cd ~/Projects/Ypsilon
./scripts/ypsilon doctor     # read-only checks
./scripts/ypsilon gen        # regenerates themes + wallpapers
./scripts/ypsilon theme list
git log --oneline            # review history
```

## 3. Live test (explicit, revertible)

```bash
./scripts/install-deps.sh          # needs sudo, AUR builds take a while
ags run ./shell/app.tsx            # first Bar; Ctrl+C to stop, nothing persists
```

If the Bar shows: try `ags toggle ypsilon-launcher`, `ags request osd volume`,
`SUPER+Space` (only if you sourced ypsilon.conf — don't yet).

Verify-live list (things I could not prove without running):
- [ ] tray icons render (`gicon` binding on TrayItem)
- [ ] workspaces track focus (`focusedWorkspace` binding)
- [ ] wifi ssid shows (`network.wifi.ssid`)
- [ ] volume/brightness sliders drag smoothly
- [ ] battery icon + % look right
- [ ] media mini appears with a player open
- [ ] notifications arrive + toast auto-hides + center lists + DND switch works
- [ ] launcher finds apps, `=2+2`, `:foot` run
- [ ] OSD shows on `ags request osd volume`
- [ ] no console errors (`ags run` prints them)

## 4. Daily-drive trial (only when 3 is green)

```bash
./scripts/install.sh   # backups + links + hypr source line
hyprctl reload
```

Revert: remove the `source = ...ypsilon.conf` line from
`~/.config/hypr/hyprland.conf`, `hyprctl reload`, restore any
`*.pre-ypsilon-*` backup, `pkill -f 'ags run'` if needed.

## 5. Ship

Screenshots → polish pass → GitHub → v0.1. Only when you say so.
