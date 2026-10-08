// Ypsilon apps service — lazy AstalApps index, ranked by fuzzy match + launch habits.
import Apps from "gi://AstalApps"
import { rank, frecency } from "../lib/rank"
import { getUsage } from "./usage"

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

export const appId = (a: Apps.Application) => a.entry || a.name
const now = () => Math.floor(Date.now() / 1000)

export function queryApps(q: string, limit = 7): Apps.Application[] {
  try {
    const usage = getUsage()
    if (q.trim() === "") {
      // empty query: your most-used apps
      return getApps()
        .list.filter((a) => usage[appId(a)])
        .sort((a, b) => frecency(usage[appId(b)], now()) - frecency(usage[appId(a)], now()))
        .slice(0, limit)
    }
    return rank(getApps().fuzzy_query(q).slice(0, 25), appId, usage, now()).slice(0, limit)
  } catch (e) {
    print(`ypsilon: queryApps failed: ${e}`)
    return []
  }
}
