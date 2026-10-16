-- Ypsilon — rules: glass layer-shell, floaters, PiP.
local P = require("generated.paths")

-- NOTE: Hyprland 0.56 Lua does not expose the `render_in_top_layer` /
-- `suppress_fullscreen` rule effects yet (hyprlang `rule =` only), so PiP and
-- pinned floaters use float + pin + tag here. They still float above tiled
-- windows; above-fullscreen layering returns once Hyprland exposes it to Lua.

hl.layer_rule({ name = "blur-shell", match = { namespace = "^(gtk4-layer-shell|gtk-layer-shell)$" }, blur = true, ignore_alpha = 0 })
-- Ypsilon shell surfaces (namespace prop in widgets/*.tsx)
hl.layer_rule({ name = "blur-ypsilon", match = { namespace = "^ypsilon-" }, blur = true, ignore_alpha = 0.3 })
-- desktop layers (screen corners, wallpaper clock): nothing behind them to blur, corners never animate
hl.layer_rule({ name = "desktop-noblur", match = { namespace = "^ypsilon-(corner|desktop)$" }, blur = false })
hl.layer_rule({ name = "corner-noanim", match = { namespace = "^ypsilon-corner$" }, no_anim = true })
-- OSD and toasts slide; popups animate themselves (Revealer)
hl.layer_rule({ name = "slide-osd", match = { namespace = "^(ypsilon-osd|ypsilon-toast|ypsilon-bar)$" }, animation = "slide" })
-- region selection (slurp) and color picker appear instantly, no fade-in delay
hl.layer_rule({ name = "instant-pick", match = { namespace = "^(selection|hyprpicker)$" }, no_anim = true })

-- Drop-down terminal (SUPER+SHIFT+Return) and system monitor (CTRL+SHIFT+Esc) live in their
-- own special workspaces; the app is started the first time the workspace is shown
hl.workspace_rule({ workspace = "special:term", on_created_empty = P.YPSILON .. " terminal" })
hl.workspace_rule({ workspace = "special:sysmon", on_created_empty = P.YPSILON .. " term btop" })

-- A lone tiled window gets slimmer outer gaps — small laptop screens need every pixel
hl.workspace_rule({ workspace = "w[tv1]", gaps_out = 6 })

hl.window_rule({
  name = "float-audio",
  match = { class = "^(pavucontrol|org.pulseaudio.pavucontrol|com.saivert.pwvucontrol|blueman-manager|nm-connection-editor)$" },
  float = true,
  size = "700 500",
  center = true,
})
-- small settings tools and calculators float, centered
hl.window_rule({
  name = "float-tools",
  match = { class = "^(nwg-look|qt5ct|qt6ct|kvantummanager|file-roller|org.gnome.FileRoller|org.gnome.Calculator|qalculate-gtk)$" },
  float = true,
  center = true,
})

-- Picture-in-picture: floating, pinned, small, bottom-right — stays above
-- tiled windows (YouTube F / SUPER+F). Top-layer-over-fullscreen needs the
-- not-yet-exposed Lua effects (see note at the top of this file).
hl.window_rule({
  name = "pip-title",
  match = { title = "^(Picture-in-Picture|Picture in picture|Picture-In-Picture)$" },
  float = true,
  pin = true,
  size = "480 270",
  move = "(monitor_w-window_w-16) (monitor_h-window_h-16)",
  keep_aspect_ratio = true,
  no_focus = true,
  idle_inhibit = "always",
})
-- ypsilon pip (SUPER+ALT+V): any window tagged ypsilon-pip floats above
hl.window_rule({
  name = "pip-tag",
  match = { tag = "ypsilon-pip" },
  float = true,
  pin = true,
  keep_aspect_ratio = true,
  no_focus = true,
  idle_inhibit = "always",
})
-- video players float nicely when asked (SUPER+V then SUPER+SHIFT+P)
hl.window_rule({
  name = "video-ar",
  match = { class = "^(mpv|vlc|io.github.celluloid.Celluloid|celluloid|haruna|dragonplayer)$" },
  keep_aspect_ratio = true,
})

-- Dialogs & pickers float and center
hl.window_rule({
  name = "float-dialogs",
  match = { class = "^(org.freedesktop.impl.portal.desktop.*|xdg-desktop-portal.*|polkit-.*|hyprpolkitagent)$" },
  float = true,
})
hl.window_rule({
  name = "float-pickers",
  match = { title = "^(Open File|Save File|Open Folder|Choose.*)$" },
  float = true,
  center = true,
})

-- Never let a fullscreen window blank the screen
hl.window_rule({ name = "inhibit-fullscreen", match = { class = ".*" }, idle_inhibit = "fullscreen" })

-- Fix some dragging issues with XWayland
hl.window_rule({
  name = "fix-xwayland-drags",
  match = { class = "^$", title = "^$", xwayland = true, float = true, fullscreen = false, pin = false },
  no_focus = true,
})

-- Ignore maximize requests from all apps. You'll probably like this.
hl.window_rule({ name = "suppress-maximize", match = { class = ".*" }, suppress_event = "maximize" })
