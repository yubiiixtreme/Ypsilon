# shellcheck shell=bash
# ypsilon CLI core — process helpers, config reads and terminal styling shared by every module.
# Sourced by scripts/ypsilon (which sets ROOT); never executed directly.

have() { command -v "$1" &>/dev/null; }

# --- styling: colors only on a TTY and never with NO_COLOR (pipes, tests and the shell get plain text).
# Plain ANSI on purpose: Ypsilon themes the terminal palette itself (extras/*), so these follow the theme.
if [ -t 1 ] && [ -z "${NO_COLOR:-}" ] && [ "${TERM:-dumb}" != dumb ]; then _ui=1; else _ui=0; fi
ui() { [ "$_ui" = 1 ]; }
paint() {  # paint STYLE TEXT...   STYLE: primary accent good warn bad dim bold
  local c
  case $1 in primary) c=34;; accent) c=36;; good) c=32;; warn) c=33;; bad) c=31;; dim) c=2;; bold) c=1;; *) c=0;; esac
  shift
  if ui; then printf '\e[%sm%s\e[0m' "$c" "$*"; else printf '%s' "$*"; fi
}
# status lines: same words as before (scripts and tests grep for "OK"/"MISS"), glyphs only on a TTY
say_ok()   { if ui; then printf ' %s %s\n' "$(paint good ✓)" "$*"; else echo "OK    $*"; fi; }
say_miss() { if ui; then printf ' %s %s\n' "$(paint bad ✗)" "$*"; else echo "MISS  $*"; fi; }
say_info() { if ui; then printf ' %s %s\n' "$(paint dim ·)" "$(paint dim "$*")"; else echo "info  $*"; fi; }
section()  { if ui; then printf '\n %s %s\n' "$(paint primary ▍)" "$(paint bold "$1")"; else printf '\n== %s\n' "$1"; fi; }
# meter PCT [WIDTH] — ▰▰▰▱▱ bar (plain #/- off a TTY)
meter() {
  local pct=$1 w=${2:-20} n i on="" off="" a=# b=-
  [ "$pct" -gt 100 ] && pct=100; [ "$pct" -lt 0 ] && pct=0
  n=$(( (pct * w + 50) / 100 ))
  ui && { a=━; b=─; }
  for ((i = 0; i < w; i++)); do if [ $i -lt "$n" ]; then on+=$a; else off+=$b; fi; done
  if ui; then printf '%s%s' "$(paint primary "$on")" "$(paint dim "$off")"; else printf '[%s%s]' "$on" "$off"; fi
}

CFG=${XDG_CONFIG_HOME:-$HOME/.config}/ypsilon/config.json
# cfg_num DOTTED.PATH DEFAULT LO HI — integer from config.json, clamped like shell/lib/config.ts
cfg_num() {
  python3 - "$CFG" "$@" 2>/dev/null <<'PY' || echo "$2"
import json, sys
path, key, dflt, lo, hi = sys.argv[1:6]
try:
    v = json.load(open(path))
    for k in key.split("."): v = v[k]
    if isinstance(v, bool) or not isinstance(v, (int, float)): raise ValueError
except Exception:
    v = int(dflt)
print(int(round(min(int(hi), max(int(lo), v)))))
PY
}

# once NAME cmd... — start a background process unless this session already has it.
once() {
  local name=$1; shift
  local dir=${XDG_RUNTIME_DIR:-/tmp}/ypsilon pidf
  mkdir -p "$dir"; pidf="$dir/${WAYLAND_DISPLAY:-wl}.$name.pid"
  if [ -f "$pidf" ] && kill -0 "$(cat "$pidf")" 2>/dev/null; then return 0; fi
  command -v "$1" &>/dev/null || { echo "skip $name: $1 not installed"; return 0; }
  # not `setsid -f`: it forks, so $! would be a dead pid and the guard above would never hold
  setsid "$@" >/dev/null 2>&1 </dev/null &
  echo $! > "$pidf"
}

# ours NAME — true when this session's `once NAME` process is alive
ours() { local f=${XDG_RUNTIME_DIR:-/tmp}/ypsilon/${WAYLAND_DISPLAY:-wl}.$1.pid; [ -f "$f" ] && kill -0 "$(cat "$f")" 2>/dev/null; }

