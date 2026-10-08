// Ypsilon theme service — runtime-reads tokens + CSS from disk so a theme
// switch (`ypsilon theme set X`) takes effect without rebuilding the shell.
// Inert at import time (client-process safe).
import { createState } from "ags"
import GLib from "gi://GLib"
import { readFile } from "ags/file"
import { execAsync } from "ags/process"

type Palette = Record<string, string>
type Tokens = { active?: string; themes: Record<string, Palette> }

/**
 * Repo location, in order: $YPSILON_ROOT (exported by hypr/generated/paths.conf and
 * `ypsilon start`) → the ~/.config/ags symlink made by install.sh → ~/Projects/Ypsilon.
 */
function findRoot(): string {
  const env = GLib.getenv("YPSILON_ROOT")
  if (env && GLib.file_test(`${env}/shell/app.tsx`, GLib.FileTest.EXISTS)) return env
  try {
    const link = GLib.file_read_link(`${GLib.get_user_config_dir()}/ags`)
    const root = GLib.path_get_dirname(link.replace(/\/$/, ""))
    if (GLib.file_test(`${root}/shell/app.tsx`, GLib.FileTest.EXISTS)) return root
  } catch {
    /* not installed via install.sh */
  }
  return `${GLib.get_home_dir()}/Projects/Ypsilon`
}

export const ROOT = findRoot()

export const tokensPath = () => `${ROOT}/themes/tokens.json`
export const baseCssPath = () => `${ROOT}/shell/style.css`
export const generatedCssPath = () => `${ROOT}/shell/style/_generated.css`
export const hyprCurrentPath = () => `${ROOT}/hypr/themes/current.conf`

export function readTokens(): Tokens {
  try {
    return JSON.parse(readFile(tokensPath())) as Tokens
  } catch (e) {
    print(`ypsilon theme: cannot read tokens: ${e}`)
    return { themes: {} }
  }
}

export const activeTheme = () => readTokens().active ?? "ypsilon-dark"
/** built-in (tokens.json) + generated/custom (themes/user/*.json) */
export function themeNames(): string[] {
  const names = new Set(Object.keys(readTokens().themes))
  try {
    const dir = GLib.Dir.open(`${ROOT}/themes/user`, 0)
    let f: string | null
    while ((f = dir.read_name())) if (f.endsWith(".json")) names.add(f.slice(0, -5))
  } catch {
    /* no user themes yet */
  }
  return [...names].sort()
}

/** Full stylesheet = layout + generated colors, read fresh from disk. */
export function readCss(): string {
  try {
    return `${readFile(generatedCssPath())}\n${readFile(baseCssPath())}`
  } catch (e) {
    print(`ypsilon theme: cannot read css: ${e}`)
    return ""
  }
}

/** Reactive active-theme name (UI highlights); updated after a switch. */
export const [currentTheme, setCurrentTheme] = createState(activeTheme())

/** Generate a theme from the current wallpaper and apply it. */
export const setAutoTheme = (light = false) =>
  execAsync([`${ROOT}/scripts/ypsilon`, "theme", "auto", ...(light ? ["--light"] : []), "--apply"]).catch((e) =>
    print(`ypsilon auto theme: ${e}`),
  )

/** primary/accent/bg/fg of a theme (built-in or themes/user/*.json), for swatches */
export function themePalette(name: string): Record<string, string> {
  const builtIn = readTokens().themes[name]
  if (builtIn) return builtIn
  try {
    return JSON.parse(readFile(`${ROOT}/themes/user/${name}.json`)) as Record<string, string>
  } catch {
    return {}
  }
}
