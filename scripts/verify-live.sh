#!/usr/bin/env bash
# Prove Ypsilon actually works before anyone logs into it:
# boot it in a nested Hyprland window, wait until the shell answers `health` with "ok",
# then shut the nested session down again. Exit 0 = healthy.
#
#   scripts/verify-live.sh            (run from your normal desktop; a window opens briefly)
set -uo pipefail
ROOT=$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/.." && pwd)
RUN=${XDG_RUNTIME_DIR:-/tmp}/ypsilon
LOG=$RUN/verify-live.log
TIMEOUT=${YPSILON_VERIFY_TIMEOUT:-60}
mkdir -p "$RUN"

[ -n "${WAYLAND_DISPLAY:-}" ] || { echo "verify-live: needs a graphical session"; exit 2; }
command -v ags >/dev/null || { echo "verify-live: ags is not installed (scripts/install-deps.sh)"; exit 1; }
if ags request -i ypsilon health >/dev/null 2>&1; then
  echo "verify-live: an Ypsilon shell is already running — stop it first (ypsilon stop)"; exit 1
fi

shopt -s nullglob
before=("$RUN"/*.pid)
echo "booting Ypsilon in a nested window (max ${TIMEOUT}s)…"
"$ROOT/scripts/ypsilon" try >"$LOG" 2>&1 &
nested=$!

health=""
for _ in $(seq 1 "$TIMEOUT"); do
  sleep 1
  kill -0 "$nested" 2>/dev/null || { echo "nested Hyprland exited early"; break; }
  if h=$(ags request -i ypsilon health 2>/dev/null); then
    sleep 3   # let late components (plugins, bars) finish, then ask again
    health=$(ags request -i ypsilon health 2>/dev/null || echo "$h")
    break
  fi
done

# tear down: shell, daemons started by the nested session, the nested compositor
ags quit -i ypsilon >/dev/null 2>&1
for f in "$RUN"/*.pid; do
  case " ${before[*]} " in *" $f "*) continue;; esac
  kill -- "-$(cat "$f")" 2>/dev/null; rm -f "$f"
done
kill "$nested" 2>/dev/null; wait "$nested" 2>/dev/null

if [[ "$health" == ok:* ]]; then
  echo "PASS — $health"
  exit 0
fi
echo "FAIL — shell health: ${health:-no answer within ${TIMEOUT}s}"
[ -f "$RUN/shell.log" ] && { echo "--- shell.log (last 30 lines)"; tail -n 30 "$RUN/shell.log"; }
echo "--- nested session log: $LOG"
exit 1
