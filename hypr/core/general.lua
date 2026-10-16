-- Ypsilon — general: gaps, borders, layout.
-- User overrides (Settings → Desktop) live in generated/user.lua and win.
hl.config({
  general = {
    gaps_in = 6,
    gaps_out = 12,
    border_size = 2,
    layout = "dwindle",
    allow_tearing = false,
    resize_on_border = true, -- drag window edges to resize
    extend_border_grab_area = 12,
    snap = {
      enabled = true, -- floating windows snap to edges/each other
    },
    -- Ypsilon-dark fallback colors (gen-theme.py overwrites via themes/current.lua)
    col = {
      active_border = { colors = { "rgba(7c7cffee)", "rgba(22d3eeee)" }, angle = 45 },
      inactive_border = "rgba(8b93b855)",
    },
  },
})
