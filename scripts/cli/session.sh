# shellcheck shell=bash
# Session: bring-up, nested preview, reload, doctor.

cmd_start() {
  ensure_generated
  # (our own hypridle from this session is not "another session": `ypsilon restart` must not stall)
  if [ -z "${YPSILON_NESTED:-}" ] && ! ours hypridle && { pgrep -x hypridle >/dev/null 2>&1 || ags list 2>/dev/null | grep -q .; }; then
    echo "note: another desktop session seems active (hypridle/ags already running)." >&2
    echo "Prefer 'ypsilon try' for a safe nested preview — continuing in 3s (Ctrl+C to stop)." >&2
    sleep 3
  fi
  mkdir -p "${XDG_RUNTIME_DIR:-/tmp}/ypsilon"
  # wallpaper daemon (awww is the renamed swww) + restore last wallpaper
  for d in awww swww; do
    if have "$d-daemon"; then once "$d-daemon" "$d-daemon"; sleep 0.6; break; fi
  done
  "$ROOT/scripts/wallpaper.sh" restore >/dev/null 2>&1 || true
  if [ -z "${YPSILON_NESTED:-}" ]; then
    once hypridle hypridle -c "$ROOT/hypr/generated/hypridle.conf"
    if [ -x /usr/lib/hyprpolkitagent/hyprpolkitagent ]; then
      once polkit /usr/lib/hyprpolkitagent/hyprpolkitagent
    fi
  fi
  if have wl-paste && have cliphist; then
    once clip-text wl-paste --type text --watch cliphist store
    once clip-image wl-paste --type image --watch cliphist store
  fi
  # first run: create a config to edit and say where the help is
  local cfgdir=${CFG%/*}
  if [ ! -f "$cfgdir/.welcomed" ]; then
    mkdir -p "$cfgdir"
    [ -f "$CFG" ] || cp "$ROOT/config.example.json" "$CFG"
    local mod=SUPER; [ -n "${YPSILON_NESTED:-}" ] && mod=${YPSILON_TRY_MOD:-ALT}
    (sleep 4; have notify-send && notify-send -a Ypsilon -i preferences-desktop-appearance-symbolic "Welcome to Ypsilon" \
      "$mod+/ all keybinds · $mod+Space launcher · $mod+C control center"$'\n'"Customize: ypsilon config edit · Problems: ypsilon doctor") &
    touch "$cfgdir/.welcomed"
  fi
  # supervisor: preflight + crash restarts with backoff (scripts/shell-supervisor.sh)
  YPSILON_ROOT="$ROOT" once shell "$ROOT/scripts/shell-supervisor.sh"
}

cmd_try() {
  have Hyprland || { echo "Hyprland not found"; return 1; }
  [ -n "${WAYLAND_DISPLAY:-}${DISPLAY:-}" ] || { echo "run this from inside a graphical session (it opens a nested window)"; return 1; }
  # Your main session grabs SUPER first, so the preview uses ALT as its modifier.
  # (override: YPSILON_TRY_MOD=CTRL ypsilon try). Generated config lives in $XDG_RUNTIME_DIR.
  local mod=${YPSILON_TRY_MOD:-ALT} d conf
  d=${XDG_RUNTIME_DIR:-/tmp}/ypsilon; mkdir -p "$d"; conf="$d/try.conf"
  sed 's/^\$mod = SUPER/$mod = '"$mod"'/' "$ROOT/hypr/core/keybinds.conf" > "$d/try-keybinds.conf"
  ensure_generated
  sed -e "s#^source = core/keybinds.conf#source = $d/try-keybinds.conf#" -e "s#^source = \(core\|themes\|generated\)/#source = $ROOT/hypr/\1/#" "$ROOT/hypr/ypsilon.conf" > "$conf"
  echo "nested preview: modifier=$mod · exit with $mod+Shift+E, or Ctrl+C here, or close the window"
  YPSILON_NESTED=1 YPSILON_TRY_MOD=$mod exec Hyprland -c "$conf"
}

# reload — validate config.json, re-render hypr/generated from it, reload Hyprland + shell CSS,
# and report each step (a quick health check after editing anything)
cmd_reload() {
  local out bad=0
  section "reload"
  if out=$(NODE_NO_WARNINGS=1 node "$ROOT/scripts/config-check.mjs" "$CFG" 2>&1); then say_ok "config  $(paint dim "${out%%:*}")"
  else say_miss "config  ($(echo "$out" | head -1))"; echo "$out" | tail -n +2 | sed 's/^/        /'; fi
  python3 "$ROOT/scripts/gen-theme.py" --paths-only >/dev/null 2>&1 && say_ok "hypr/generated re-rendered" || { say_miss "gen-theme.py --paths-only failed"; bad=1; }
  if hyprctl reload >/dev/null 2>&1; then
    out=$(hyprctl configerrors 2>/dev/null | grep -v '^$')
    if [ -z "$out" ]; then say_ok "hyprland reloaded"; else say_miss "hyprland config errors:"; echo "$out" | head -5 | sed 's/^/        /'; bad=1; fi
  else say_miss "hyprland not reachable"; bad=1; fi
  if ags request -i ypsilon reload-css >/dev/null 2>&1; then
    out=$(ags request -i ypsilon health 2>/dev/null)
    case $out in ok*) say_ok "shell css reloaded · $out";; *) say_miss "shell: $out"; bad=1;; esac
  else say_info "shell not running (ypsilon start)"; fi
  [ $bad -eq 0 ] && echo "reloaded" || { echo "reloaded with problems (ypsilon doctor)"; return 1; }
}

cmd_doctor() {
  local bad=0 hv g t svc
  okm() { say_ok "$1"; }
  fix() { if ui; then say_miss "$1  $(paint dim "→ $2")"; else say_miss "$1  ->  $2"; fi; bad=$((bad + 1)); }
  echo "ypsilon doctor — root: $ROOT"

  section "compositor"
  hv=$(Hyprland --version 2>/dev/null | sed -n 's/^Hyprland \([0-9.]*\).*/\1/p' | head -1)
  if [ -z "$hv" ]; then fix "Hyprland" "install hyprland (>= 0.53)"
  elif [ "$(printf '%s\n0.53\n' "$hv" | sort -V | head -1)" != "0.53" ]; then fix "Hyprland $hv" "upgrade to >= 0.53"
  else okm "Hyprland $hv"; fi
  if Hyprland --verify-config -c "$ROOT/hypr/ypsilon.conf" 2>&1 | grep -q '^config ok'; then okm "hypr/ypsilon.conf parses"; else fix "hypr/ypsilon.conf has errors" "ypsilon check"; fi
  [ -f "$ROOT/hypr/generated/paths.conf" ] && okm "hypr/generated/ present" || fix "hypr/generated/" "python3 scripts/gen-theme.py"

  section "shell (AGS + Astal)"
  have ags && okm "ags $(ags --version 2>/dev/null | head -1)" || fix "ags" "AUR: aylurs-gtk-shell"
  if python3 -c 'import gi' 2>/dev/null; then
    for g in Astal:4.0 AstalIO:0.1 AstalHyprland:0.1 AstalTray:0.1 AstalNetwork:0.1 AstalBluetooth:0.1 AstalBattery:0.1 AstalBrightness:0.1 AstalCava:0.1 AstalMpris:0.1 AstalNotifd:0.1 AstalWp:0.1 AstalApps:0.1 AstalPowerProfiles:0.1 Gtk4LayerShell:1.0; do
      python3 -c "import gi,sys; gi.require_version('${g%%:*}','${g##*:}')" 2>/dev/null && okm "typelib ${g%%:*}" || fix "typelib ${g%%:*}" "./scripts/install-deps.sh"
    done
  else fix "python-gobject" "pacman -S python-gobject (needed for checks)"; fi

  section "tools"
  for t in "grim:screenshots" "slurp:region select" "wl-copy:clipboard" "cliphist:clipboard history" "fuzzel:clipboard picker + quick menu" \
           "hyprlock:lock screen" "hypridle:idle/lock timers" "brightnessctl:brightness" "playerctl:media keys" "wpctl:volume keys" \
           "nmcli:Wi-Fi" "bluetoothctl:Bluetooth" "notify-send:notifications" "hyprsunset:night light + gamma" "hyprpicker:color picker" \
           "wf-recorder:screen recording"; do
    have "${t%%:*}" && okm "${t%%:*}" || fix "${t%%:*} (${t##*:})" "./scripts/install-deps.sh"
  done
  for t in "tesseract:ypsilon ocr" "satty:ypsilon shot annotate"; do
    have "${t%%:*}" && okm "${t%%:*}" || say_info "optional: ${t%%:*} (${t##*:})"
  done
  if have awww-daemon || have swww-daemon || have hyprpaper || have swaybg; then okm "wallpaper backend"; else fix "wallpaper backend" "install awww (or swww)"; fi
  if have aether; then okm "aether (wallpaper browser + themes)"; else say_info "optional: aether (wallpaper browser; AUR: aether)"; fi
  python3 -c "import PIL" 2>/dev/null && okm "python-pillow" || fix "python-pillow (wallpaper themes)" "pacman -S python-pillow"
  [ -x /usr/lib/hyprpolkitagent/hyprpolkitagent ] && okm "polkit agent" || fix "hyprpolkitagent (password prompts for apps)" "pacman -S hyprpolkitagent"
  # two color daemons fight over the screen: hyprsunset drives night light + gamma here
  for t in gammastep wlsunset redshift; do pgrep -x "$t" >/dev/null 2>&1 && fix "$t is running (fights hyprsunset over screen color)" "pkill $t; use ypsilon nightlight / gamma"; done

  section "look"
  fc-list 2>/dev/null | grep -qi "Inter" && okm "font Inter" || fix "font Inter" "pacman -S inter-font"
  fc-list 2>/dev/null | grep -qi "JetBrainsMono Nerd" && okm "font JetBrainsMono Nerd" || fix "font JetBrainsMono Nerd" "pacman -S ttf-jetbrains-mono-nerd"
  [ -d /usr/share/icons/Adwaita ] && okm "Adwaita icons" || fix "Adwaita icons" "pacman -S adwaita-icon-theme"

  section "services"
  for svc in NetworkManager bluetooth upower; do
    systemctl is-active --quiet "$svc" 2>/dev/null && okm "$svc running" || fix "$svc not running" "sudo systemctl enable --now $svc"
  done
  # power profiles: the shell talks to the D-Bus API, which power-profiles-daemon OR tuned-ppd provide
  if busctl --system status net.hadess.PowerProfiles >/dev/null 2>&1; then okm "power profiles service (net.hadess.PowerProfiles)"
  else fix "no power profiles service" "sudo systemctl enable --now power-profiles-daemon  (or tuned-ppd if you use tuned)"; fi

  section "session"
  say_info "${XDG_CURRENT_DESKTOP:-?} / ${XDG_SESSION_TYPE:-?}"
  [ -f /usr/share/wayland-sessions/ypsilon.desktop ] && okm "login session installed" || say_info "login session not installed (scripts/install.sh) — 'ypsilon try' works without it"
  [ -f ~/.config/hypr/hyprland.lua ] && say_info "your main config is Lua (hyprland.lua); Ypsilon runs as its own session and never edits it"
  echo
  if [ $bad -eq 0 ]; then echo "doctor: $(paint good "all good")"; else echo "doctor: $(paint warn "$bad thing(s) to fix") (see the hints above)"; fi
  return 0
}
