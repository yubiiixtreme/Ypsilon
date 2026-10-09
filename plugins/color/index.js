// @ts-check
import { convert } from "./color.js"

/** @param {import("../../shell/lib/plugin-types").PluginApi} api */
export default function color(api) {
  api.launcher.addProvider({
    name: "Color tools",
    search: (q) => {
      const r = convert(q)
      if (!r) return []
      return [{
        title: r.text,
        sub: "Enter copies the hex code",
        icon: "color-select-symbolic",
        run: () => void api.exec(["wl-copy", r.hex]).catch(() => {}),
      }]
    },
  })
}
