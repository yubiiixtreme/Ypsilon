// Pure Pomodoro state machine (unit-tested in tests/plugins.test.mjs).
/** @typedef {"idle"|"work"|"short"|"long"} Phase */
/** @typedef {{ phase: Phase, endsAt: number, pausedLeft: number, done: number }} Timer */
/** @typedef {{ work: number, shortBreak: number, longBreak: number, cycles: number, autoContinue: boolean }} Cfg */

/** @returns {Timer} */
export const idle = () => ({ phase: "idle", endsAt: 0, pausedLeft: 0, done: 0 })

/** @param {Phase} phase @param {Cfg} cfg */
export const lengthMs = (phase, cfg) =>
  (phase === "work" ? cfg.work : phase === "short" ? cfg.shortBreak : phase === "long" ? cfg.longBreak : 0) * 60000

/** @param {Timer} t @param {Cfg} cfg @param {number} now @returns {Timer} */
export function start(t, cfg, now) {
  if (t.pausedLeft > 0) return { ...t, endsAt: now + t.pausedLeft, pausedLeft: 0 }
  const phase = t.phase === "idle" ? "work" : t.phase
  return { ...t, phase, endsAt: now + lengthMs(phase, cfg), pausedLeft: 0 }
}

/** @param {Timer} t @param {number} now @returns {Timer} */
export const pause = (t, now) => (t.endsAt > now ? { ...t, pausedLeft: t.endsAt - now, endsAt: 0 } : t)

export const isRunning = (/** @type {Timer} */ t) => t.phase !== "idle" && t.endsAt > 0

/**
 * Advance when a phase ends. Returns the new timer and the phase that just finished (or null).
 * @param {Timer} t @param {Cfg} cfg @param {number} now
 * @returns {{ timer: Timer, finished: Phase | null }}
 */
export function tick(t, cfg, now) {
  if (!isRunning(t) || now < t.endsAt) return { timer: t, finished: null }
  const finished = t.phase
  const done = finished === "work" ? t.done + 1 : t.done
  /** @type {Phase} */
  const next = finished === "work" ? (done % cfg.cycles === 0 ? "long" : "short") : "work"
  const timer = cfg.autoContinue
    ? { phase: next, endsAt: now + lengthMs(next, cfg), pausedLeft: 0, done }
    : { phase: next, endsAt: 0, pausedLeft: lengthMs(next, cfg), done }
  return { timer, finished }
}

/** @param {Timer} t @param {number} now */
export function remaining(t, now) {
  if (t.phase === "idle") return 0
  return t.pausedLeft > 0 ? t.pausedLeft : Math.max(0, t.endsAt - now)
}

export const format = (/** @type {number} */ ms) => {
  const s = Math.ceil(ms / 1000)
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`
}
