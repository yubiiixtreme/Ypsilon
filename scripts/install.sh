#!/usr/bin/env bash
# Ypsilon installer — ONLY runs when you explicitly invoke it, in a terminal.
#
#   ./scripts/install.sh [--no-deps] [--yes] [--make-default]
#
#   --no-deps       skip installing packages
#   --yes           non-interactive package installs (pacman/paru --noconfirm)
#   --make-default  after Ypsilon passed the live test, make it the session your display
#                   manager (SDDM) preselects at the next login (your old session stays in the list)
#
# Never edits your Hyprland config or ~/.config/ags. Adds an "Ypsilon" login session next to
# your existing ones. Undo: scripts/uninstall.sh
set -euo pipefail
ROOT=$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/.." && pwd)
SESSION=/usr/share/wayland-sessions/ypsilon.desktop
MIN_HYPR=0.53   # layerrule/windowrule `match:` syntax and `gesture =` need this

NO_DEPS=""; YES=""; MAKE_DEFAULT=""
for a in "$@"; do
  case $a in
    --no-deps) NO_DEPS=1;; --yes) YES=1;; --make-default) MAKE_DEFAULT=1;;
    *) echo "unknown option: $a (see the header of this script)"; exit 2;;
  esac
done
if [ -z "$YES" ] && [ ! -t 0 ]; then
  echo "install: stdin is not a terminal. Run it in a terminal, or pass --yes." >&2
  exit 2
fi

ver_ge() { [ "$(printf '%s\n%s\n' "$2" "$1" | sort -V | head -1)" = "$2" ]; }
step() { printf '\n== %s\n' "$*"; }

echo "== Ypsilon install (explicit opt-in) =="
step "1/6 dependencies"
if [ -n "$NO_DEPS" ]; then echo "skipped (--no-deps)"
else "$ROOT/scripts/install-deps.sh" ${YES:+--yes}; fi

step "2/6 Hyprland version"
hv=$(Hyprland --version 2>/dev/null | sed -n 's/^Hyprland \([0-9.]*\).*/\1/p' | head -1)
[ -n "$hv" ] || { echo "Hyprland not found"; exit 1; }
ver_ge "$hv" "$MIN_HYPR" || { echo "Hyprland $hv is too old; Ypsilon needs >= $MIN_HYPR"; exit 1; }
echo "Hyprland $hv OK"

step "3/6 generate + static checks"
python3 "$ROOT/scripts/gen-theme.py" >/dev/null
"$ROOT/scripts/check.sh" || { echo "checks failed — not installing (nothing was changed)"; exit 1; }

step "4/6 live test (Ypsilon boots in a nested window for a few seconds)"
if [ -n "${WAYLAND_DISPLAY:-}" ]; then
  if ! "$ROOT/scripts/verify-live.sh"; then
    echo "Ypsilon did not come up healthy — NOT installing the session (nothing was changed)."
    echo "Details: ${XDG_RUNTIME_DIR:-/tmp}/ypsilon/verify-live.log"
    exit 1
  fi
else
  echo "not in a graphical session — skipping the live test"
  [ -n "$MAKE_DEFAULT" ] && { echo "--make-default needs the live test; run this from your desktop."; exit 1; }
fi

step "5/6 login session (startup is logged to ~/.local/share/ypsilon/logs/)"
sudo tee "$SESSION" >/dev/null <<DESKTOP
[Desktop Entry]
Name=Ypsilon
Comment=Ypsilon desktop (Hyprland + AGS)
Exec=$ROOT/scripts/session.sh
Type=Application
DesktopNames=Hyprland
DESKTOP
echo "wrote $SESSION"

step "6/6 default session"
if [ -n "$MAKE_DEFAULT" ]; then
  "$ROOT/scripts/default-session.sh" set "$SESSION"
else
  echo "unchanged (pick 'Ypsilon' at the login screen, or re-run with --make-default)"
fi

echo ""
echo "Done. Back to your old desktop any time: pick it at the login screen, or run"
echo "  $ROOT/scripts/default-session.sh restore      (old default)"
echo "  $ROOT/scripts/uninstall.sh                    (remove Ypsilon's session)"
