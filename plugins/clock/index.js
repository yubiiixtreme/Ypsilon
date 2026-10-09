// @ts-check
import { parseQuery, formatAt, offsetToString } from "./zones.js"

/** @param {import("../../shell/lib/plugin-types").PluginApi} api */
export default function clock(api) {
  api.launcher.addProvider({
    name: "World clock — time tokyo · time utc+5:30",
    prefix: "time",
    search: (q) => {
      const now = Date.now()
      const parsed = parseQuery(q)
      if (parsed && parsed.offset !== null) {
        const t = formatAt(now, parsed.offset)
        return [{ title: `${t} · ${parsed.name}`, sub: `UTC${offsetToString(parsed.offset)} · Enter copies it`, icon: "preferences-system-time-symbolic", run: () => void api.exec(["wl-copy", t]).catch(() => {}) }]
      }
      // empty or unknown: show favorites
      const favs = String(api.settings().favorites ?? "utc, tokyo, newyork").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 5)
      /** @type {import("../../shell/lib/plugin-types").Row[]} */
      const rows = []
      for (const f of favs) {
        const p = parseQuery(f)
        if (p && p.offset !== null) rows.push({ title: `${formatAt(now, p.offset)} · ${f}`, sub: `UTC${offsetToString(p.offset)}`, icon: "preferences-system-time-symbolic", run: () => {} })
      }
      if (!parsed && q.trim() !== "") return []
      return rows
    },
  })

  api.commands.add("time", (args) => {
    const p = parseQuery(args.join(" "))
    if (!p || p.offset === null) return "usage: time <zone>  (e.g. time tokyo, time utc+5:30)"
    return `${formatAt(Date.now(), p.offset)} · ${p.name}`
  })
}
