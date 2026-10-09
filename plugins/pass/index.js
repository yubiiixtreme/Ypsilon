// @ts-check
import { parseQuery, generate, strength } from "./gen.js"

/** @param {import("../../shell/lib/plugin-types").PluginApi} api */
export default function pass(api) {
  api.launcher.addProvider({
    name: "Password generator — pw 20 · pw 16 no symbols",
    prefix: "pw",
    search: (q) => {
      const parsed = parseQuery(q)
      if (!parsed) return []
      const defLen = Number(api.settings().length ?? 20)
      const defSym = api.settings().symbols !== false
      const length = q.trim() === "" ? defLen : parsed.length
      const symbols = q.trim() === "" ? defSym : parsed.symbols
      const pw = generate(length, { symbols })
      const pool = symbols ? 74 : 57
      return [{
        title: pw,
        sub: `${length} chars · ${strength(length, pool)} · Enter copies it`,
        icon: "dialog-password-symbolic",
        run: () => void api.exec(["wl-copy", pw]).catch(() => {}),
      }]
    },
  })

  api.commands.add("gen", (args) => {
    const parsed = parseQuery(args.join(" ")) ?? { length: Number(api.settings.peek().length ?? 20), symbols: api.settings.peek().symbols !== false }
    return generate(parsed.length, { symbols: parsed.symbols })
  })
}
