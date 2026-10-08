#!/usr/bin/env bash
# ypsilon screen recorder — wf-recorder backend. Only runs when YOU invoke it.
# Usage: record.sh {select|full|stop}   (no arg toggles select/stop)
set -euo pipefail
PID=~/.cache/ypsilon/record.pid
OUT=~/Videos/ypsilon-$(date +%Y%m%d_%H%M%S).mp4

stop() {
  if [ -f "$PID" ] && kill -INT "$(cat "$PID")" 2>/dev/null; then
    rm -f "$PID"; echo "record stopped"
  else
    rm -f "$PID"; pkill -INT wf-recorder 2>/dev/null || echo "not recording"
  fi
}

start() {
  command -v wf-recorder &>/dev/null || { echo "install wf-recorder first"; exit 1; }
  mkdir -p "$(dirname "$PID")" ~/Videos
  [ -f "$PID" ] && { echo "already recording (stop first)"; exit 1; }
  if [ "${1:-select}" = "full" ]; then
    wf-recorder -f "$OUT" & echo $! > "$PID"
  else
    command -v slurp &>/dev/null || { echo "install slurp first"; exit 1; }
    wf-recorder -g "$(slurp)" -f "$OUT" & echo $! > "$PID"
  fi
  echo "recording -> $OUT"
}

case "${1:-toggle}" in
  stop) stop;;
  full) start full;;
  select) start select;;
  toggle) if [ -f "$PID" ]; then stop; else start select; fi;;
  *) echo "usage: record.sh {select|full|stop}"; exit 1;;
esac
