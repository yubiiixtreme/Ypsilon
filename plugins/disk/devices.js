// Pure parser for `lsblk -J -b -o NAME,SIZE,FSTYPE,LABEL,MOUNTPOINT,RM,TYPE` (unit-tested in tests/plugins.test.mjs).
/** @typedef {{ dev: string, label: string, fstype: string, size: string, mount: string | null, removable: boolean }} Part */

/** @param {number} bytes */
export const formatSize = (bytes) => {
  const gb = bytes / 1e9
  return gb >= 100 ? `${Math.round(gb)} GB` : gb >= 1 ? `${gb.toFixed(1)} GB` : `${Math.round(bytes / 1e6)} MB`
}

/** @param {string} text @returns {Part[]} partitions/volumes with a filesystem; mounted first, then by name */
export function parseLsblk(text) {
  /** @type {any} */
  let data
  try { data = JSON.parse(text) } catch { return [] }
  /** @type {Part[]} */
  const out = []
  /** @param {any} node @param {boolean} rm */
  const walk = (node, rm) => {
    const removable = rm || node.rm === true || node.rm === "1" || node.rm === 1
    if (node.fstype && node.fstype !== "swap" && node.type !== "loop" && !/^zram/.test(node.name ?? "")) {
      out.push({
        dev: `/dev/${node.name}`,
        label: node.label || node.name,
        fstype: node.fstype,
        size: formatSize(Number(node.size) || 0),
        mount: node.mountpoint || null,
        removable,
      })
    }
    for (const c of node.children ?? []) walk(c, removable)
  }
  for (const d of data?.blockdevices ?? []) walk(d, false)
  return out.sort((a, b) => Number(!!b.mount) - Number(!!a.mount) || a.dev.localeCompare(b.dev))
}

/** @param {Part[]} parts @param {string} q */
export const matchParts = (parts, q) => {
  const f = q.trim().toLowerCase()
  return parts.filter((p) => !f || `${p.label} ${p.dev} ${p.mount ?? ""}`.toLowerCase().includes(f))
}

/** @param {string} out `udisksctl mount` output ("Mounted /dev/sda1 at /run/media/u/X") -> mountpoint */
export const parseMounted = (out) => /\bat (.+?)\.?\s*$/.exec(out.trim())?.[1] ?? null
