# shellcheck shell=bash
# Quick toggles: game mode, caffeine, tiling layout, picture-in-picture.

cmd_gamemode() {
  # a screen shader forces a full-screen redraw every frame and blocks direct scanout: off too
  gm_on() { hyprctl --batch "keyword animations:enabled 0; keyword decoration:blur:enabled 0; keyword decoration:shadow:enabled 0; keyword general:gaps_in 0; keyword general:gaps_out 0; keyword decoration:rounding 0; keyword decoration:screen_shader [[EMPTY]]" >/dev/null; }
  gm_st() { [ "$(hyprctl getoption animations:enabled 2>/dev/null | awk '/int:/{print $2}')" = "0" ] && echo on || echo off; }
  case "${1:-toggle}" in
    status) gm_st;;
    on) gm_on; echo on;;
    off) hyprctl reload >/dev/null; echo off;;
    toggle) if [ "$(gm_st)" = on ]; then hyprctl reload >/dev/null; echo off; else gm_on; echo on; fi;;
    *) echo "usage: ypsilon gamemode [on|off|toggle|status]"; return 1;;
  esac
}

# caffeine on = no idle daemon (no dim/lock/suspend); off = hypridle back
cmd_caffeine() {
  cf_st() { pgrep -x hypridle >/dev/null && echo off || echo on; }
  case "${1:-toggle}" in
    status) cf_st;;
    on) pkill -x hypridle || true; echo on;;
    off) once hypridle hypridle -c "$ROOT/hypr/generated/hypridle.conf"; echo off;;
    toggle) if [ "$(cf_st)" = on ]; then cmd_caffeine off; else cmd_caffeine on; fi;;
    *) echo "usage: ypsilon caffeine [on|off|toggle|status]"; return 1;;
  esac
}

cmd_layout() {
  local cur next
  cur=$(hyprctl getoption general:layout 2>/dev/null | awk '/str:/{print $2}')
  case "${1:-toggle}" in
    status) echo "${cur:-?}";;
    dwindle|master) hyprctl keyword general:layout "$1" >/dev/null && echo "$1";;
    toggle) next=$([ "$cur" = master ] && echo dwindle || echo master); hyprctl keyword general:layout "$next" >/dev/null && echo "$next";;
    *) echo "usage: ypsilon layout [dwindle|master|toggle|status]"; return 1;;
  esac
}

# 3D cube workspaces: config.json hypr.cube -> hypr/generated/user.lua -> hyprctl reload.
# The cube-feel animations live in hypr/3d.lua; the true desktop-cube.so plugin
# (when installed) is loaded from there too. SUPER+Z toggles.
_3d_controls() {
  cat <<'TXT'
Hypr3D room — controls
  SUPER+Z              enter / leave the room
  mouse                look around
  arrows               walk (Up/Down forward/back, Left/Right strafe)
  PageUp / PageDown    jump or fly up / down
  Right Ctrl           sprint
  C (+ wheel)          zoom
  SUPER+Left Alt       switch between moving and typing in windows
  SUPER+left drag      move a window · SUPER+right drag resize · SUPER+wheel zoom it
  click a window       keyboard stays on it (so games keep WASD/Space/Shift/Ctrl)
  F3 debug HUD · F5 camera view
TXT
}

_3d_plugin_state() {
  local so=${XDG_CONFIG_HOME:-$HOME/.config}/ypsilon/plugins/hypr3d.so
  if hyprctl plugin list 2>/dev/null | grep -qi hypr3d; then echo loaded
  elif [ -f "$so" ]; then echo installed
  else echo missing; fi
}

cmd_3d() {
  local sub="${1:-toggle}" cur st
  cur=$(python3 -c 'import json,sys; print("on" if json.load(open(sys.argv[1])).get("hypr",{}).get("cube",True) else "off")' "$CFG" 2>/dev/null || echo on)
  case "$sub" in
    status)
      st=$(_3d_plugin_state)
      echo "cube animations: $cur"
      case "$st" in
        loaded) echo "Hypr3D room: ready — SUPER+Z to enter (ypsilon 3d help for controls)";;
        installed) echo "Hypr3D room: built, loads at next login";;
        *) echo "Hypr3D room: not installed — run: ypsilon 3d install";;
      esac;;
    help|controls) _3d_controls;;
    keys)
      # same cheat-sheet as `help`, as a notification (SUPER+SHIFT+Z)
      if have notify-send; then notify-send -a Ypsilon -t 15000 "3D room controls" "$(_3d_controls | tail -n +2 | sed 's/^  //')"
      else _3d_controls; fi;;
    hint)
      # shown when the room opens (hypr/3d.lua on_state); stops after 3 times so it never nags
      local f=${XDG_STATE_HOME:-$HOME/.local/state}/ypsilon/3d-hints n=0
      [ -f "$f" ] && n=$(cat "$f" 2>/dev/null || echo 0)
      [ "${n:-0}" -lt 3 ] 2>/dev/null || return 0
      mkdir -p "$(dirname "$f")" && echo $((n + 1)) > "$f"
      have notify-send && notify-send -a Ypsilon -t 9000 "Welcome to the 3D room" \
        "Arrows walk · mouse looks · PageUp jumps · SUPER+Z leaves\nSUPER+Left Alt types in windows · ypsilon 3d help for all keys";;
    on|off)
      python3 - "$CFG" "$sub" <<'PY' || { echo "could not update $CFG"; return 1; }
import json, os, sys
path, want = sys.argv[1], sys.argv[2] == "on"
try:
    cfg = json.load(open(path))
except (OSError, ValueError):
    cfg = {}
