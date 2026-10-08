// Tiny window helpers shared by widgets (no Astal imports beyond app).
import app from "ags/gtk4/app"

export const toggleWindow = (name: string) => {
  const w = app.get_window(name)
  if (w) w.visible = !w.visible
}

export const hideWindow = (name: string) => app.get_window(name)?.set_visible(false)
