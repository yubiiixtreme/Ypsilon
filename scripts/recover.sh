#!/usr/bin/env bash
# Repairs what the old Ypsilon installer (before the install-deps safety rewrite) could leave
# behind. Read-only diagnosis first; every change asks before it happens.
#
#   ./scripts/recover.sh            interactive, run in a terminal
#
#  1. stale pacman lock (only when no package manager is running)
#  2. tuned-ppd replaced by power-profiles-daemon -> put tuned-ppd back
#  3. Quickshell (Caelestia etc.) built against an older Qt than installed -> rebuild it
#  4. kernel upgraded under you -> tell you to reboot (and that the LTS entry is a fallback)
set -uo pipefail
[ -t 0 ] || { echo "recover: run this in a terminal (it asks before every change)" >&2; exit 2; }

ask() { local r; read -rp "$1 [y/N] " r; [[ "$r" =~ ^[Yy]$ ]]; }
say() { printf '\n== %s\n' "$*"; }
AUR=""; for h in paru yay; do command -v "$h" >/dev/null && { AUR=$h; break; }; done

say "1. pacman lock"
if [ -e /var/lib/pacman/db.lck ]; then
  if pgrep -x "pacman|paru|yay|makepkg" >/dev/null; then
    echo "a package manager is running — leaving the lock alone"
  elif ask "stale lock /var/lib/pacman/db.lck (no package manager running). Remove it?"; then
    sudo rm /var/lib/pacman/db.lck && echo "removed"
  fi
else
  echo "ok (no lock)"
fi

say "2. power profiles"
if pacman -Q tuned >/dev/null 2>&1 && ! pacman -Q tuned-ppd >/dev/null 2>&1 && pacman -Q power-profiles-daemon >/dev/null 2>&1 \
   && grep -q "removed tuned-ppd" /var/log/pacman.log; then
  echo "tuned-ppd was replaced by power-profiles-daemon (you use tuned)."
  if ask "Put tuned-ppd back (pacman will ask to remove power-profiles-daemon — answer y)?"; then
    sudo pacman -S --needed tuned-ppd && sudo systemctl enable --now tuned-ppd && echo "tuned-ppd restored"
  fi
else
  echo "ok"
fi

say "3. Quickshell vs Qt"
qs=$(pacman -Qq 2>/dev/null | grep -E '^quickshell(-git)?$' | head -1 || true)
if [ -n "$qs" ] && pacman -Q qt6-base >/dev/null 2>&1; then
  built=$(date -d "$(pacman -Qi "$qs" | sed -n 's/^Build Date *: //p')" +%s 2>/dev/null || echo 0)
  qt=$(date -d "$(pacman -Qi qt6-base | sed -n 's/^Install Date *: //p')" +%s 2>/dev/null || echo 0)
  if [ "$built" -lt "$qt" ]; then
    echo "$qs was built before your current Qt was installed — Quickshell shells (e.g. Caelestia) may crash."
    if [ -n "$AUR" ] && ask "Rebuild $qs now with $AUR (takes a few minutes)?"; then
      "$AUR" -S --rebuild "$qs" && echo "$qs rebuilt"
    fi
  else
    echo "ok ($qs is newer than Qt)"
  fi
else
  echo "ok (no Quickshell)"
fi

say "4. kernel"
running=$(uname -r)
if [ -d "/usr/lib/modules/$running" ]; then
  echo "ok (running $running)"
else
  echo "running $running but its modules were replaced by an upgrade: new drivers can't load until you reboot."
  echo "Reboot when convenient. If the new kernel misbehaves, pick the LTS entry in the boot menu."
fi

echo
echo "Next: ./scripts/install.sh --make-default   (installs, live-tests, and only then makes Ypsilon the default)"
