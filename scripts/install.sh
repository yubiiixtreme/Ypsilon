#!/usr/bin/env bash
# Ypsilon installer — ONLY runs when you explicitly invoke it.
# Backs up everything it touches. Never run automatically.
set -euo pipefail
ROOT=~/Projects/Ypsilon
TS=$(date +%Y%m%d_%H%M%S)

backup() {
  local p="$1"
  if [ -e "$p" ] && [ ! -L "$p" ]; then
    cp -a "$p" "$p.pre-ypsilon-$TS"
    echo "backup: $p -> $p.pre-ypsilon-$TS"
  fi
}

echo "== Ypsilon install (explicit opt-in) =="
echo "1/4 deps..."
"$ROOT/scripts/install-deps.sh"

echo "2/4 shell types..."
cd "$ROOT/shell" && ags types -u -d . || echo "(ags types failed — continuing)"

echo "3/4 link shell..."
backup ~/.config/ags
rm -rf ~/.config/ags
ln -s "$ROOT/shell" ~/.config/ags
echo "linked ~/.config/ags -> $ROOT/shell"

echo "4/4 hypr hook..."
if ! grep -q "Ypsilon/hypr/ypsilon.conf" ~/.config/hypr/hyprland.conf 2>/dev/null; then
  backup ~/.config/hypr/hyprland.conf
  printf '\n# Ypsilon (added by install.sh %s)\nsource = ~/Projects/Ypsilon/hypr/ypsilon.conf\n' "$TS" >> ~/.config/hypr/hyprland.conf
  echo "appended source line to hyprland.conf"
else
  echo "hypr source line already present"
fi

echo ""
echo "Done. Apply with: hyprctl reload"
echo "Run shell: ags run ~/.config/ags/app.tsx"
echo "Revert: remove the source line, restore backups (*.pre-ypsilon-$TS)."
