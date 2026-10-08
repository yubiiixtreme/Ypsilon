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
# AUR, in dependency order. Astal libraries exist on the AUR ONLY as -git packages that
# *provide* the plain names (libastal-hyprland-git provides libastal-hyprland), and
# libastal-meta drags in ~20 libs Ypsilon never imports. So: exactly the libs the shell uses,
# by their real names, one stage at a time so every dependency is already installed when the
# next stage resolves — paru never has to ask "which provider?".
# Format: "<name an installed package must provide>:<AUR package that provides it>"
AUR_STAGES=(
  "quarrel:quarrel-git appmenu-glib-translator:appmenu-glib-translator-git libastal-io:libastal-io-git"
  "libastal:libastal-git libastal-4:libastal-4-git libastal-apps:libastal-apps-git libastal-battery:libastal-battery-git
   libastal-bluetooth:libastal-bluetooth-git libastal-hyprland:libastal-hyprland-git libastal-mpris:libastal-mpris-git
   libastal-network:libastal-network-git libastal-notifd:libastal-notifd-git libastal-power-profiles:libastal-powerprofiles-git
   libastal-tray:libastal-tray-git libastal-wireplumber:libastal-wireplumber-git"
  "aylurs-gtk-shell:aylurs-gtk-shell"
)
# visualizer only (the shell runs without it)
AUR_OPTIONAL="libcava:libcava libastal-cava:libastal-cava-git"

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
if [ "$AUR" = yay ]; then  # yay has no --noprovides
  AUR_FLAGS=(--needed); [ -n "$YES" ] && AUR_FLAGS+=(--noconfirm)
fi

# packages of a stage whose provided name is not installed yet
missing_of() {
  local entry pkgs=()
  for entry in $1; do pacman -T "${entry%%:*}" >/dev/null || pkgs+=("${entry##*:}"); done
  echo "${pkgs[*]}"
}

for stage in "${AUR_STAGES[@]}"; do
  read -ra todo <<< "$(missing_of "$stage")"
  [ ${#todo[@]} -eq 0 ] && continue
  if [ -z "$AUR" ]; then
    echo "No AUR helper (paru/yay) found. Install one, then re-run this script."
    exit 1
  fi
  echo "AUR: ${todo[*]} (builds from source, can take a while)"
  "$AUR" -S "${AUR_FLAGS[@]}" "${todo[@]}"
done

read -ra todo <<< "$(missing_of "$AUR_OPTIONAL")"
if [ ${#todo[@]} -gt 0 ] && [ -n "$AUR" ]; then
  echo "AUR (optional, audio visualizer): ${todo[*]}"
  "$AUR" -S "${AUR_FLAGS[@]}" "${todo[@]}" || echo "note: visualizer libs failed to build — Ypsilon works without them"
fi

# wallpaper daemon (optional): awww is the renamed swww — only if no backend exists yet
if ! command -v awww >/dev/null && ! command -v swww >/dev/null && ! command -v hyprpaper >/dev/null && ! command -v swaybg >/dev/null; then
  sudo pacman -S "${PAC_FLAGS[@]}" awww 2>/dev/null || sudo pacman -S "${PAC_FLAGS[@]}" swww 2>/dev/null \
    || echo "note: no wallpaper backend installed (optional: awww or swww)"
fi

echo "OK. Next: ./scripts/ypsilon doctor"
