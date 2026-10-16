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
cmd_3d() {
  local sub="${1:-toggle}" cur
  cur=$(python3 -c 'import json,sys; print("on" if json.load(open(sys.argv[1])).get("hypr",{}).get("cube",True) else "off")' "$CFG" 2>/dev/null || echo on)
  case "$sub" in
    status) echo "$cur";;
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
    toggle) if [ "$cur" = on ]; then cmd_3d off; else cmd_3d on; fi;;
    install)
      # true 3D compositor plugin (desktop-cube.so). Needs hyprpm + Hyprland headers.
      if ! have hyprpm; then echo "hyprpm not found (Arch: sudo pacman -S hyprpm hyprland-protocols)"; return 1; fi
      local dest=${XDG_CONFIG_HOME:-$HOME/.config}/ypsilon/plugins
      mkdir -p "$dest"
      echo "building desktop-cube into $dest (must match Hyprland $(Hyprland --version 2>/dev/null | head -1))…"
      (cd "$dest" && hyprpm add https://github.com/pluseight8/omarchy-desktop-cube 2>/dev/null || true)
      echo "If hyprpm built desktop-cube.so, move it to $dest/desktop-cube.so, then reload (SUPER+ALT+R).";;
    *) echo "usage: ypsilon 3d [on|off|toggle|status|install]"; return 1;;
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
