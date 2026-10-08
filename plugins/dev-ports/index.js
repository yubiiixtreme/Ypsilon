// @ts-check
import { parseSs } from "./ports.js"

/** @param {import("../../shell/lib/plugin-types").PluginApi} api */
export default function devPorts(api) {
  /** @type {import("./ports.js").Listener[]} */
  let cache = []
  const refresh = () =>
    api.exec(["ss", "-ltnpH"]).then((out) => (cache = parseSs(out))).catch((e) => api.log("ss failed", e))
  refresh()
  const timer = setInterval(refresh, 5000)
  api.onCleanup(() => clearInterval(timer))

  api.launcher.addProvider({
    name: "listening ports — enter opens http://localhost:PORT",
    prefix: "port",
    search: (q) => {
      refresh()
      const hide = api.settings.peek().hideSystem !== false
      return cache
        .filter((l) => !(hide && l.port < 1024))
        .filter((l) => !q || String(l.port).startsWith(q) || l.process.includes(q))
        .map((l) => ({
          title: `:${l.port}  ${l.process}`,
          sub: `${l.address}${l.pid ? ` · pid ${l.pid}` : ""}`,
          icon: "network-server-symbolic",
          run: () => api.open(`http://localhost:${l.port}`),
        }))
    },
  })
}
