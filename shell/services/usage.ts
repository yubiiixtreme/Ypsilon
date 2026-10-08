// App launch history for frecency ranking: ~/.cache/ypsilon/usage.json
import { readFile, writeFile } from "ags/file"
import GLib from "gi://GLib"
import { bump, parseUsage, type Usage } from "../lib/rank"

const DIR = `${GLib.get_user_cache_dir()}/ypsilon`
const PATH = `${DIR}/usage.json`

let cache: Usage | null = null

export function getUsage(): Usage {
  if (cache) return cache
  try {
    cache = parseUsage(readFile(PATH))
  } catch {
    cache = {}
  }
  return cache
}

export function recordLaunch(id: string) {
  cache = bump(getUsage(), id, Math.floor(Date.now() / 1000))
  try {
    GLib.mkdir_with_parents(DIR, 0o755)
    writeFile(PATH, JSON.stringify(cache))
  } catch (e) {
    print(`ypsilon usage: ${e}`)
  }
}
