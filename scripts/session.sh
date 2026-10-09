#!/usr/bin/env bash
# Ypsilon session entry — Exec'd by the login manager, never by hand.
# Logs everything to ~/.local/share/ypsilon/logs/ (this directory survives a
# failed login; SDDM's own log gets overwritten). Keeps the last 5 sessions.
set -uo pipefail
ROOT=$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/.." && pwd)
LOGDIR=~/.local/share/ypsilon/logs
mkdir -p "$LOGDIR"
ls -t "$LOGDIR"/session-*.log 2>/dev/null | tail -n +6 | xargs -r rm -f
LOG="$LOGDIR/session-$(date +%Y%m%d-%H%M%S).log"
{
  echo "== Ypsilon session $(date -Is) =="
  echo "root=$ROOT ags=$(command -v ags || echo MISSING) hyprland=$(Hyprland --version 2>/dev/null | head -1)"
  SHL=$(command -v start-hyprland || true)
  if [ -n "$SHL" ]; then exec "$SHL" -- -c "$ROOT/hypr/ypsilon.conf"; fi
  HC=$(command -v Hyprland || true)
  if [ -n "$HC" ]; then exec "$HC" -c "$ROOT/hypr/ypsilon.conf"; fi
  echo "FATAL: neither start-hyprland nor Hyprland found on PATH=$PATH"
  exit 1
} >>"$LOG" 2>&1