cfg.setdefault("hypr", {})["cube"] = want
os.makedirs(os.path.dirname(path), exist_ok=True)
json.dump(cfg, open(path, "w"), indent=2)
print("3D cube", "on" if want else "off")
PY
      python3 "$ROOT/scripts/gen-theme.py" --paths-only >/dev/null || { echo "gen failed"; return 1; }
      hyprctl reload >/dev/null 2>&1 || echo "(hyprctl reload failed — not in a Hyprland session?)";;
    toggle)
      # Hypr3D (walkable 3D room) when its plugin is loaded, else the cube-feel animations
      st=$(_3d_plugin_state)
      if [ "$st" = loaded ]; then
        hyprctl eval 'hl.plugin.hypr3d.toggle()' >/dev/null
      else
        case "$st" in
          installed) echo "Hypr3D is built but not loaded yet — log out and back in to use the room";;
          *) echo "Hypr3D room not installed (ypsilon 3d install) — toggling the cube animations instead";;
        esac
        if [ "$cur" = on ]; then cmd_3d off; else cmd_3d on; fi
        have notify-send && [ "$st" != loaded ] && notify-send -a Ypsilon "3D room not ready" \
          "$([ "$st" = installed ] && echo 'Log out and back in to load it' || echo 'Run: ypsilon 3d install')"
      fi;;
    install)
      # Hypr3D (github.com/samine825/Hypr3D): built from source against the installed Hyprland headers.
      # Needs: cmake, a C++23 compiler, and Hyprland's headers (/usr/include/hyprland). No hyprpm required.
      have cmake || { echo "cmake not found (Arch: sudo pacman -S cmake)"; return 1; }
      [ -f /usr/include/hyprland/src/plugins/PluginAPI.hpp ] || { echo "Hyprland headers missing (Arch: reinstall the hyprland package)"; return 1; }
      local dest=${XDG_CONFIG_HOME:-$HOME/.config}/ypsilon/plugins src
      src=${XDG_CACHE_HOME:-$HOME/.cache}/ypsilon/hypr3d-src
      mkdir -p "$dest" "$(dirname "$src")"
      if [ -d "$src/.git" ]; then git -C "$src" pull --ff-only -q || return 1
      else git clone --depth 1 https://github.com/samine825/Hypr3D "$src" || return 1; fi
      echo "building Hypr3D for $(Hyprland --version 2>/dev/null | head -1)…"
      # Ypsilon patch: arrow-key movement (frees WASD for games) + input.sticky_focus
      git -C "$src" checkout -q -- . && git -C "$src" apply "$ROOT/extras/hypr3d/ypsilon.patch" || { echo "patch did not apply (upstream changed?)"; return 1; }
      cmake -S "$src" -B "$src/build" -DHYPRLAND_HEADERS=/usr >/dev/null && cmake --build "$src/build" -j"$(nproc)" || { echo "build failed"; return 1; }
      # new inode: overwriting a .so the running compositor has mapped can crash it
      rm -f "$dest/hypr3d.so" && cp "$src/build/hypr3d.so" "$dest/hypr3d.so" || return 1
      python3 -I "$ROOT/scripts/make-3d-world.py" || echo "(world generation failed — room will use the plain grid)"
      echo "installed $dest/hypr3d.so — takes effect at next login (or: hyprctl plugin unload/load, risky while windows are open); toggle with SUPER+Z";;
    *) echo "usage: ypsilon 3d [on|off|toggle|status|install|help]"; return 1;;
  esac
}

# picture-in-picture: float + pin the focused window small in the bottom-right; again = back to tiled
# tagged ypsilon-pip so rules.lua keeps it above tiled windows (YouTube F / SUPER+F)
cmd_pip() {
  local info addr
  info=$(hyprctl activewindow); addr=$(echo "$info" | awk 'NR==1{print "0x"$2}')
  [ "$addr" != "0x" ] && [ -n "$addr" ] || { echo "no active window"; return 1; }
  if echo "$info" | grep -q $'^\tpinned: 1'; then
    hyprctl --batch "dispatch tagwindow --rem ypsilon-pip address:$addr; dispatch pin address:$addr; dispatch settiled address:$addr" >/dev/null; echo off
  else
    hyprctl --batch "dispatch setfloating address:$addr; dispatch resizewindowpixel exact 30% 30%,address:$addr; dispatch movewindowpixel exact 69% 68%,address:$addr; dispatch tagwindow ypsilon-pip address:$addr; dispatch pin address:$addr" >/dev/null; echo on
  fi
}

# snap the active floating video to a screen corner (keeps pin + ypsilon-pip tag)
cmd_pip_corner() {
  local info addr pos
  pos="${1:-}"
  case "$pos" in
    1|2|3|4) ;;
    *) echo "usage: ypsilon pip-corner {1|2|3|4} (1=TL 2=TR 3=BL 4=BR)"; return 1;;
  esac
  info=$(hyprctl activewindow); addr=$(echo "$info" | awk 'NR==1{print "0x"$2}')
  [ "$addr" != "0x" ] && [ -n "$addr" ] || { echo "no active window"; return 1; }
  case "$pos" in
    1) set -- "exact 1% 5%";;    # top-left (below the bar)
    2) set -- "exact 69% 5%";;   # top-right
    3) set -- "exact 1% 68%";;   # bottom-left
    4) set -- "exact 69% 68%";;  # bottom-right
  esac
  hyprctl --batch "dispatch setfloating address:$addr; dispatch tagwindow ypsilon-pip address:$addr; dispatch pin address:$addr; dispatch movewindowpixel $1,address:$addr" >/dev/null; echo "corner $pos"
}
