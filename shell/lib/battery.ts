// Battery alert state machine. Pure + unit-tested.
export type AlertState = { warned: boolean; critical: boolean }
export const INITIAL: AlertState = { warned: false, critical: false }

/** Returns the next state and, when a threshold was just crossed, which alert to show. */
export function batteryAlert(
  percent: number, // 0..100
  charging: boolean,
  cfg: { warnAt: number; criticalAt: number },
  st: AlertState,
): { state: AlertState; alert: "warn" | "critical" | null } {
  if (charging || percent > cfg.warnAt + 3) return { state: INITIAL, alert: null }
  if (percent <= cfg.criticalAt && !st.critical) return { state: { warned: true, critical: true }, alert: "critical" }
  if (percent <= cfg.warnAt && !st.warned) return { state: { ...st, warned: true }, alert: "warn" }
  return { state: st, alert: null }
}
