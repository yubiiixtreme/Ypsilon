# Ypsilon Roadmap — build locally, review, then ship

## Build sprint (local-only, this session)
- [x] Repo scaffold, local git, no remote
- [x] `hypr/` glass+rounded+animated base + namespace layerrules
- [x] `hyprlock.conf` + `hypridle.conf` (standalone)
- [x] Theme engine: `gen-theme.py` (tokens → hypr confs + AGS css), 3 themes
- [x] Wallpapers: `make-wallpaper.py` → 3× 1366x768 PNGs
- [x] Shell: Bar, Launcher, ControlCenter, Notifications+Toast, OSD, Powermenu, Overview
- [x] Services: theme/hypr/audio/brightness/media/notif/apps/system/osd
- [x] `style.scss` + `_generated.css`, `ypsilon` CLI v0.2, `wallpaper.sh`, `install.sh` (file only)
- [ ] Live test (needs: install-deps, `ags run`, fix whatever reality says)
- [ ] Docs REVIEW checklist (see docs/REVIEW.md)

## Review gate (you go through everything)
- [ ] Read every file in `hypr/`, `shell/`, `scripts/`, `themes/`
- [ ] Run `ypsilon doctor` + `ypsilon gen`
- [ ] Run `./scripts/install-deps.sh`, then `ags run ./shell/app.tsx`
- [ ] Work through docs/REVIEW.md, file issues as notes
- [ ] Decide: daily-drive Ypsilon vs keep Caelestia fallback

## Ship (only after review)
- [ ] `install.sh` run (backs up, links, hooks hypr)
- [ ] Screenshots + polish pass
- [ ] GitHub push + release v0.1

No push until the review gate is green.
