#!/usr/bin/env bash
# Ypsilon deps installer — Arch + paru. Run once.
set -euo pipefail
echo "== Ypsilon deps =="
sudo pacman -Syu --needed --noconfirm \
  gtk4 gtk4-layer-shell gobject-introspection \
  upower networkmanager bluez \
  grim slurp wl-clipboard cliphist \
  swww hyprlock hypridle \
  ttf-jetbrains-mono-nerd inter-font \
  nodejs npm dart-sass 2>/dev/null || \
sudo pacman -Syu --needed \
  gtk4 gtk4-layer-shell gobject-introspection \
  upower networkmanager bluez \
  grim slurp wl-clipboard cliphist \
  nodejs npm
echo "-- AUR: aylurs-gtk-shell + libastal-meta --"
paru -S --needed aylurs-gtk-shell libastal-meta
echo "OK. Next: cd ~/Projects/Ypsilon/shell && ags types -u -d ."
