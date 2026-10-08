// Pure parser for `ss -ltnpH` (unit-tested in tests/plugins.test.mjs).
/** @typedef {{ port: number, address: string, process: string, pid: number }} Listener */

/** @returns {Listener[]} */
export function parseSs(/** @type {string} */ text) {
  /** @type {Map<number, Listener>} */
  const byPort = new Map()
  for (const line of text.split("\n")) {
    const cols = line.trim().split(/\s+/)
    if (cols.length < 4 || cols[0] !== "LISTEN") continue
    const local = cols[3]
    const m = /^(.*):(\d+)$/.exec(local)
    if (!m) continue
    const port = Number(m[2])
    const proc = /users:\(\("([^"]+)",pid=(\d+)/.exec(line)
    if (!byPort.has(port)) byPort.set(port, { port, address: m[1].replace(/^\[|\]$/g, ""), process: proc ? proc[1] : "?", pid: proc ? Number(proc[2]) : 0 })
  }
  return [...byPort.values()].sort((a, b) => a.port - b.port)
}
