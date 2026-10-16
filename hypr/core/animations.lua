-- Ypsilon — animations: A LOT of effects, but fast. 200-300ms.
-- hypr/3d.lua may override the workspace leaves afterwards for the cube feel.
hl.config({
  animations = {
    enabled = true,
  },
})

hl.curve("ypsilon", { type = "bezier", points = { { 0.05, 0.9 }, { 0.1, 1.05 } } })
hl.curve("ypsilonOut", { type = "bezier", points = { { 0.4, 0.0 }, { 0.2, 1.0 } } })
hl.curve("pop", { type = "bezier", points = { { 0.05, 0.9 }, { 0.1, 1.2 } } })
hl.curve("glide", { type = "bezier", points = { { 0.16, 1.0 }, { 0.3, 1.0 } } }) -- expo-out: fast start, long soft landing (moves, workspaces, borders)

hl.animation({ leaf = "windows", enabled = true, speed = 4, bezier = "ypsilon", style = "popin 85%" })
hl.animation({ leaf = "windowsOut", enabled = true, speed = 4, bezier = "ypsilonOut", style = "popin 75%" })
hl.animation({ leaf = "windowsMove", enabled = true, speed = 5, bezier = "glide", style = "slide" })
hl.animation({ leaf = "border", enabled = true, speed = 8, bezier = "glide" })
hl.animation({ leaf = "fade", enabled = true, speed = 4, bezier = "ypsilonOut" })
hl.animation({ leaf = "workspaces", enabled = true, speed = 5, bezier = "glide", style = "slidefade 20%" })
hl.animation({ leaf = "workspacesIn", enabled = true, speed = 5, bezier = "glide", style = "slidefade 20%" })
hl.animation({ leaf = "workspacesOut", enabled = true, speed = 5, bezier = "glide", style = "slidefade 20%" })
hl.animation({ leaf = "specialWorkspace", enabled = true, speed = 4, bezier = "ypsilon", style = "slidefadevert 15%" })
hl.animation({ leaf = "layersIn", enabled = true, speed = 3, bezier = "pop", style = "popin 90%" })
hl.animation({ leaf = "layersOut", enabled = true, speed = 3, bezier = "ypsilonOut", style = "popin 90%" })
hl.animation({ leaf = "fadeLayersIn", enabled = true, speed = 3, bezier = "ypsilonOut" })
hl.animation({ leaf = "fadeLayersOut", enabled = true, speed = 3, bezier = "ypsilonOut" })
