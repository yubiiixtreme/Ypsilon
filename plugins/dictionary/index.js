// @ts-check
import { parseEntries, isWord } from "./parse.js"

/** @param {import("../../shell/lib/plugin-types").PluginApi} api */
export default function dictionary(api) {
  /** @type {Map<string, import("./parse.js").Sense[] | "pending" | "none">} */
  const cache = new Map()
  // bumped whenever a lookup finishes, so the open launcher re-renders its rows
  const [version, setVersion] = api.state(0)
  /** @type {ReturnType<typeof setTimeout> | null} */
  let timer = null
  api.onCleanup(() => timer && clearTimeout(timer))

  const lang = () => String(api.settings.peek().lang ?? "en")
  // cache per language: "gift" means something else in German
  const keyOf = (/** @type {string} */ word) => `${lang()}:${word}`

  const lookup = (/** @type {string} */ word) => {
    const key = keyOf(word)
    cache.set(key, "pending")
    // the page title keeps its case (German nouns are capitalised); Wiktionary redirects the rest
    const url = `https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(word)}`
    api.exec(["curl", "-sfL", "--max-time", "8", "-A", "Ypsilon-dictionary/1.0 (https://github.com/yubiiixtreme/Ypsilon)", url])
      .then((out) => cache.set(key, parseEntries(out, lang(), word)))
      .catch(() => cache.set(key, "none")) // 404 = unknown word, or offline
      .finally(() => setVersion(version.peek() + 1))
  }

  api.launcher.addProvider({
    name: "Dictionary — Enter copies the definition",
    prefix: "define",
    search: (q) => {
      version() // tracked
      // English entries are lower case; other languages keep yours (German nouns: "Haus")
      const word = lang() === "en" ? q.trim().toLowerCase() : q.trim()
      if (!isWord(word)) return [{ title: "Type a word", sub: "define serendipity", icon: "accessories-dictionary-symbolic", run: () => {} }]
      const hit = cache.get(keyOf(word))
      if (hit === undefined) {
        // wait for a pause in typing before hitting the network
        if (timer) clearTimeout(timer)
        timer = setTimeout(() => !cache.has(keyOf(word)) && lookup(word), 350)
      }
      if (hit === undefined || hit === "pending") return [{ title: `Looking up “${word}”…`, sub: "Wiktionary", icon: "accessories-dictionary-symbolic", run: () => {} }]
      if (hit === "none" || hit.length === 0)
        return [{ title: `No entry for “${word}”`, sub: "Enter searches the web instead", icon: "dialog-question-symbolic", run: () => api.open(`https://en.wiktionary.org/wiki/${encodeURIComponent(word)}`) }]
      return hit.map((s) => ({
        title: s.text,
        sub: [s.pos, s.example && `“${s.example}”`].filter(Boolean).join(" · "),
        icon: "accessories-dictionary-symbolic",
        run: () => void api.exec(["wl-copy", `${s.word} (${s.pos}): ${s.text}`]).catch(() => {}),
      }))
    },
  })
}
