// Pure password generation (unit-tested in tests/plugins.test.mjs).
// No crypto here: the shell passes Math.random-equivalent; CLI uses /dev/urandom.
const LETTERS = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ"
const DIGITS = "23456789"
const SYMBOLS = "!@#$%^&*+-=?"

export const DEFAULT_LENGTH = 20

/** "20", "16 no symbols", "12 --no-symbols", "" -> opts or null when not a pw query */
export function parseQuery(/** @type {string} */ q) {
  const s = q.trim().toLowerCase()
  if (s === "") return { length: DEFAULT_LENGTH, symbols: true, digits: true }
  if (/^(no[- ]?symbols|nosymbols|plain)$/.test(s)) return { length: DEFAULT_LENGTH, symbols: false, digits: true }
  const m = /^(\d{1,3})(?:\s+(.*))?$/.exec(s)
  if (!m) return null
  const length = Number(m[1])
  if (!Number.isInteger(length) || length < 4 || length > 128) return null
  const rest = (m[2] || "").trim()
  if (rest === "") return { length, symbols: true, digits: true }
  if (/^(no[- _]?symbols|nosymbols|plain|alnum|no[- _]?sym)$/.test(rest)) return { length, symbols: false, digits: true }
  if (/^(no[- _]?digits|nodigits|letters?)$/.test(rest)) return { length, symbols: false, digits: false }
  if (/^(full|all|symbols?)$/.test(rest)) return { length, symbols: true, digits: true }
  return null
}

/** deterministic when `rand` is injected (tests); throws on bad length */
export function generate(/** @type {number} */ length, /** @type {{ symbols?: boolean, digits?: boolean }} */ opts = {}, /** @type {() => number} */ rand = Math.random) {
  if (!Number.isInteger(length) || length < 4 || length > 128) throw new Error("length must be 4..128")
  const pool = LETTERS + (opts.digits === false ? "" : DIGITS) + (opts.symbols ? SYMBOLS : "")
  let out = ""
  for (let i = 0; i < length; i++) out += pool[Math.floor(rand() * pool.length) % pool.length]
  return out
}

/** rough strength estimate for the hint line */
export function strength(/** @type {number} */ length, /** @type {number} */ poolSize) {
  const bits = Math.round(length * Math.log2(Math.max(poolSize, 2)))
  if (bits < 50) return "weak"
  if (bits < 80) return "ok"
  if (bits < 110) return "strong"
  return "very strong"
}
