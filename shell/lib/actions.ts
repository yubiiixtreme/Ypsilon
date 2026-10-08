// Command-palette matching for the launcher. Pure + unit-tested.
export type PaletteAction = { id: string; title: string; icon: string; keywords: string[] }

/** 3 = title starts with query, 2 = a title word starts with it, 1 = keyword prefix, 0 = no match */
export function actionScore(query: string, a: PaletteAction): number {
  const q = query.trim().toLowerCase()
  if (q.length < 2) return 0
  const title = a.title.toLowerCase()
  if (title.startsWith(q)) return 3
  if (title.split(/[\s\-·]+/).some((w) => w.startsWith(q))) return 2
  if (a.keywords.some((k) => k.toLowerCase().startsWith(q))) return 1
  return 0
}

export function matchActions<T extends PaletteAction>(query: string, actions: T[], limit = 3): T[] {
  return actions
    .map((a, i) => ({ a, i, s: actionScore(query, a) }))
    .filter((x) => x.s > 0)
    .sort((x, y) => y.s - x.s || x.i - y.i)
    .slice(0, limit)
    .map((x) => x.a)
}
