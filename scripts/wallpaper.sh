#!/usr/bin/env bash
# ypsilon wallpaper manager — backends: swww > hyprpaper > swaybg.
# Only runs when YOU invoke it. Does nothing on its own.
set -euo pipefail
ROOT=~/Projects/Ypsilon
DIR=$ROOT/assets/wallpapers
STATE=~/.cache/ypsilon/wallpaper

list() { for f in "$DIR"/*.png; do basename "$f" .png; done; }
current() { [ -f "$STATE" ] && cat "$STATE" || echo "ypsilon-dark"; }

apply() {
  local img="$DIR/$1.png"
  [ -f "$img" ] || { echo "no such wallpaper: $1 (try: $0 list)"; exit 1; }
  if command -v swww &>/dev/null; then
    swww img "$img" --transition-type grow --transition-duration 1
  elif command -v hyprpaper &>/dev/null; then
    hyprctl hyprpaper wallpaper ",$img" 2>/dev/null || echo "preload = $img" > /tmp/ypsilon-hyprpaper.conf
  elif command -v swaybg &>/dev/null; then
    pkill swaybg 2>/dev/null || true
    swaybg -i "$img" &
  else
    echo "no backend (install swww). image: $img"; exit 1
  fi
  mkdir -p "$(dirname "$STATE")"; echo "$1" > "$STATE"
  echo "wallpaper: $1"
}

case "${1:-status}" in
  list) list;;
  status) echo "current: $(current)";;
  set) apply "${2:?usage: wallpaper set <name>}" ;;
  next)
    names=($(list)); cur=$(current); next="${names[0]}"
    for i in "${!names[@]}"; do [ "${names[$i]}" = "$cur" ] && next="${names[$(( (i+1) % ${#names[@]} ))]}"; done
    apply "$next";;
  *) echo "usage: wallpaper {list|status|set <name>|next}"; exit 1;;
esac
