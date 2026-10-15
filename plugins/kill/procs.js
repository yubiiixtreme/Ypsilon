// Pure parser/matcher for `ps x -o pid=,rss=,comm=` (unit-tested in tests/plugins.test.mjs).
/** @typedef {{ pid: number, rssMb: number, name: string }} Proc */

/** @param {string} text @returns {Proc[]} */
export function parsePs(text) {
  /** @type {Proc[]} */
  const out = []
  for (const line of text.split("\n")) {
    const m = /^\s*(\d+)\s+(\d+)\s+(.+?)\s*$/.exec(line)
    if (m) out.push({ pid: Number(m[1]), rssMb: Math.round(Number(m[2]) / 1024), name: m[3] })
  }
  return out
}

/** @param {Proc[]} procs @param {string} q @param {number} [limit] biggest memory users first, current process excluded */
export function matchProcs(procs, q, limit = 8, self = 0) {
  const f = q.trim().toLowerCase()
  if (!f) return []
  return procs
    .filter((p) => p.pid !== self && p.pid > 1 && p.name.toLowerCase().includes(f))
    .sort((a, b) => b.rssMb - a.rssMb)
    .slice(0, limit)
}
