#!/usr/bin/env bash
# Ypsilon link — OPT-IN only. Backs up, never overwrites blindly.
# Usage: ./scripts/link.sh [--hypr] [--shell]
set -euo pipefail
TS=$(date +%Y%m%d_%H%M%S)
backup() { [ -e "$1" ] && [ ! -L "$1" ] && cp -a "$1" "$1.pre-ypsilon-$TS" && echo "backup: $1 -> $1.pre-ypsilon-$TS"; }
if [[ "${1:-}" == "--hypr" ]]; then
  echo "To try Ypsilon Hypr safely, add this ONE line to ~/.config/hypr/hyprland.conf:"
  echo "  source = ~/Projects/Ypsilon/hypr/ypsilon.conf"
  echo "Then: hyprctl reload. Remove line to revert. (We do NOT edit it for you Day 1.)"
fi
if [[ "${1:-}" == "--shell" ]]; then
  backup ~/.config/ags
  mkdir -p ~/.config/ags
  echo "Day 1: shell runs from repo via 'ags run ~/Projects/Ypsilon/shell/app.tsx'."
  echo "Day 6 install.sh will symlink ~/.config/ags -> repo. Not yet."
fi
[ $# -eq 0 ] && echo "Usage: ./scripts/link.sh [--hypr] [--shell]"
