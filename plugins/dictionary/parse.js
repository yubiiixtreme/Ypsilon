// Pure parser for Wiktionary's definition API (unit-tested in tests/plugins.test.mjs):
//   https://en.wiktionary.org/api/rest_v1/page/definition/<word>
// The response is keyed by language code; definitions are small HTML fragments.
/** @typedef {{ word: string, pos: string, text: string, example: string }} Sense */

const ENTITIES = /** @type {Record<string, string>} */ ({ amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", nbsp: " " })

/** "<a href=…>house</a>, building" -> "house, building" */
export function plain(/** @type {string} */ html) {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (_, e) => ENTITIES[e])
    .replace(/\s+/g, " ")
    .trim()
}

/** response JSON text -> up to `limit` senses in `lang`, spread over parts of speech first */
export function parseEntries(/** @type {string} */ json, lang = "en", word = "", limit = 6) {
  /** @type {any} */
  let data
  try {
    data = JSON.parse(json)
  } catch {
    return []
  }
  const entries = data && Array.isArray(data[lang]) ? data[lang] : []
  /** @type {Sense[][]} */
  const byPos = entries.map((/** @type {any} */ e) =>
    (e.definitions || [])
      .map((/** @type {any} */ d) => ({ word, pos: String(e.partOfSpeech || "").toLowerCase(), text: plain(String(d.definition || "")), example: plain(String((d.examples || [])[0] || "")) }))
      .filter((/** @type {Sense} */ s) => s.text !== ""),
  )
  // round-robin: the first noun meaning, the first verb meaning, … then the second ones
  /** @type {Sense[]} */
  const out = []
  for (let i = 0; out.length < limit && byPos.some((l) => l.length > i); i++)
    for (const l of byPos) if (l[i] && out.length < limit) out.push(l[i])
  return out
}

/** a single word (any script; hyphen and apostrophe allowed) — anything else is not looked up */
export const isWord = (/** @type {string} */ q) => /^\p{L}[\p{L}'’-]{1,40}$/u.test(q.trim())
