// Plugin manifests + settings schema. Pure + unit-tested.
// A plugin is a directory with plugin.json + an ES module (default: index.js):
//   <repo>/plugins/<id>/            bundled examples
//   ~/.config/ypsilon/plugins/<id>/ your own (same id overrides the bundled one)
export const PLUGIN_API_VERSION = 1

export type SettingSpec =
  | { key: string; label: string; type: "boolean"; default: boolean }
  | { key: string; label: string; type: "number"; default: number; min?: number; max?: number; step?: number }
  | { key: string; label: string; type: "string"; default: string; placeholder?: string }
  | { key: string; label: string; type: "enum"; default: string; options: string[] }

export type Manifest = {
  id: string
  name: string
  version: string
  description: string
  author?: string
  entry: string
  apiVersion: number
  /** informational, shown in Settings: what the plugin does with your system */
  permissions: string[]
  settings: SettingSpec[]
}

const ID = /^[a-z0-9][a-z0-9-]{1,39}$/
const KNOWN_PERMISSIONS = ["exec", "network", "files", "notifications", "clipboard"]

export function validateManifest(raw: unknown, dirName: string): { manifest?: Manifest; errors: string[] } {
  const errors: string[] = []
  const m = (raw && typeof raw === "object" ? raw : {}) as Record<string, any>
  const str = (k: string, required = true) => {
    if (typeof m[k] === "string" && m[k].trim()) return m[k].trim() as string
    if (required) errors.push(`"${k}" must be a non-empty string`)
    return ""
  }
  const id = str("id")
  if (id && !ID.test(id)) errors.push(`"id" must match ${ID} (lowercase, digits, dashes)`)
  if (id && id !== dirName) errors.push(`"id" (${id}) must equal the directory name (${dirName})`)
  const name = str("name")
  const version = str("version")
  if (version && !/^\d+\.\d+\.\d+([-+].*)?$/.test(version)) errors.push(`"version" must be semver like 1.0.0`)
  const description = str("description", false)
  const entry = typeof m.entry === "string" ? m.entry : "index.js"
  if (!/^[\w./-]+\.js$/.test(entry) || entry.includes("..") || entry.startsWith("/")) errors.push(`"entry" must be a relative .js path inside the plugin`)
  const apiVersion = m.apiVersion
  if (apiVersion !== PLUGIN_API_VERSION) errors.push(`"apiVersion" must be ${PLUGIN_API_VERSION} (got ${JSON.stringify(apiVersion)})`)
  const permissions = Array.isArray(m.permissions) ? m.permissions.filter((p: unknown) => typeof p === "string") : []
  for (const p of permissions) if (!KNOWN_PERMISSIONS.includes(p)) errors.push(`unknown permission "${p}" (known: ${KNOWN_PERMISSIONS.join(", ")})`)

  const settings: SettingSpec[] = []
  for (const [i, s] of (Array.isArray(m.settings) ? m.settings : []).entries()) {
    const where = `settings[${i}]`
    if (!s || typeof s.key !== "string" || !/^[a-zA-Z][\w]{0,39}$/.test(s.key)) { errors.push(`${where}: bad "key"`); continue }
    const label = typeof s.label === "string" ? s.label : s.key
    if (s.type === "boolean" && typeof s.default === "boolean") settings.push({ key: s.key, label, type: "boolean", default: s.default })
    else if (s.type === "number" && Number.isFinite(s.default)) settings.push({ key: s.key, label, type: "number", default: s.default, min: s.min, max: s.max, step: s.step })
    else if (s.type === "string" && typeof s.default === "string") settings.push({ key: s.key, label, type: "string", default: s.default, placeholder: s.placeholder })
    else if (s.type === "enum" && Array.isArray(s.options) && s.options.includes(s.default)) settings.push({ key: s.key, label, type: "enum", default: s.default, options: s.options.map(String) })
    else errors.push(`${where} (${s.key}): type/default mismatch`)
  }
  if (errors.length) return { errors }
  return { manifest: { id, name, version, description, author: typeof m.author === "string" ? m.author : undefined, entry, apiVersion, permissions, settings }, errors }
}

/** user values validated against the schema; unknown keys dropped, bad values -> default */
export function resolveSettings(schema: SettingSpec[], user: Record<string, unknown> | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const s of schema) {
    const v = user?.[s.key]
    if (s.type === "number") {
      out[s.key] = typeof v === "number" && Number.isFinite(v) ? Math.min(s.max ?? Infinity, Math.max(s.min ?? -Infinity, v)) : s.default
    } else if (s.type === "enum") out[s.key] = typeof v === "string" && s.options.includes(v) ? v : s.default
    else out[s.key] = typeof v === typeof s.default ? v : s.default
  }
  return out
}
