// Pure helpers (unit-tested in tests/plugins.test.mjs).
/** @typedef {{ name: string, url: string }} Link */

/** "Name=url; Other=url" -> links. Only http(s)/file/mailto URLs are accepted. @returns {Link[]} */
export function parseLinks(/** @type {string} */ text) {
  return text
    .split(/[;\n]/)
    .map((part) => {
      const i = part.indexOf("=")
      return i > 0 ? { name: part.slice(0, i).trim(), url: part.slice(i + 1).trim() } : null
    })
    .filter(/** @returns {l is Link} */ (l) => !!l && !!l.name && /^(https?:\/\/|file:\/\/|mailto:)\S+$/.test(l.url))
}

/** names starting with the query first, then substring matches @param {Link[]} links */
export function matchLinks(links, /** @type {string} */ query) {
  const q = query.toLowerCase()
  if (!q) return links
  const starts = links.filter((l) => l.name.toLowerCase().startsWith(q))
  const contains = links.filter((l) => !starts.includes(l) && (l.name.toLowerCase().includes(q) || l.url.toLowerCase().includes(q)))
  return [...starts, ...contains]
}
