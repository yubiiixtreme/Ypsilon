#!/usr/bin/env bash
# Ypsilon dev: typecheck-ish + run shell. Safe, no autostart.
set -euo pipefail
cd ~/Projects/Ypsilon/shell
if ! command -v ags &>/dev/null; then
  echo "ags not installed yet. Run ./scripts/install-deps.sh first."
  exit 1
fi
ags run ./app.tsx
