#!/usr/bin/env bash
# Ypsilon dependencies. Arch (+ an AUR helper) is automated; other distros get the list.
# Re-running is safe (--needed).
set -euo pipefail

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
  cat <<MSG
Ypsilon's installer automates Arch Linux only. On your distro, install the equivalents of:
  compositor/shell : Hyprland >= 0.53, AGS v3 (aylurs-gtk-shell), Astal libraries
                     (astal4 io hyprland tray network bluetooth battery mpris notifd wireplumber apps powerprofiles)
  gtk              : gtk4, gtk4-layer-shell, gobject-introspection, python3-gobject, python3-pillow
  services         : NetworkManager, bluez, upower, power-profiles-daemon, wireplumber
  tools            : grim slurp wl-clipboard cliphist wf-recorder libnotify brightnessctl playerctl fuzzel
                     hyprlock hypridle hyprpolkitagent hyprsunset hyprpicker xdg-desktop-portal-hyprland
  fonts/icons      : Inter, JetBrainsMono Nerd Font, Adwaita icon theme
  dev              : nodejs, npm
Then run: ./scripts/ypsilon doctor
MSG
  exit 1
fi

echo "== Ypsilon deps (Arch) =="
sudo pacman -Syu --needed "${PACMAN_PKGS[@]}"

AUR=""
for h in paru yay; do command -v "$h" >/dev/null && { AUR=$h; break; }; done
if [ -z "$AUR" ]; then
  echo "No AUR helper (paru/yay) found. Install one, then: paru -S --needed ${AUR_PKGS[*]}"
  exit 1
fi
"$AUR" -S --needed "${AUR_PKGS[@]}"

# wallpaper daemon: awww is the renamed swww — take whichever exists
if ! pacman -Q awww &>/dev/null && ! pacman -Q swww &>/dev/null; then
  sudo pacman -S --needed awww 2>/dev/null || "$AUR" -S --needed awww 2>/dev/null \
    || sudo pacman -S --needed swww 2>/dev/null || "$AUR" -S --needed swww
fi

echo "OK. Next: ./scripts/ypsilon doctor"
