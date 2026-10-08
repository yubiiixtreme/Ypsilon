#!/usr/bin/env bash
# Remove what install.sh added. Leaves the repo, your configs and your wallpapers alone.
set -uo pipefail
ROOT=$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/.." && pwd)
SESSION=/usr/share/wayland-sessions/ypsilon.desktop

echo "== Ypsilon uninstall =="
if [ -f "$SESSION" ]; then sudo rm -f "$SESSION" && echo "removed $SESSION"; else echo "no session entry"; fi

# older versions linked ~/.config/ags -> repo/shell; only remove it if it points at us
link=${XDG_CONFIG_HOME:-$HOME/.config}/ags
if [ -L "$link" ] && [ "$(readlink -f "$link")" = "$ROOT/shell" ]; then
  rm "$link" && echo "removed $link (pointed at Ypsilon)"
  latest=$(ls -d "$link".pre-ypsilon-* 2>/dev/null | sort | tail -1)
  [ -n "$latest" ] && mv "$latest" "$link" && echo "restored your previous $link from $latest"
fi

ags quit -i ypsilon >/dev/null 2>&1 && echo "stopped the shell"
echo "Optional cleanup (your data): ${XDG_CONFIG_HOME:-$HOME/.config}/ypsilon  ${XDG_CACHE_HOME:-$HOME/.cache}/ypsilon"
