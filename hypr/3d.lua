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
-- Install: `ypsilon 3d install` (builds Hypr3D, needs cmake) or drop hypr3d.so / desktop-cube.so in
-- ~/.config/ypsilon/plugins/ or ~/.local/share/ypsilon/plugins/.
local home = os.getenv("HOME") or ""
local candidates = {
  (os.getenv("XDG_CONFIG_HOME") or (home .. "/.config")) .. "/ypsilon/plugins/hypr3d.so",
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

-- Hypr3D room settings (only when the plugin is loaded). Assets come from
-- `scripts/make-3d-world.py` (run by `ypsilon 3d install`); missing files are skipped.
local h3d = hl.plugin and hl.plugin.hypr3d
if h3d then
  local data = (os.getenv("XDG_DATA_HOME") or (home .. "/.local/share")) .. "/ypsilon/3d/"
  local function have(f)
    local fh = io.open(data .. f, "r")
    if fh then fh:close() end
    return fh ~= nil
  end
  local cfg = {
    world = { grid = not have("world.glb") },
    -- every running window floats in the room, a comfortable arm's length away
    windows = { window_scale = 0.4, spawn_distance = 4, spawn_size = { 1280, 720 } },
    -- sticky_focus: keyboard stays on ONE window (click another to switch) so games keep
    -- WASD/Space/Shift/Ctrl. Movement is arrows + PageUp/PageDown, Right Ctrl sprints.
    input = { typing_cursor = true, sticky_focus = true },
    player = { move_speed = 5.0, spawn = { 0, 3, 10 }, flying = false, walk_bob = false, collision = true },
    scene = {},
  }
  if have("sky.png") then cfg.world.panorama = data .. "sky.png" end
  if have("world.glb") then
    cfg.scene.meadow = {
      mesh = { path = data .. "world.glb", emissive_scale = 1.0, center = "origin" },
      collision = true,
      static = true,
    }
  end
  h3d.config(cfg)
  -- first few times the room opens, pop a short controls hint (`ypsilon 3d hint` stops after 3)
  if h3d.on_state then
    pcall(h3d.on_state, function(open)
      if open then os.execute("ypsilon 3d hint >/dev/null 2>&1 &") end
    end)
  end
end
