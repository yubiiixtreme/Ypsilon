-- Ypsilon — autostart.
-- 1. hand the session environment to D-Bus + systemd --user, otherwise xdg-desktop-portal
--    (screen sharing, file pickers), keyrings and D-Bus-activated apps don't see Wayland
-- 2. one idempotent entry point: wallpaper daemon + restore, hypridle, polkit agent,
--    clipboard history, the shell (under its crash supervisor) — see `ypsilon start`
-- 3. GTK apps read the cursor from gsettings, not from XCURSOR_* (matches core/env.lua)
local P = require("generated.paths")

hl.on("hyprland.start", function()
  hl.exec_cmd("dbus-update-activation-environment --systemd WAYLAND_DISPLAY XDG_CURRENT_DESKTOP XDG_SESSION_TYPE HYPRLAND_INSTANCE_SIGNATURE YPSILON_ROOT")
  hl.exec_cmd(P.YPSILON .. " start")
  hl.exec_cmd("gsettings set org.gnome.desktop.interface cursor-theme Bibata-Modern-Ice && gsettings set org.gnome.desktop.interface cursor-size 24")
end)
