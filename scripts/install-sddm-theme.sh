#!/usr/bin/env bash
# Ypsilon login theme for SDDM (opt-in).
#
#   scripts/install-sddm-theme.sh status    show the current SDDM theme
#   scripts/install-sddm-theme.sh set       install extras/sddm-ypsilon and select it
#   scripts/install-sddm-theme.sh restore   go back to the previous theme
#
# Only writes /usr/share/sddm/themes/ypsilon and /etc/sddm.conf.d/20-ypsilon.conf.
# Your old theme stays installed; `restore` re-selects it. Needs sudo for those two paths.
set -euo pipefail
ROOT=$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/.." && pwd)
THEME_DIR=/usr/share/sddm/themes/ypsilon
CONF=/etc/sddm.conf.d/20-ypsilon.conf
SRC="$ROOT/extras/sddm-ypsilon"

current() {
  local v=""
  v=$(grep -h '^Current=' /etc/sddm.conf.d/*.conf 2>/dev/null | tail -1 | cut -d= -f2 || true)
  [ -n "$v" ] || v="(sddm default)"
  printf '%s\n' "$v"
}

case "${1:-status}" in
  status)
    echo "sddm theme: $(current)"
    [ -d "$THEME_DIR" ] && echo "ypsilon theme: installed" || echo "ypsilon theme: not installed";;
  set)
    [ -f "$SRC/Main.qml" ] || { echo "missing: $SRC/Main.qml"; exit 1; }
    prev=$(current)
    sudo mkdir -p "$THEME_DIR"
    sudo cp -a "$SRC/Main.qml" "$SRC/metadata.desktop" "$SRC/theme.conf" "$THEME_DIR/"
    printf '[Theme]\nCurrent=ypsilon\n' | sudo tee "$CONF" >/dev/null
    echo "installed $THEME_DIR (previous theme was: $prev)"
    echo "take effect at the next login (no reboot needed)";;
  restore)
    if [ -f "$CONF" ]; then
      sudo rm -f "$CONF"
      echo "removed $CONF"
    else
      echo "nothing to restore ($CONF not present)"
    fi
    echo "sddm theme: $(current)";;
  *)
    echo "usage: install-sddm-theme.sh {status|set|restore}"; exit 2;;
esac
