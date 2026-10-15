// @ts-check
import { parseLsblk, matchParts, parseMounted } from "./devices.js"

/** @param {import("../../shell/lib/plugin-types").PluginApi} api */
export default function disk(api) {
  /** @type {import("./devices.js").Part[]} */
  let parts = []
  const refresh = () =>
    api.exec(["lsblk", "-J", "-b", "-o", "NAME,SIZE,FSTYPE,LABEL,MOUNTPOINT,RM,TYPE"]).then((out) => (parts = parseLsblk(out))).catch((e) => api.log("lsblk failed", e))
  void refresh()
  const fail = (/** @type {string} */ what, /** @type {unknown} */ e) => api.notify("Disks", `${what}: ${e}`, "normal")

  /** @param {import("./devices.js").Part} p */
  const mountAndOpen = async (p) => {
    if (p.mount) return api.open(p.mount)
    try {
      const where = parseMounted(await api.exec(["udisksctl", "mount", "-b", p.dev]))
      if (where) api.open(where)
    } catch (e) { fail(`could not mount ${p.label}`, e) }
  }
  /** @param {import("./devices.js").Part} p */
  const unmount = (p) =>
    api.exec(["udisksctl", "unmount", "-b", p.dev])
      .then(() => api.notify("Disks", `${p.label} unmounted — safe to remove`, "low"))
      .catch((e) => fail(`could not unmount ${p.label}`, e))

  api.launcher.addProvider({
    name: "drives — disk · eject",
    prefix: "disk",
    search: (q) => {
      void refresh()
      return matchParts(parts, q).map((p) => ({
        title: p.label,
        sub: `${p.dev} · ${p.size} · ${p.fstype} · ${p.mount ? `mounted at ${p.mount}` : "not mounted — Enter mounts"}`,
        icon: p.removable ? "drive-removable-media-symbolic" : "drive-harddisk-symbolic",
        run: () => void mountAndOpen(p),
      }))
    },
  })

  api.launcher.addProvider({
    name: "eject removable drives",
    prefix: "eject",
    search: (q) =>
      matchParts(parts.filter((p) => p.removable && p.mount), q).map((p) => ({
        title: `Eject ${p.label}`,
        sub: `${p.dev} · mounted at ${p.mount}`,
        icon: "media-eject-symbolic",
        run: () => void unmount(p),
      })),
  })

  api.commands.add("list", () => parts.map((p) => `${p.dev}\t${p.label}\t${p.mount ?? "-"}`).join("\n") || "no drives")
}
