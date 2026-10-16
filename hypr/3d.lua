-- Ypsilon 3D — desktop-cube workspace effect.
-- Two layers:
--   1. Cube-feel workspace animations (always on unless reduced motion or
--      `hypr.cube = false` in config.json → generated/user.lua re-asserts flat).
--   2. The true 3D compositor plugin (desktop-cube.so) when installed:
--      `ypsilon 3d install` builds it via hyprpm; we load it gracefully here.
-- Toggle live: SUPER+Z (`ypsilon 3d toggle`). State: hypr/generated/cube.lua.

-- base cube-feel: workspaces swing with depth (slide + fade), dim sells the depth.
-- Flat mode (`hypr.cube = false` in config.json) and reduced motion are
-- re-asserted afterwards by generated/user.lua, which loads after this file.
hl.animation({ leaf = "workspaces", enabled = true, speed = 3, bezier = "glide", style = "slidefade 30%" })
hl.animation({ leaf = "workspacesIn", enabled = true, speed = 3, bezier = "glide", style = "slidefade 30%" })
hl.animation({ leaf = "workspacesOut", enabled = true, speed = 3, bezier = "glide", style = "slidefade 30%" })

-- true 3D plugin: try well-known build locations, never fail the config.
-- Install: `ypsilon 3d install` (hyprpm + headers) or drop desktop-cube.so in
-- ~/.config/ypsilon/plugins/ or ~/.local/share/ypsilon/plugins/.
local home = os.getenv("HOME") or ""
local candidates = {
  (os.getenv("XDG_CONFIG_HOME") or (home .. "/.config")) .. "/ypsilon/plugins/desktop-cube.so",
  (os.getenv("XDG_DATA_HOME") or (home .. "/.local/share")) .. "/ypsilon/plugins/desktop-cube.so",
  (os.getenv("XDG_CONFIG_HOME") or (home .. "/.config")) .. "/hypr/plugins/desktop-cube.so",
}
for _, path in ipairs(candidates) do
  local f = io.open(path, "r")
  if f then
    f:close()
    local ok, err = pcall(hl.plugin.load, path)
    if ok then
      print("ypsilon 3d: loaded " .. path)
    else
      print("ypsilon 3d: plugin present but did not load: " .. tostring(err))
    end
    break
  end
end
