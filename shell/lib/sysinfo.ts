// /proc parsing for the CPU / memory / temperature widgets. Pure + unit-tested.
export type CpuSample = { idle: number; total: number }

export function parseCpu(procStat: string): CpuSample | null {
  const line = procStat.split("\n").find((l) => l.startsWith("cpu "))
  if (!line) return null
  const n = line.trim().split(/\s+/).slice(1).map(Number)
  if (n.length < 5 || n.some((x) => !Number.isFinite(x))) return null
  const idle = n[3] + (n[4] || 0) // idle + iowait
  return { idle, total: n.slice(0, 8).reduce((a, b) => a + b, 0) }
}

/** 0..1 busy fraction between two samples. */
export function cpuUsage(prev: CpuSample, cur: CpuSample): number {
  const dt = cur.total - prev.total
  if (dt <= 0) return 0
  return Math.min(1, Math.max(0, 1 - (cur.idle - prev.idle) / dt))
}

/** 0..1 used fraction from /proc/meminfo (MemAvailable based). */
export function parseMem(meminfo: string): number | null {
  const get = (k: string) => {
    const m = new RegExp(`^${k}:\\s+(\\d+)`, "m").exec(meminfo)
    return m ? Number(m[1]) : NaN
  }
  const total = get("MemTotal")
  const avail = get("MemAvailable")
  if (!(total > 0) || !Number.isFinite(avail)) return null
  return Math.min(1, Math.max(0, 1 - avail / total))
}

/** Hottest zone in °C from a list of millidegree readings; null when none valid. */
export function hottest(milliDegrees: number[]): number | null {
  const v = milliDegrees.filter((x) => Number.isFinite(x) && x > 0 && x < 150000)
  return v.length ? Math.round(Math.max(...v) / 1000) : null
}

export const pct = (f: number) => `${Math.round(f * 100)}%`
