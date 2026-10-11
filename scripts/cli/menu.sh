# shellcheck shell=bash
# Quick menu — one keyboard-driven list of the common display / theme / audio / session tweaks,
# each entry showing its live state. Picker: fzf in a terminal, fuzzel in the session
# (SUPER+ALT+M). `ypsilon menu --list` prints the entries (scripts, tests).

# "ID NAME" of the audio output after the current default (wraps around); empty if just one
audio_next_sink() {
  wpctl status 2>/dev/null | awk '
    /Sinks:/ && !done { f = 1; next }
    f && /(Sources|Filters|Streams):/ { f = 0; done = 1 }
    f && match($0, /[0-9]+\. /) {
      line = substr($0, RSTART); id = line + 0; name = substr(line, index(line, ". ") + 2)
      sub(/ *\[vol:.*/, "", name)
      # same rule as shortDeviceName (shell/lib/audio.ts): the port after "Controller" is what you recognise
      if (match(name, /Controller /)) name = substr(name, RSTART + 11)
      sub(/ *\((Stereo|Mono|Surround[^)]*)\)$/, "", name); sub(/ Output$/, "", name)
      n++; ids[n] = id; names[n] = name
      if ($0 ~ /\*/) cur = n
    }
    END { if (n > 1) { nx = cur % n + 1; print ids[nx], names[nx] } }'
}

# fills the caller's MENU (label → action) and ORDER (labels in display order)
menu_build() {
  local g n dim lay mute sink t cur
  add() { MENU["$1"]=$2; ORDER+=("$1"); }
  g=$(gamma_now); n=$(night_status); dim=$(cfg_num display.gammaDim 70 20 100)
  add "☾  Night light          $([ "$n" = on ] && echo "● on" || echo "○ off")" "nightlight toggle"
  add "◐  Gamma $g%  ·  lower"  "gamma lower"
  add "◑  Gamma $g%  ·  raise"  "gamma raise"
  add "◒  Gamma  ·  $([ "$g" = 100 ] && echo "dim to $dim%" || echo "back to 100%")" "gamma toggle"
  add "⚡  Game mode            $([ "$(cmd_gamemode status)" = on ] && echo "● on" || echo "○ off")" "gamemode toggle"
  add "☕  Caffeine             $([ "$(cmd_caffeine status)" = on ] && echo "● on" || echo "○ off")" "caffeine toggle"
  lay=$(cmd_layout status)
  add "▦  Layout  ·  ${lay} → $([ "$lay" = master ] && echo dwindle || echo master)" "layout toggle"
  if have wpctl; then
    mute=$(wpctl get-volume @DEFAULT_AUDIO_SINK@ 2>/dev/null)
    add "♪  $([[ $mute == *MUTED* ]] && echo "Unmute sound" || echo "Mute sound")" "!wpctl set-mute @DEFAULT_AUDIO_SINK@ toggle; ags request -i ypsilon osd volume"
    add "♪  Mute / unmute microphone" "!wpctl set-mute @DEFAULT_AUDIO_SOURCE@ toggle"
    sink=$(audio_next_sink)
    [ -n "$sink" ] && add "⇄  Sound output  →  ${sink#* }" "!wpctl set-default ${sink%% *}; ags request -i ypsilon osd volume"
  fi
  cur=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("active",""))' "$ROOT/themes/tokens.json" 2>/dev/null)
  for t in $(python3 "$ROOT/scripts/gen-theme.py" --list 2>/dev/null | sed -n 's/^ - \([^ ]*\).*/\1/p'); do
    add "◆  Theme  ·  ${t#ypsilon-}$([ "$t" = "$cur" ] && echo "  ●")" "theme set $t --apply"
  done
  add "◆  Theme  ·  from wallpaper" "theme auto --apply"
  add "▣  Next wallpaper" "wallpaper next"
  add "↻  Reload config + check" "reload"
  add "≡  System status" "term:status"
  add "✚  Doctor" "term:doctor"
}

cmd_menu() {
  local -A MENU=(); local -a ORDER=() argv fz; local pick act gui=1
  menu_build
  [ "${1:-}" = --list ] && { printf '%s\n' "${ORDER[@]}"; return 0; }
  [ -t 1 ] && have fzf && gui=0
  if [ "$gui" = 0 ]; then
    pick=$(printf '%s\n' "${ORDER[@]}" | fzf --prompt='ypsilon › ' --height=~70% --layout=reverse --border=rounded \
      --border-label=' ✦ ypsilon ' --info=hidden --no-scrollbar --pointer='▍') || return 0
  elif have fuzzel; then
    fz=(--dmenu --prompt='ypsilon › ' --lines "${#ORDER[@]}" --width 42)
    [ -f "$ROOT/extras/current/fuzzel.ini" ] && fz+=(--config "$ROOT/extras/current/fuzzel.ini")  # theme colors
    pick=$(printf '%s\n' "${ORDER[@]}" | fuzzel "${fz[@]}") || return 0
  else
    echo "quick menu needs fzf (terminal) or fuzzel (session)"; return 1
  fi
  act=${MENU[$pick]:-}
  [ -n "$act" ] || return 0
  case $act in
    term:*) if [ -t 1 ]; then "$0" "${act#term:}"; else term "\"$0\" ${act#term:}"; fi;;
    !*) bash -c "${act#!}" >/dev/null 2>&1;;
    *) read -ra argv <<< "$act"; "$0" "${argv[@]}";;
  esac
}
