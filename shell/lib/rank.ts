// Launcher ranking: fuzzy order from AstalApps, boosted by launch frequency + recency.
export type Usage = Record<string, { n: number; t: number }>

const HALF_LIFE_DAYS = 14

/** frecency score: launch count decayed by age (days). */
export function frecency(u: { n: number; t: number } | undefined, nowSec: number): number {
  if (!u) return 0
  const days = Math.max(0, (nowSec - u.t) / 86400)
  return u.n * Math.pow(0.5, days / HALF_LIFE_DAYS)
}

/**
 * Stable re-rank. `items` arrive best-fuzzy-match first; each position is worth
 * `positionWeight`, frecency adds on top, so a never-used exact match still wins
 * over a heavily used weak match but habits break ties.
 */
export function rank<T>(items: T[], key: (t: T) => string, usage: Usage, nowSec: number): T[] {
  const positionWeight = 1.5
  return items
    .map((it, i) => ({ it, i, s: (items.length - i) * positionWeight + Math.min(frecency(usage[key(it)], nowSec), 12) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.it)
}

export function bump(usage: Usage, id: string, nowSec: number): Usage {
  const cur = usage[id]
  return { ...usage, [id]: { n: (cur?.n ?? 0) + 1, t: nowSec } }
}

export function parseUsage(text: string | null | undefined): Usage {
  try {
    const o = JSON.parse(text || "{}")
    const out: Usage = {}
    for (const [k, v] of Object.entries(o as Record<string, any>))
      if (v && Number.isFinite(v.n) && Number.isFinite(v.t)) out[k] = { n: v.n, t: v.t }
    return out
  } catch {
    return {}
  }
}
