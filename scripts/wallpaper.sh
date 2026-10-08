#!/usr/bin/env bash
# ypsilon wallpaper manager — backends: awww/swww > hyprpaper > swaybg.
# Sources: assets/wallpapers + ~/Pictures/Wallpapers (png/jpg/jpeg/webp).
# Only runs when YOU (or the session bring-up) invoke it.
set -euo pipefail
ROOT=${YPSILON_ROOT:-$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/.." && pwd)}
DIRS=("$ROOT/assets/wallpapers" "$HOME/Pictures/Wallpapers")
STATE=~/.cache/ypsilon/wallpaper

files() {
  for d in "${DIRS[@]}"; do
    [ -d "$d" ] && find "$d" -maxdepth 2 -type f \( -iname '*.png' -o -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.webp' \) | sort
  done
  return 0
}
names() { files | while read -r f; do b=$(basename "$f"); echo "${b%.*}"; done; }
resolve() { # name-or-path -> path
  if [ -f "$1" ]; then echo "$1"; else files | grep -F "/$1." | head -1 || true; fi
}
current() { if [ -f "$STATE" ]; then cat "$STATE"; else files | head -1; fi; }

RUN=${XDG_RUNTIME_DIR:-/tmp}/ypsilon
# (re)start a wallpaper daemon for THIS session only (same pid files as `ypsilon start`, so
# `ypsilon stop` cleans it up; never touches daemons of other sessions)
session_daemon() {
  local name=$1; shift
  local pidf="$RUN/${WAYLAND_DISPLAY:-wl}.$name.pid"
  if [ -f "$pidf" ]; then kill -- "-$(cat "$pidf")" 2>/dev/null || true; fi  # stale pid file is fine
  setsid "$@" >>"$RUN/$name.log" 2>&1 </dev/null &
  echo $! > "$pidf"
}

# config.json {"theme": {"followWallpaper": true, "autoLight": false}} -> re-theme on every change
follow_theme() {
  local cfg=${XDG_CONFIG_HOME:-$HOME/.config}/ypsilon/config.json mode
  [ -f "$cfg" ] || return 0
  mode=$(python3 -c 'import json,sys; t=json.load(open(sys.argv[1])).get("theme",{}); print(("light" if t.get("autoLight") else "dark") if t.get("followWallpaper") else "")' "$cfg" 2>/dev/null) || return 0
  [ -n "$mode" ] || return 0
  local args=(theme auto --apply)
  [ "$mode" = light ] && args+=(--light)
  "$ROOT/scripts/ypsilon" "${args[@]}" >/dev/null 2>&1 &
}

apply() {
  local img; img=$(resolve "$1")
  mkdir -p "$RUN"
  [ -n "$img" ] && [ -f "$img" ] || { echo "no such wallpaper: $1 (try: $0 list)"; exit 1; }
  if command -v awww &>/dev/null; then
    awww img "$img" --transition-type grow --transition-duration 1
  elif command -v swww &>/dev/null; then
    swww img "$img" --transition-type grow --transition-duration 1
  elif command -v hyprpaper &>/dev/null; then
    # hyprpaper 0.8 changed its IPC; a generated config + restart works on every version
    # and never reads your own ~/.config/hypr/hyprpaper.conf
    printf 'splash = false\nipc = false\n\nwallpaper {\n    monitor =\n    path = %s\n    fit_mode = cover\n}\n' "$img" > "$RUN/hyprpaper.conf"
    session_daemon hyprpaper hyprpaper -c "$RUN/hyprpaper.conf"
  elif command -v swaybg &>/dev/null; then
    session_daemon swaybg swaybg -i "$img" -m fill
  else
    echo "no backend (install awww). image: $img"; exit 1
  fi
  mkdir -p "$(dirname "$STATE")"; echo "$img" > "$STATE"
  echo "wallpaper: $img"
  follow_theme
}

case "${1:-status}" in
  list) names;;
  files) files;;
  status) echo "current: $(current)";;
  set) apply "${2:?usage: wallpaper set <name|path>}";;
  restore) apply "$(current)";;
  next)
    mapfile -t all < <(files); cur=$(current); next="${all[0]:-}"
    for i in "${!all[@]}"; do [ "${all[$i]}" = "$cur" ] && next="${all[$(( (i+1) % ${#all[@]} ))]}"; done
    [ -n "$next" ] || { echo "no wallpapers found"; exit 1; }
    apply "$next";;
  *) echo "usage: wallpaper {list|files|status|set <name|path>|next|restore}"; exit 1;;
esac
