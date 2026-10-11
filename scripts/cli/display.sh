# shellcheck shell=bash
# Screen color — night light (temperature) and gamma share ONE hyprsunset daemon, driven over its
# IPC (`hyprctl hyprsunset ...`), so the two never fight over the color matrix. Hyprland animates
# every matrix change itself (render:ctm_animation), so single steps already glide; `gamma fade`
# adds long, stepped transitions on top. Neutral (6000 K + 100 %) stops our daemon: zero cost.

GAMMA_MIN=20      # floor: below this the screen is unreadable (hyprsunset itself accepts 0)
GAMMA_MAX=150     # >100 brightens, clips highlights; needs a daemon started with --gamma_max
NEUTRAL_K=6000

# sunset_get gamma|temperature — integer from the daemon answering in THIS Hyprland session
sunset_get() {
  local v; v=$(hyprctl hyprsunset "$1" 2>/dev/null) || return 1
  [[ $v =~ ^[0-9]+(\.[0-9]+)?$ ]] || return 1
  printf '%.0f\n' "$v"
}
sunset_set() { [ "$(hyprctl hyprsunset "$1" "$2" 2>/dev/null)" = ok ]; }

# sunset_up — make sure a daemon answers (starts ours: neutral, with gamma headroom)
sunset_up() {
  sunset_get gamma >/dev/null && return 0
  have hyprsunset || { echo "install hyprsunset" >&2; return 1; }
  once sunset hyprsunset -t "$NEUTRAL_K" --gamma_max "$GAMMA_MAX"
  local i; for ((i = 0; i < 40; i++)); do sunset_get gamma >/dev/null && return 0; sleep 0.05; done
  echo "hyprsunset did not answer (is this a Hyprland session?)" >&2; return 1
}

# sunset_tidy — both channels neutral: stop our daemon (a foreign one, e.g. your own schedule, stays)
sunset_tidy() {
  [ "$(sunset_get gamma)" = 100 ] && [ "$(sunset_get temperature)" = "$NEUTRAL_K" ] || return 0
  ours sunset && stop_daemons sunset >/dev/null
  return 0
}

night_temp() { echo "${YPSILON_NIGHT_TEMP:-$(cfg_num display.nightTemp 4000 1000 6000)}"; }
night_status() { local t; t=$(sunset_get temperature) && [ "$t" -lt "$NEUTRAL_K" ] && echo on || echo off; }

cmd_nightlight() {
  case "${1:-toggle}" in
    status) night_status;;
    on) sunset_up && sunset_set temperature "$(night_temp)" && echo on;;
    off) if sunset_get temperature >/dev/null; then sunset_set temperature "$NEUTRAL_K"; sunset_tidy; fi; echo off;;
    toggle) if [ "$(night_status)" = on ]; then cmd_nightlight off; else cmd_nightlight on; fi;;
    *) echo "usage: ypsilon nightlight [on|off|toggle|status]"; return 1;;
  esac
}

gamma_now() { sunset_get gamma || echo 100; }

# a running `gamma fade` is cancelled by any newer gamma command (last writer wins, like a slider)
FADE_PID=${XDG_RUNTIME_DIR:-/tmp}/ypsilon/${WAYLAND_DISPLAY:-wl}.gamma-fade.pid
cancel_fade() {
  local p; p=$(cat "$FADE_PID" 2>/dev/null) || return 0
  [ "$p" != "$$" ] && grep -qa ypsilon "/proc/$p/cmdline" 2>/dev/null && kill "$p" 2>/dev/null
  rm -f "$FADE_PID"
}

# gamma_apply TARGET — clamp, set, tidy; prints the value actually in effect
gamma_apply() {
  local to=$1
  ((to < GAMMA_MIN)) && to=$GAMMA_MIN
  ((to > GAMMA_MAX)) && to=$GAMMA_MAX
  if [ "$to" = 100 ] && ! sunset_get gamma >/dev/null; then echo 100; return 0; fi  # already neutral
  sunset_up || return 1
  if ((to > 100)) && ! ours sunset; then
    echo "note: the running hyprsunset was not started by ypsilon (no >100% headroom) — capped at 100" >&2
    to=100
  fi
  sunset_set gamma "$to" || { echo "hyprsunset rejected gamma $to" >&2; return 1; }
  sunset_tidy
  echo "$to"
}

