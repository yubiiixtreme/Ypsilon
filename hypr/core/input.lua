-- Ypsilon — input. User overrides (Settings → Keyboard & mouse) live in generated/user.lua.
hl.config({
  input = {
    kb_layout = "us",
    follow_mouse = 1,
    touchpad = {
      natural_scroll = true,
      clickfinger_behavior = true,
    },
    sensitivity = 0,
  },
})

hl.gesture({ fingers = 3, direction = "horizontal", action = "workspace" })
hl.gesture({
  fingers = 3,
  direction = "up",
  action = function()
    hl.dispatch(hl.dsp.exec_cmd("ags toggle -i ypsilon ypsilon-overview"))
  end,
}) -- workspace overview
hl.gesture({ fingers = 4, direction = "vertical", action = "special", workspace_name = "magic" }) -- scratchpad
