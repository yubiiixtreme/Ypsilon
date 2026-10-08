#!/usr/bin/env bash
# Ypsilon dependencies. Arch (+ an AUR helper) is automated; other distros get the list.
#
#   ./scripts/install-deps.sh          interactive (run it in a terminal)
#   ./scripts/install-deps.sh --yes    non-interactive (pacman/paru --noconfirm)
#
# Safety rules (learned the hard way):
#  - NO system upgrade: plain `pacman -S --needed`, never `-Syu`. Upgrading your system
#    (kernel, Qt, ...) is your decision, not a side effect of installing a shell.
#  - Packages already satisfied by an installed provider are skipped (`pacman -T`), so your
#    alternatives stay: tuned-ppd is NOT replaced by power-profiles-daemon, nodejs-lts stays, ...
#  - Exact AUR packages (`--noprovides`): no "N providers, enter a number" prompt.
#  - Refuses piped stdin without --yes: `yes | install-deps.sh` once answered a numeric
#    prompt with "y" forever and filled a RAM-backed /tmp with a 2.8 GB log.
set -euo pipefail

YES=""
[ "${1:-}" = "--yes" ] && YES=1
if [ -z "$YES" ] && [ ! -t 0 ]; then
  echo "install-deps: stdin is not a terminal. Run it in a terminal, or pass --yes for a non-interactive install." >&2
  exit 2
fi
PAC_FLAGS=(--needed); AUR_FLAGS=(--needed --noprovides)
[ -n "$YES" ] && PAC_FLAGS+=(--noconfirm) && AUR_FLAGS+=(--noconfirm)

PACMAN_PKGS=(
  hyprland gtk4 gtk4-layer-shell gobject-introspection python-gobject python-pillow
  networkmanager bluez bluez-utils upower power-profiles-daemon wireplumber
  grim slurp wl-clipboard cliphist wf-recorder libnotify
  hyprlock hypridle hyprpolkitagent hyprsunset hyprpicker xdg-desktop-portal-hyprland xdg-utils
  brightnessctl playerctl fuzzel foot pacman-contrib
  ttf-jetbrains-mono-nerd inter-font adwaita-icon-theme
  nodejs npm
)
AUR_PKGS=(aylurs-gtk-shell libastal-meta)

if ! command -v pacman >/dev/null; then
  cat <<'MSG'
Ypsilon's installer automates Arch Linux only. On your distro, install the equivalents of:
  compositor/shell : Hyprland >= 0.53, AGS v3 (aylurs-gtk-shell), Astal libraries
                     (astal4 io hyprland tray network bluetooth battery mpris notifd wireplumber apps powerprofiles cava)
  gtk              : gtk4, gtk4-layer-shell, gobject-introspection, python3-gobject, python3-pillow
  services         : NetworkManager, bluez, upower, a power-profiles provider (power-profiles-daemon or tuned-ppd), wireplumber
  tools            : grim slurp wl-clipboard cliphist wf-recorder libnotify brightnessctl playerctl fuzzel
                     hyprlock hypridle hyprpolkitagent hyprsunset hyprpicker xdg-desktop-portal-hyprland
  fonts/icons      : Inter, JetBrainsMono Nerd Font, Adwaita icon theme
  dev              : nodejs, npm
Then run: ./scripts/ypsilon doctor
MSG
  exit 1
fi

echo "== Ypsilon deps (Arch) — no system upgrade will be performed =="
# keep only what no installed package already provides
mapfile -t MISSING < <(pacman -T "${PACMAN_PKGS[@]}" || true)
if [ ${#MISSING[@]} -gt 0 ]; then
  echo "installing: ${MISSING[*]}"
  if ! sudo pacman -S "${PAC_FLAGS[@]}" "${MISSING[@]}"; then
    echo "pacman failed. If it was a download error (404), your package databases are older than the"
    echo "mirrors: update your system first (sudo pacman -Syu), then re-run this script."
    exit 1
  fi
else
  echo "all repo packages already present"
fi

AUR=""
for h in paru yay; do command -v "$h" >/dev/null && { AUR=$h; break; }; done
mapfile -t AUR_MISSING < <(pacman -T "${AUR_PKGS[@]}" || true)
if [ ${#AUR_MISSING[@]} -gt 0 ]; then
  if [ -z "$AUR" ]; then
    echo "No AUR helper (paru/yay) found. Install one, then: paru -S --needed --noprovides ${AUR_MISSING[*]}"
    exit 1
  fi
  if [ "$AUR" = yay ]; then  # yay has no --noprovides
    AUR_FLAGS=(--needed); [ -n "$YES" ] && AUR_FLAGS+=(--noconfirm)
  fi
  echo "AUR: ${AUR_MISSING[*]} (this builds from source and can take a while)"
  "$AUR" -S "${AUR_FLAGS[@]}" "${AUR_MISSING[@]}"
fi

# wallpaper daemon (optional): awww is the renamed swww — only if no backend exists yet
if ! command -v awww >/dev/null && ! command -v swww >/dev/null && ! command -v hyprpaper >/dev/null && ! command -v swaybg >/dev/null; then
  sudo pacman -S "${PAC_FLAGS[@]}" awww 2>/dev/null || sudo pacman -S "${PAC_FLAGS[@]}" swww 2>/dev/null \
    || echo "note: no wallpaper backend installed (optional: awww or swww)"
fi

echo "OK. Next: ./scripts/ypsilon doctor"