# gamma_fade TARGET SECONDS — 1 % steps spread evenly (e.g. wind down over an evening)
gamma_fade() {
  local to=$1 secs=$2 from d n i dt
  ((to < GAMMA_MIN)) && to=$GAMMA_MIN; ((to > GAMMA_MAX)) && to=$GAMMA_MAX
  from=$(gamma_now); d=$((to - from)); n=${d#-}
  ((n == 0)) && { echo "gamma ${to}%"; return 0; }
  mkdir -p "${FADE_PID%/*}"; echo $$ > "$FADE_PID"
  dt=$((secs * 1000 / n))
  for ((i = 1; i <= n; i++)); do
    gamma_apply $((from + d * i / n)) >/dev/null || { rm -f "$FADE_PID"; return 1; }
    ((i < n)) && sleep "$((dt / 1000)).$(printf '%03d' $((dt % 1000)))"
  done
  rm -f "$FADE_PID"
  echo "gamma ${to}%"
}

# gamma_tune — interactive: ←/→ (or -/+, h/l) step, 0 reset, d dim, q/Enter done
gamma_tune() {
  [ -t 0 ] && [ -t 1 ] || { echo "gamma tune needs a terminal"; return 1; }
  local g k rest step; step=$(cfg_num display.gammaStep 10 1 50)
  printf '%s  %s\n' "$(paint primary ◐) $(paint bold "gamma")" "$(paint dim "←/→ ±$step · ↑/↓ ±1 · 0 reset · d dim · q done")"
  g=$(gamma_now)
  while :; do
    printf '\r\e[K  %s %s' "$(meter $((g * 100 / GAMMA_MAX)) 30)" "$(paint bold "${g}%")"
    IFS= read -rsn1 k || break
    if [ "$k" = $'\e' ]; then read -rsn2 -t 0.01 rest; k+=$rest; fi
    case $k in
      $'\e[D'|-|h) g=$(gamma_apply $((g - step)));;
      $'\e[C'|+|=|l) g=$(gamma_apply $((g + step)));;
      $'\e[B'|j) g=$(gamma_apply $((g - 1)));;
      $'\e[A'|k) g=$(gamma_apply $((g + 1)));;
      0|r) g=$(gamma_apply 100);;
      d) g=$(gamma_apply "$(cfg_num display.gammaDim 70 "$GAMMA_MIN" 100)");;
      q|''|$'\e') break;;
    esac
    [ -n "$g" ] || g=$(gamma_now)
  done
  printf '\n'
}

cmd_gamma() {
  local sub=${1:-status} arg step v a secs osd=1
  local -a pos=()
  shift || true
  for a in "$@"; do case $a in --quiet|-q) osd=0;; --*) ;; *) pos+=("${a%\%}");; esac; done
  arg=${pos[0]:-}
  [ -z "$arg" ] || [[ $arg =~ ^[+-]?[0-9]+$ ]] || { echo "not a number: $arg"; return 1; }
  step=$(cfg_num display.gammaStep 10 1 50)
  [ "$sub" = status ] || [ "$sub" = get ] || cancel_fade
  case $sub in
    status) echo "gamma $(gamma_now)%"; return;;
    get) gamma_now; return;;
    set)
      [ -n "$arg" ] || { echo "usage: ypsilon gamma set N   ($GAMMA_MIN..$GAMMA_MAX, or +N/-N)"; return 1; }
      case $arg in [+-]*) arg=$(( $(gamma_now) + arg ));; esac
      v=$(gamma_apply "$arg") || return 1;;
    lower|down) v=$(gamma_apply $(( $(gamma_now) - ${arg:-$step} ))) || return 1;;
    raise|up) v=$(gamma_apply $(( $(gamma_now) + ${arg:-$step} ))) || return 1;;
    reset) v=$(gamma_apply 100) || return 1;;
    toggle)
      if [ "$(gamma_now)" = 100 ]; then v=$(gamma_apply "$(cfg_num display.gammaDim 70 "$GAMMA_MIN" 100)")
      else v=$(gamma_apply 100); fi || return 1;;
    fade)
      [ -n "$arg" ] || { echo "usage: ypsilon gamma fade N [SECONDS]   (default 60)"; return 1; }
      secs=${pos[1]:-60}; [[ $secs =~ ^[0-9]+$ ]] || { echo "not a number of seconds: $secs"; return 1; }
      gamma_fade "$arg" "$secs"; return;;
    tune) gamma_tune; return;;
    *) echo "usage: ypsilon gamma [status|get|set N|lower [STEP]|raise [STEP]|reset|toggle|fade N [SECS]|tune]"; return 1;;
  esac
  [ "$osd" = 1 ] && shell_osd gamma   # --quiet: the caller shows the value itself (control-center slider)
  echo "gamma ${v}%"
}
