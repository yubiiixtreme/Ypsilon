-- Ypsilon 3D — cube-feel workspace animations.
-- Always on unless reduced motion or `hypr.cube = false` in config.json
-- (generated/user.lua re-asserts flat).
-- Toggle live: SUPER+Z (`ypsilon 3d toggle`).

-- base cube-feel: workspaces swing with depth (slide + fade), dim sells the depth.
-- Flat mode (`hypr.cube = false` in config.json) and reduced motion are
-- re-asserted afterwards by generated/user.lua, which loads after this file.
hl.animation({ leaf = "workspaces", enabled = true, speed = 3, bezier = "glide", style = "slidefade 30%" })
hl.animation({ leaf = "workspacesIn", enabled = true, speed = 3, bezier = "glide", style = "slidefade 30%" })
hl.animation({ leaf = "workspacesOut", enabled = true, speed = 3, bezier = "glide", style = "slidefade 30%" })
