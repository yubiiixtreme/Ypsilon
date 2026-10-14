// Pure countdown helpers: parse "5m", "1h30m", "90s", "10" (minutes) and format remaining time.

/** @param {string} text @returns {number | null} milliseconds, or null if it is not a duration */
export function parseDuration(text) {
  const s = text.trim().toLowerCase().replace(/\s+/g, "")
  if (!s) return null
  if (/^\d+(\.\d+)?$/.test(s)) return finish(Number(s) * 60_000) // bare number = minutes
  const m = /^(?:(\d+(?:\.\d+)?)h)?(?:(\d+(?:\.\d+)?)m(?:in)?)?(?:(\d+(?:\.\d+)?)s)?$/.exec(s)
  if (!m || (m[1] === undefined && m[2] === undefined && m[3] === undefined)) return null
  return finish((Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0)) * 1000)
}

const MAX_MS = 24 * 3600_000
/** @param {number} ms */
const finish = (ms) => (ms >= 1000 && ms <= MAX_MS ? Math.round(ms) : null)

/** @param {number} ms remaining -> "4:05" or "1:02:03" */
export function format(ms) {
  const t = Math.max(0, Math.ceil(ms / 1000))
  const h = Math.floor(t / 3600)
  const m = Math.floor((t % 3600) / 60)
  const sec = String(t % 60).padStart(2, "0")
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`
}
