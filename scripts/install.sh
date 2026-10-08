#!/usr/bin/env bash
# Ypsilon installer — ONLY runs when you explicitly invoke it.
# It never edits your Hyprland config or ~/.config/ags. It adds an "Ypsilon" login
# session next to your existing one; pick it in your display manager. Undo: scripts/uninstall.sh
set -euo pipefail
ROOT=$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/.." && pwd)
SESSION=/usr/share/wayland-sessions/ypsilon.desktop
MIN_HYPR=0.53   # layerrule/windowrule `match:` syntax and `gesture =` need this

ver_ge() { [ "$(printf '%s\n%s\n' "$2" "$1" | sort -V | head -1)" = "$2" ]; }

echo "== Ypsilon install (explicit opt-in) =="
if [ "${1:-}" != "--no-deps" ]; then
  echo "1/5 deps..."
  "$ROOT/scripts/install-deps.sh"
else
  echo "1/5 deps... skipped (--no-deps)"
fi

echo "2/5 Hyprland version..."
hv=$(Hyprland --version 2>/dev/null | sed -n 's/^Hyprland \([0-9.]*\).*/\1/p' | head -1)
[ -n "$hv" ] || { echo "Hyprland not found"; exit 1; }
ver_ge "$hv" "$MIN_HYPR" || { echo "Hyprland $hv is too old; Ypsilon needs >= $MIN_HYPR"; exit 1; }
echo "   Hyprland $hv OK"

echo "3/5 generate + validate..."
python3 "$ROOT/scripts/gen-theme.py" >/dev/null
"$ROOT/scripts/check.sh" || { echo "checks failed — not installing (nothing was changed)"; exit 1; }

echo "4/5 editor types (optional)..."
(cd "$ROOT/shell" && ags types -u -d . >/dev/null 2>&1) && echo "   ags types OK" || echo "   (ags types failed — only affects editor autocompletion)"

echo "5/5 login session..."
if command -v start-hyprland >/dev/null; then
  EXEC="start-hyprland -- -c $ROOT/hypr/ypsilon.conf"   # watchdog wrapper, like the stock session
else
  EXEC="Hyprland -c $ROOT/hypr/ypsilon.conf"
fi
sudo tee "$SESSION" >/dev/null <<DESKTOP
[Desktop Entry]
Name=Ypsilon
Comment=Ypsilon desktop (Hyprland + AGS)
Exec=$EXEC
Type=Application
DesktopNames=Hyprland
DESKTOP
echo "   wrote $SESSION"

echo ""
echo "Done. Log out and pick 'Ypsilon' in your display manager."
echo "Preview first without logging out:  $ROOT/scripts/ypsilon try"
echo "Undo everything:                    $ROOT/scripts/uninstall.sh"
