// @ts-check
import { convert } from "./convert.js"

/** @param {import("../../shell/lib/plugin-types").PluginApi} api */
export default function units(api) {
  // no prefix: joins the normal launcher search and only answers when the query is a conversion
  api.launcher.addProvider({
    name: "Unit converter",
    search: (q) => {
      const r = convert(q)
      if (!r) return []
      return [{
        title: `= ${r.text}`,
        sub: `${r.from} → ${r.to} · Enter copies it`,
        icon: "accessories-calculator-symbolic",
        run: () => void api.exec(["wl-copy", r.text.replace(/,/g, "")]).catch(() => {}),
      }]
    },
  })
}
