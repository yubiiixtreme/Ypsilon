// Runtime user config (~/.config/ypsilon/config.json). Reactive: edit the file
// and widgets that read `config` update live (bar position / workspaces-binds need a restart).
import { createState } from "ags"
import { readFile, writeFile, monitorFile } from "ags/file"
import GLib from "gi://GLib"
import { parseConfig, diagnoseConfig, setIn, coerce, DEFAULTS, type Config } from "../lib/config"
import { ROOT } from "./theme"
import { execAsync } from "ags/process"

export const CONFIG_DIR = `${GLib.get_user_config_dir()}/ypsilon`
export const CONFIG_PATH = `${CONFIG_DIR}/config.json`

function load(): Config {
  try {
    return parseConfig(readFile(CONFIG_PATH))
  } catch {
    return DEFAULTS
  }
}

const [config, setConfig] = createState<Config>(load())
export { config }

let problems: string[] = []
export const configProblems = () => problems

/** Re-read, and tell the user (once per change) what was wrong instead of failing silently. */
function reload() {
  let text: string | null = null
  try {
    text = readFile(CONFIG_PATH)
  } catch {
    /* no config file = defaults */
  }
  const next = diagnoseConfig(text)
  if (next.length && next.join() !== problems.join()) {
    printerr(`ypsilon config: ${next.join("; ")}`)
    execAsync(["notify-send", "-a", "Ypsilon", "-i", "dialog-warning-symbolic", "Ypsilon config: fell back to defaults for",
      next.slice(0, 4).join("\n") + (next.length > 4 ? `\n…and ${next.length - 4} more (ypsilon config check)` : "")]).catch(() => {})
  }
  problems = next
  setConfig(parseConfig(text))
}

/** Call once from app main(): creates the dir and watches the file. */
export function initConfig() {
  GLib.mkdir_with_parents(CONFIG_DIR, 0o755)
  reload()
  monitorFile(CONFIG_PATH, reload)
}

// keys that live in Hyprland/hypridle, not in the shell: writing them triggers `ypsilon apply`
const COMPOSITOR_KEYS = /^(hypr|input|idle)\.|^reduceMotion$/
let applyTimer = 0

/**
 * Settings app write path: validate one value, set it at a dotted path, keep every other key
 * (and unknown keys) intact. A config file that is not valid JSON is backed up, never clobbered.
 */
export function writeConfig(path: string, value: unknown) {
  let current: unknown = {}
  try {
    const text = readFile(CONFIG_PATH)
    try {
      current = JSON.parse(text)
    } catch {
      const backup = `${CONFIG_PATH}.broken-${Math.floor(Date.now() / 1000)}`
      writeFile(backup, text)
      printerr(`ypsilon config: invalid JSON backed up to ${backup}`)
    }
  } catch {
    /* no file yet */
  }
  // plugin settings are validated against each plugin's schema when read (resolveSettings)
  const accepted = path.startsWith("plugins.settings.") ? value : coerce(path, value)
  writeFile(CONFIG_PATH, JSON.stringify(setIn(current, path, accepted), null, 2) + "\n")
  if (COMPOSITOR_KEYS.test(path)) {
    // sliders fire many writes: apply once they settle
    if (applyTimer) GLib.source_remove(applyTimer)
    applyTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 400, () => {
      applyTimer = 0
      execAsync([`${ROOT}/scripts/ypsilon`, "apply"]).catch((e) => printerr(`ypsilon apply: ${e}`))
      return GLib.SOURCE_REMOVE
    })
  }
  return accepted
}
