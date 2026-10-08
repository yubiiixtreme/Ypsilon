// Ypsilon theme service — reads tokens, resolves generated artifact paths.
// Inert at import time (client-process safe). Live switch = file rewrite +
// `ags request reload-css` (see app.tsx requestHandler).
import tokens from "../../themes/tokens.json"
import GLib from "gi://GLib"

type Palette = Record<string, string>
type Tokens = {
  active: string
  radius: Record<string, number>
  blur: Record<string, number>
  opacity: Record<string, number>
  anim: Record<string, number>
  themes: Record<string, Palette>
}

const T = tokens as unknown as Tokens
const HOME = GLib.get_home_dir()
export const ROOT = `${HOME}/Projects/Ypsilon`

export const activeTheme = () => T.active ?? "ypsilon-dark"

export const themeNames = () => Object.keys(T.themes).sort()

export const palette = (): Palette => T.themes[activeTheme()] ?? T.themes["ypsilon-dark"]

export const generatedCssPath = () => `${ROOT}/shell/style/_generated.css`

export const hyprCurrentPath = () => `${ROOT}/hypr/themes/current.conf`
