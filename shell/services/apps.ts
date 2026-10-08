// Ypsilon apps service — lazy AstalApps index (fuzzy launcher backend).
import Apps from "gi://AstalApps"

let _apps: Apps.Apps | null = null

export function getApps() {
  if (!_apps) {
    _apps = new Apps.Apps({
      nameMultiplier: 2,
      entryMultiplier: 0,
      executableMultiplier: 2,
    })
  }
  return _apps
}

export function queryApps(q: string, limit = 8) {
  try {
    return getApps().fuzzy_query(q).slice(0, limit)
  } catch (e) {
    print(`ypsilon: queryApps failed: ${e}`)
    return []
  }
}
