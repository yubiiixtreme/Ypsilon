// Workspace geometry for the overview previews and the bar's app icons. Pure (unit-tested).
export type Rect = { x: number; y: number; w: number; h: number }
type MonitorLike = { x: number; y: number; width: number; height: number; scale: number; transform: number }

/** a monitor's logical rect in Hyprland layout coordinates (where client x/y live) */
export function monitorRect(m: MonitorLike): Rect {
  const s = m.scale > 0 ? m.scale : 1
  let w = m.width / s
  let h = m.height / s
  if (m.transform % 2 === 1) [w, h] = [h, w] // 90° / 270° rotations
  return { x: m.x, y: m.y, w: Math.max(1, w), h: Math.max(1, h) }
}

/**
 * Scale window rects (layout coordinates) into a `boxW`-wide preview of `mon`.
 * Rects are clipped to the preview and never smaller than `min` px, so tiny or
 * off-screen windows stay clickable.
 */
export function fitRects(mon: Rect, wins: Rect[], boxW: number, min = 14): { w: number; h: number; rects: Rect[] } {
  const k = boxW / mon.w
  const W = Math.round(boxW)
  const H = Math.round(mon.h * k)
  const rects = wins.map((r) => {
    const w = Math.max(min, Math.min(W, Math.round(r.w * k)))
    const h = Math.max(min, Math.min(H, Math.round(r.h * k)))
    const x = Math.max(0, Math.min(W - w, Math.round((r.x - mon.x) * k)))
    const y = Math.max(0, Math.min(H - h, Math.round((r.y - mon.y) * k)))
    return { x, y, w, h }
  })
  return { w: W, h: H, rects }
}

/** workspace id -> distinct window classes in first-seen order, at most `max` each */
export function appsByWorkspace(clients: { ws: number; cls: string }[], max = 3): Map<number, string[]> {
  const out = new Map<number, string[]>()
  for (const { ws, cls } of clients) {
    if (!cls) continue
    const list = out.get(ws) ?? []
    if (!list.includes(cls) && list.length < max) list.push(cls)
    out.set(ws, list)
  }
  return out
}

/** split `n` cards into rows of at most `perRow` (balanced: 5 -> 3 + 2) */
export function rows<T>(items: T[], perRow: number): T[][] {
  if (items.length === 0) return []
  const n = Math.ceil(items.length / Math.max(1, perRow))
  const size = Math.ceil(items.length / n)
  return Array.from({ length: n }, (_, i) => items.slice(i * size, (i + 1) * size))
}
