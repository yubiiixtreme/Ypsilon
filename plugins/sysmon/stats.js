// Pure parsers for /proc/meminfo and /proc/loadavg.

/** @param {string} text @returns {{ usedPct: number, usedMb: number, totalMb: number } | null} */
export function parseMem(text) {
  const kb = (/** @type {string} */ key) => {
    const m = new RegExp(`^${key}:\\s+(\\d+)`, "m").exec(text)
    return m ? Number(m[1]) : null
  }
  const total = kb("MemTotal")
  const avail = kb("MemAvailable")
  if (!total || avail === null) return null
  const used = Math.max(0, total - avail)
  return { usedPct: Math.round((used / total) * 100), usedMb: Math.round(used / 1024), totalMb: Math.round(total / 1024) }
}

/** @param {string} text @returns {number | null} 1-minute load average */
export function parseLoad(text) {
  const first = text.trim().split(/\s+/)[0]
  const v = first ? Number(first) : NaN
  return Number.isFinite(v) ? v : null
}

/** @param {number} mb */
export const formatMb = (mb) => (mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb} MB`)
