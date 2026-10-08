#!/usr/bin/env bash
# Every "*-symbolic" icon name used by the shell must exist in Adwaita (GTK's guaranteed
# fallback theme), otherwise it renders as a broken image. Dynamic names (from Astal,
# e.g. volumeIcon / batteryIconName) are provided by the libraries themselves.
ROOT=$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/.." && pwd)
THEME=${1:-/usr/share/icons/Adwaita}
[ -d "$THEME" ] || { echo "no icon theme at $THEME"; exit 2; }
missing=0
for i in $(grep -rhoE '"[a-z0-9-]+-symbolic"' "$ROOT/shell" --include='*.ts' --include='*.tsx' | tr -d '"' | sort -u); do
  [ -n "$(find "$THEME" -name "$i.svg" -print -quit)" ] || { echo "missing icon: $i"; missing=1; }
done
exit $missing
