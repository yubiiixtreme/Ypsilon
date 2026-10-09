// Pure to-do list operations (unit-tested in tests/plugins.test.mjs). Lists are never mutated.
/** @typedef {{ id: number, text: string, done: boolean }} Item */

/** @returns {Item[]} */
export function add(/** @type {Item[]} */ list, /** @type {string} */ text) {
  const t = text.trim().replace(/\s+/g, " ").slice(0, 200)
  if (!t || list.some((i) => !i.done && i.text.toLowerCase() === t.toLowerCase())) return list
  const id = list.reduce((m, i) => Math.max(m, i.id), 0) + 1
  return [...list, { id, text: t, done: false }]
}

/** tick an item off (or back on) */
export const toggle = (/** @type {Item[]} */ list, /** @type {number} */ id) => list.map((i) => (i.id === id ? { ...i, done: !i.done } : i))

/** forget finished items */
export const clearDone = (/** @type {Item[]} */ list) => list.filter((i) => !i.done)

export const open = (/** @type {Item[]} */ list) => list.filter((i) => !i.done)

/** open items first (oldest first), then finished ones; filtered by a case-insensitive needle */
export function view(/** @type {Item[]} */ list, needle = "") {
  const n = needle.trim().toLowerCase()
  return list
    .filter((i) => !n || i.text.toLowerCase().includes(n))
    .sort((a, b) => Number(a.done) - Number(b.done) || a.id - b.id)
}

/** stored JSON may be anything: keep only well-formed items */
export function sanitize(/** @type {unknown} */ raw) {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((i) => i && typeof i.id === "number" && typeof i.text === "string")
    .map((i) => ({ id: i.id, text: String(i.text).slice(0, 200), done: !!i.done }))
}
