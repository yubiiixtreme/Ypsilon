// Pure helpers for /proc/net/dev (unit-tested in tests/plugins.test.mjs).
/** @typedef {{ rx: number, tx: number }} Counters */

/** "/proc/net/dev" text -> { iface: { rx, tx } } in bytes, loopback dropped */
export function parseNetDev(/** @type {string} */ text) {
  /** @type {Record<string, Counters>} */
  const out = {}
  for (const line of text.split("\n")) {
    const m = /^\s*([^:\s]+):\s*(.*)$/.exec(line)
    if (!m || m[1] === "lo") continue
    const cols = m[2].trim().split(/\s+/).map(Number)
    if (cols.length >= 9) out[m[1]] = { rx: cols[0], tx: cols[8] }
  }
  return out
}

/** bytes/s between two samples; the chosen interface, or the one that moved the most */
export function rates(/** @type {Record<string, Counters>} */ prev, /** @type {Record<string, Counters>} */ cur, /** @type {number} */ ms, iface = "") {
  const sec = Math.max(ms, 1) / 1000
  /** @param {string} n */
  const of = (n) => {
    const a = prev[n], b = cur[n]
    if (!a || !b) return { down: 0, up: 0 }
    // counters reset when an interface goes down: never show a negative speed
    return { down: Math.max(0, b.rx - a.rx) / sec, up: Math.max(0, b.tx - a.tx) / sec }
  }
  if (iface) return of(iface)
  let best = { down: 0, up: 0 }
  for (const n of Object.keys(cur)) {
    const r = of(n)
    if (r.down + r.up > best.down + best.up) best = r
  }
  return best
}

/** 0 -> "0 B/s", 1536 -> "1.5 KB/s", 12_500_000 -> "12 MB/s" */
export function formatRate(/** @type {number} */ bps) {
  const units = ["B/s", "KB/s", "MB/s", "GB/s"]
  let i = 0
  while (bps >= 1000 && i < units.length - 1) (bps /= 1024), i++
  return `${bps < 10 && i > 0 ? bps.toFixed(1) : Math.round(bps)} ${units[i]}`
}
