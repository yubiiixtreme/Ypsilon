// Notification history grouped by app (newest group first). Pure (unit-tested).
export type Groupable = { id: number; appName: string | null; desktopEntry?: string | null; time: number }
export type Group<T> = { key: string; name: string; items: T[] }

export function groupByApp<T extends Groupable>(list: T[]): Group<T>[] {
  const groups = new Map<string, Group<T>>()
  for (const n of list) {
    const name = n.appName || n.desktopEntry || "Other"
    const key = (n.desktopEntry || n.appName || "other").toLowerCase()
    const g = groups.get(key) ?? { key, name, items: [] }
    g.items.push(n)
    groups.set(key, g)
  }
  const newest = (g: Group<T>) => g.items[0]?.time ?? 0
  for (const g of groups.values()) g.items.sort((a, b) => b.time - a.time || b.id - a.id)
  return [...groups.values()].sort((a, b) => newest(b) - newest(a))
}
