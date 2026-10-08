// Ypsilon theme service — Day 1: tokens passthrough. Day 2: gen + live switch.
import tokens from "../../themes/tokens.json"

export const activeTheme = () => {
  const t = (tokens as { active: string }).active
  return t ?? "ypsilon-dark"
}

export const palette = () => {
  const all = (tokens as { themes: Record<string, unknown> }).themes
  return all[activeTheme()] as Record<string, string>
}

export function applyTheme(_name: string) {
  // Day 2: app.apply_css() + write hypr/themes/current.conf + hyprctl reload
  print(`ypsilon: theme switch to ${_name} lands Day 2`)
}
