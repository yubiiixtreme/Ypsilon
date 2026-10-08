#!/usr/bin/env bash
# Runs the Ypsilon shell and keeps it alive.
#  - preflight: every GI library the shell imports must be installed, else one clear notification
#  - crash -> restart with backoff (1,2,4,8,16s); 5 crashes within 2 minutes -> stop + notify
#  - clean exit (`ags quit -i ypsilon`, `ypsilon restart`) -> no restart
#  - previous log kept as shell.log.prev for post-mortems
set -uo pipefail
ROOT=${YPSILON_ROOT:-$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/.." && pwd)}
RUN=${XDG_RUNTIME_DIR:-/tmp}/ypsilon
LOG=$RUN/shell.log
mkdir -p "$RUN"

notify() { command -v notify-send >/dev/null && notify-send -a Ypsilon -u "$1" -i dialog-warning-symbolic "$2" "$3"; echo "ypsilon: $2 — $3" >&2; }

# name:version pairs the shell imports (see shell/**/*.ts gi:// imports)
REQUIRED="Astal:4.0 AstalIO:0.1 AstalHyprland:0.1 AstalTray:0.1 AstalNetwork:0.1 AstalBluetooth:0.1 AstalBattery:0.1 AstalMpris:0.1 AstalNotifd:0.1 AstalWp:0.1 AstalApps:0.1 AstalPowerProfiles:0.1 Gtk:4.0 Gtk4LayerShell:1.0"

preflight() {
  command -v ags >/dev/null || { echo "ags (aylurs-gtk-shell)"; return; }
  # Ypsilon targets the AGS v3 API (ags/gtk4, gnim); v1/v2 cannot run it
  local major; major=$(ags --version 2>/dev/null | grep -oE '[0-9]+' | head -1)
  if [ -n "$major" ] && [ "$major" -lt 3 ]; then echo "ags>=3 (found v$major)"; return; fi
  python3 -c 'import gi' 2>/dev/null || return 0   # cannot check without python-gobject; let ags report
  python3 - $REQUIRED <<'PY'
import sys, gi
missing = []
for pair in sys.argv[1:]:
    name, ver = pair.split(":")
    try:
        gi.require_version(name, ver)
    except ValueError:
        missing.append(name)
print(" ".join(missing))
PY
}

missing=$([ -n "${YPSILON_SKIP_PREFLIGHT:-}" ] || preflight)
if [ -n "$missing" ]; then
  notify critical "Ypsilon shell cannot start" "missing: $missing — run: $ROOT/scripts/install-deps.sh"
  exit 1
fi

crashes=()
delay=${YPSILON_RESTART_DELAY:-1}   # tests set 0
while true; do
  [ -f "$LOG" ] && mv -f "$LOG" "$LOG.prev"
  YPSILON_ROOT="$ROOT" ags run "$ROOT/shell/app.tsx" --log-file "$LOG"
  rc=$?
  [ $rc -eq 0 ] && exit 0   # deliberate quit

  now=$(date +%s)
  recent=()
  for t in "${crashes[@]}" "$now"; do [ $((now - t)) -lt 120 ] && recent+=("$t"); done
  crashes=("${recent[@]}")
  if [ ${#crashes[@]} -ge 5 ]; then
    notify critical "Ypsilon shell keeps crashing" "stopped after ${#crashes[@]} crashes in 2 min (exit $rc). See: ypsilon logs — restart with: ypsilon restart"
    exit 1
  fi
  echo "ypsilon: shell exited with $rc, restarting in ${delay}s" >&2
  sleep "$delay"
  delay=$(( delay < 16 ? delay * 2 : 16 ))
  [ "${YPSILON_RESTART_DELAY:-1}" = 0 ] && delay=0
done
