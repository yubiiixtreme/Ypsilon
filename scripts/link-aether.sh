#!/usr/bin/env bash
# Link Ypsilon's Aether custom app into place so one Aether apply (Ctrl+Enter)
# changes the theme AND the wallpaper (post-apply.sh feeds `ypsilon wallpaper set`).
# Idempotent and never fatal: safe to re-run any time.
set -uo pipefail
ROOT=$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/.." && pwd)
SRC="$ROOT/aether/custom/ypsilon"
DEST="${XDG_CONFIG_HOME:-$HOME/.config}/aether/custom/ypsilon"
[ -d "$SRC" ] || { echo "link-aether: $SRC missing"; exit 1; }
command -v aether &>/dev/null || echo "link-aether: aether not installed (AUR: aether) — link created anyway"
mkdir -p "$(dirname "$DEST")"
if [ -L "$DEST" ]; then
  if [ "$(readlink "$DEST")" = "$SRC" ]; then echo "link-aether: already linked"; exit 0; fi
  echo "link-aether: $DEST is a link elsewhere — left untouched"; exit 0
fi
if [ -e "$DEST" ]; then echo "link-aether: $DEST exists (not a link) — left untouched"; exit 0; fi
ln -s "$SRC" "$DEST" && echo "link-aether: $DEST -> $SRC"
