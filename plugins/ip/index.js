// @ts-check
import { parseAddrs, parsePublic } from "./addrs.js"

/** @param {import("../../shell/lib/plugin-types").PluginApi} api */
export default function ip(api) {
  /** @type {import("./addrs.js").Addr[]} */
  let addrs = []
  /** @type {string | null} */
  let pub = null
  const refresh = () => {
    api.exec(["ip", "-j", "addr"]).then((out) => (addrs = parseAddrs(out))).catch((e) => api.log("ip failed", e))
    if (api.settings.peek().publicIp === true)
      api.exec(["curl", "-fsS", "--max-time", "4", "https://api.ipify.org"]).then((out) => (pub = parsePublic(out))).catch(() => (pub = null))
  }
  const copy = (/** @type {string} */ v) => void api.exec(["wl-copy", v]).catch(() => {})

  api.launcher.addProvider({
    name: "IP addresses — Enter copies",
    prefix: "ip",
    search: (q) => {
      refresh()
      const f = q.trim().toLowerCase()
      /** @type {import("../../shell/lib/plugin-types").Row[]} */
      const rows = addrs
        .filter((a) => !f || a.iface.includes(f) || a.address.includes(f))
        .map((a) => ({ title: a.address, sub: `${a.iface} · IPv${a.family}${a.up ? "" : " · down"}`, icon: "network-wired-symbolic", run: () => copy(a.address) }))
      if (pub && (!f || "public".includes(f)))
        rows.unshift({ title: pub, sub: "public address", icon: "network-workgroup-symbolic", run: () => copy(/** @type {string} */ (pub)) })
      return rows
    },
  })

  api.commands.add("list", () => addrs.map((a) => `${a.iface}\t${a.address}`).join("\n") || "no addresses")
  refresh()
}