# stop NAME... (or everything this session started): each was setsid'd, so pid == process group
stop_daemons() {
  local dir=${XDG_RUNTIME_DIR:-/tmp}/ypsilon f name
  for f in "$dir/${WAYLAND_DISPLAY:-wl}".*.pid; do
    [ -f "$f" ] || continue
    name=${f##*/}; name=${name#"${WAYLAND_DISPLAY:-wl}".}; name=${name%.pid}
    if [ $# -eq 0 ] || [[ " $* " == *" $name "* ]]; then
      kill -- "-$(cat "$f")" 2>/dev/null; rm -f "$f"; echo "stopped $name"
    fi
  done
}

# hypr/generated/* bakes in the repo path; (re)create it when missing or after the repo moved
ensure_generated() {
  local p="$ROOT/hypr/generated/paths.conf"
  if [ ! -f "$p" ] || ! grep -qxF "\$YPSILON = $ROOT" "$p"; then
    python3 "$ROOT/scripts/gen-theme.py" --paths-only >/dev/null || echo "ypsilon: gen-theme failed" >&2
  fi
}

# terminal: config.json "terminal" (if set), $TERMINAL, then common ones
pick_terminal() {
  local t c
  t=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("terminal",""))' "$CFG" 2>/dev/null)
  for c in "$t" "${TERMINAL:-}" foot kitty ghostty alacritty wezterm konsole gnome-terminal xterm; do
    [ -n "$c" ] && have "${c%% *}" && { echo "$c"; return; }
  done
}

# term CMD... — run a command in a new terminal window that stays open at the end
term() {
  local t; t=$(pick_terminal)
  [ -n "$t" ] || { echo "no terminal found (set terminal in config.json)"; return 1; }
  local script="$*; echo; read -rp 'done - press Enter to close'"
  local -a argv; read -ra argv <<< "$t"
  case "${argv[0]}" in
    wezterm) setsid "${argv[@]}" start -- bash -c "$script" >/dev/null 2>&1 & ;;
    kitty) setsid "${argv[@]}" bash -c "$script" >/dev/null 2>&1 & ;;
    gnome-terminal) setsid "${argv[@]}" -- bash -c "$script" >/dev/null 2>&1 & ;;
    *) setsid "${argv[@]}" -e bash -c "$script" >/dev/null 2>&1 & ;;
  esac
}

# install_plan PKG... — one command that installs everything, navapkg-style:
# repo packages -> pacman, AUR -> paru/yay, apps -> flatpak. Prints the command;
# the caller runs it in a terminal. Unknown names fail the whole plan.
install_plan() {
  local p h aur="" repo_pkgs="" aur_pkgs="" flat_pkgs="" app cmd=""
  for h in paru yay; do have "$h" && { aur=$h; break; }; done
  for p in "$@"; do
    if pacman -Si "$p" >/dev/null 2>&1; then repo_pkgs="$repo_pkgs $p"
    elif [ -n "$aur" ] && "$aur" -Si "$p" >/dev/null 2>&1; then aur_pkgs="$aur_pkgs $p"
    elif app=$(flat_app "$p") && [ -n "$app" ]; then flat_pkgs="$flat_pkgs $app"
    else echo "no package '$p' (repo, AUR, flatpak)"; return 1
    fi
  done
  [ -n "$repo_pkgs" ] && cmd="sudo pacman -S --needed$repo_pkgs"
  if [ -n "$aur_pkgs" ]; then [ -n "$cmd" ] && cmd="$cmd && "; cmd="$cmd$aur -S$aur_pkgs"; fi
  if [ -n "$flat_pkgs" ]; then [ -n "$cmd" ] && cmd="$cmd && "; cmd="$cmd""flatpak install -y$flat_pkgs"; fi
  printf '%s\n' "$cmd"
}

# flat_app NAME — first flatpak app id matching NAME, empty when none
flat_app() {
  have flatpak || return 1
  if have timeout; then timeout 25 flatpak search --columns=application "$1" 2>/dev/null | tail -n +2 | grep -i -m1 "$1"
  else flatpak search --columns=application "$1" 2>/dev/null | tail -n +2 | grep -i -m1 "$1"; fi
}

# shell_osd MODE — flash the shell OSD if the shell is up; silent otherwise
shell_osd() { have ags && ags request -i ypsilon osd "$1" >/dev/null 2>&1 || true; }
