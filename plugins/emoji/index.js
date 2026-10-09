// @ts-check
import { EMOJI, search } from "./data.js"

/** @param {import("../../shell/lib/plugin-types").PluginApi} api */
export default function emoji(api) {
  /** @type {string[]} */
  let recent = api.storage.get("recent", [])

  const pick = (/** @type {string} */ char) => {
    recent = [char, ...recent.filter((c) => c !== char)].slice(0, 8)
    api.storage.set("recent", recent)
    api.exec(["wl-copy", char]).catch((e) => api.log("wl-copy failed", e))
    // the launcher closes first, so the keystroke lands in the window you came from
    if (api.settings.peek().type === true) setTimeout(() => api.exec(["wtype", char]).catch(() => {}), 150)
  }

  const row = (/** @type {{ char: string, words: string }} */ e) => {
    const [name, ...more] = e.words.split(" ")
    return {
      title: name.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase()),
      sub: more.join(" ") || "Enter copies it",
      glyph: e.char,
      icon: "face-smile-symbolic",
      run: () => pick(e.char),
    }
  }

  api.launcher.addProvider({
    name: "Emoji — Enter copies it",
    prefix: ".",
    search: (q) => {
      if (q) return search(q).map(row)
      // nothing typed yet: what you used last
      return recent.map((c) => EMOJI.find((e) => e.char === c)).filter((e) => e !== undefined).map(row)
    },
  })
}
