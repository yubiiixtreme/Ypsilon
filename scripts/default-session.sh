#!/usr/bin/env bash
# Which session your display manager preselects at login.
#
#   scripts/default-session.sh status
#   scripts/default-session.sh set [/usr/share/wayland-sessions/ypsilon.desktop]
#   scripts/default-session.sh restore        back to what it was before the first `set`
#
# SDDM is automated (its [Last] Session in /var/lib/sddm/state.conf, backed up once as
# state.conf.pre-ypsilon). Other display managers get instructions. Your old sessions always
# stay in the login screen's session list.
set -euo pipefail
SESSION=${2:-/usr/share/wayland-sessions/ypsilon.desktop}
STATE=/var/lib/sddm/state.conf
BACKUP=$STATE.pre-ypsilon

dm=$(basename "$(readlink -f /etc/systemd/system/display-manager.service 2>/dev/null || echo none)" .service)

current() { sudo sed -n 's/^Session=//p' "$STATE" 2>/dev/null | head -1; }

if [ "$dm" != sddm ]; then
  case "$dm" in
    gdm*) echo "GDM: pick 'Ypsilon' with the gear icon once; GDM remembers it.";;
    greetd) echo "greetd: set command = \"$(sed -n 's/^Exec=//p' "$SESSION" 2>/dev/null)\" in /etc/greetd/config.toml (keep a backup).";;
    ly*) echo "ly: choose 'Ypsilon' with the arrow keys once; ly remembers it.";;
    *) echo "display manager '$dm': pick 'Ypsilon' in its session menu once.";;
  esac
  exit 0
fi

case "${1:-status}" in
  status) echo "sddm preselects: $(current || echo '(none)')";;
  set)
    [ -f "$SESSION" ] || { echo "no session file $SESSION (run scripts/install.sh first)"; exit 1; }
    sudo test -f "$BACKUP" || { sudo test -f "$STATE" && sudo cp -a "$STATE" "$BACKUP" && echo "backed up $STATE -> $BACKUP"; } || true
    if sudo grep -q '^Session=' "$STATE" 2>/dev/null; then
      sudo sed -i "s|^Session=.*|Session=$SESSION|" "$STATE"
    else
      printf '[Last]\nSession=%s\n' "$SESSION" | sudo tee -a "$STATE" >/dev/null
    fi
    echo "sddm will preselect: $(current)";;
  restore)
    if sudo test -f "$BACKUP"; then sudo cp -a "$BACKUP" "$STATE" && echo "restored: $(current)"
    else echo "no backup ($BACKUP) — nothing to restore"; fi;;
  *) echo "usage: default-session.sh {status|set [SESSION_FILE]|restore}"; exit 2;;
esac
