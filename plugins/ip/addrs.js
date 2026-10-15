// Pure parser for `ip -j addr` (unit-tested in tests/plugins.test.mjs).
/** @typedef {{ iface: string, address: string, family: 4 | 6, up: boolean }} Addr */

/** @param {string} text @returns {Addr[]} non-loopback, non-link-local addresses, IPv4 first */
export function parseAddrs(text) {
  /** @type {any} */
  let data
  try { data = JSON.parse(text) } catch { return [] }
  if (!Array.isArray(data)) return []
  /** @type {Addr[]} */
  const out = []
  for (const link of data) {
    const iface = String(link?.ifname ?? "")
    if (!iface || iface === "lo") continue
    for (const a of link.addr_info ?? []) {
      const address = String(a?.local ?? "")
      if (!address || address.startsWith("fe80:")) continue
      out.push({ iface, address, family: a.family === "inet6" ? 6 : 4, up: link.operstate !== "DOWN" })
    }
  }
  return out.sort((a, b) => a.family - b.family)
}

/** @param {string} text `curl` output -> a plausible IP or null */
export const parsePublic = (text) => {
  const t = text.trim()
  return /^[0-9a-fA-F:.]{3,45}$/.test(t) && (t.includes(".") || t.includes(":")) ? t : null
}
