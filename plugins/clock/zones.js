// Pure world-clock helpers (unit-tested in tests/plugins.test.mjs).
// Offsets in minutes east of UTC; zones match common launcher queries.

/** @type {Record<string, number>} */
export const ZONES = {
  utc: 0, gmt: 0, london: 60, lisbon: 60, berlin: 120, paris: 120, rome: 120,
  madrid: 120, cairo: 180, moscow: 180, istanbul: 180, dubai: 240, karachi: 300,
  delhi: 330, mumbai: 330, kolkata: 330, kathmandu: 345, dhaka: 360, bangkok: 420,
  jakarta: 420, singapore: 480, hongkong: 480, hong_kong: 480, beijing: 480,
  shanghai: 480, tokyo: 540, osaka: 540, seoul: 540, sydney: 660, auckland: 780,
  honolulu: -600, anchorage: -480, losangeles: -420, la: -420, vancouver: -420,
  denver: -360, chicago: -300, mexico: -300, newyork: -240, ny: -240, toronto: -240,
  saopaulo: -180, buenosaires: -180, azores: -60, reykjavik: 0, lagos: 60,
  johannesburg: 120, nairobi: 180, tehran: 210, kabul: 270, yangon: 390,
  perth: 480, taipei: 480, manila: 480, brisbane: 600, melbourne: 600,
  hawaii: -600, alaska: -480, pacific: -420, mountain: -360, central: -300,
  eastern: -240, atlantic: -180, kathmandu2: 345,
}

/** "tokyo", "utc+5:30", "gmt-4", "utc+0545", "" -> { name, offset } or null */
export function parseQuery(/** @type {string} */ q) {
  const s = q.trim().toLowerCase().replace(/\s+/g, "")
  if (s === "") return { name: "local", offset: null }
  const m = /^(utc|gmt)?([+-])(\d{1,2})(?::?(\d{2}))?$/.exec(s)
  if (m) {
    const sign = m[2] === "+" ? 1 : -1
    const h = Number(m[3]), min = Number(m[4] ?? 0)
    if (h > 14 || min > 59) return null
    const offset = sign * (h * 60 + min)
    return { name: `UTC${sign > 0 ? "+" : "−"}${h}${min ? `:${String(min).padStart(2, "0")}` : ""}`, offset }
  }
  const key = s.replace(/[^a-z_]/g, "")
  if (key in ZONES) return { name: s, offset: ZONES[key] }
  // prefix match: "new" -> newyork, "hong" -> hongkong
  const hit = Object.keys(ZONES).find((z) => z.startsWith(key))
  if (hit && key.length >= 2) return { name: hit, offset: ZONES[hit] }
  return null
}

/** format a UTC ms timestamp at an offset; deterministic (tests don't depend on TZ) */
export function formatAt(/** @type {number} */ utcMs, /** @type {number} */ offsetMin) {
  const d = new Date(utcMs + offsetMin * 60_000)
  const hh = String(d.getUTCHours()).padStart(2, "0")
  const mm = String(d.getUTCMinutes()).padStart(2, "0")
  return `${hh}:${mm}`
}

/** "+330" -> "+05:30", "-240" -> "-04:00" */
export function offsetToString(/** @type {number} */ offsetMin) {
  const sign = offsetMin < 0 ? "-" : "+"
  const a = Math.abs(offsetMin)
  return `${sign}${String(Math.floor(a / 60)).padStart(2, "0")}:${String(a % 60).padStart(2, "0")}`
}
