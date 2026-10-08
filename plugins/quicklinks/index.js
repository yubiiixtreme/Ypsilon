// @ts-check
import { parseLinks, matchLinks } from "./links.js"

/** @param {import("../../shell/lib/plugin-types").PluginApi} api */
export default function quicklinks(api) {
  const links = api.computed(() => parseLinks(String(api.settings().links ?? "")))
  api.launcher.addProvider({
    name: "quick links — edit them in Settings → Plugins",
    prefix: "!",
    search: (q) =>
      matchLinks(links.peek(), q).map((l) => ({ title: l.name, sub: l.url, icon: "web-browser-symbolic", run: () => api.open(l.url) })),
  })
}
