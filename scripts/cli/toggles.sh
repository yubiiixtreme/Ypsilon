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

# picture-in-picture: float + pin the focused window small in the bottom-right; again = back to tiled
# tagged ypsilon-pip so rules.conf keeps it above fullscreen apps (YouTube F / SUPER+F)
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

# snap the active floating video to a screen corner (keeps pin + top-layer tag)
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
