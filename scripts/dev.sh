#!/usr/bin/env bash
# Ypsilon dev: validate, then run the shell in the foreground. No autostart.
set -euo pipefail
ROOT=$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/.." && pwd)
"$ROOT/scripts/check.sh"
command -v ags &>/dev/null || { echo "ags not installed yet. Run ./scripts/install-deps.sh first."; exit 1; }
cd "$ROOT/shell" && exec ags run ./app.tsx
