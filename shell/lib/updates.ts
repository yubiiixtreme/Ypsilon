// Update-list parsing (pacman/checkupdates, AUR helpers, flatpak). Pure + unit-tested.
export type Source = "pacman" | "aur" | "flatpak"
export type Update = { name: string; from: string; to: string; source: Source }

/** "name 1.0-1 -> 1.1-1" (checkupdates, paru/yay -Qua; trailing "[ignored]" lines are skipped) */
export function parseArrowList(text: string, source: Source): Update[] {
  const out: Update[] = []
  for (const line of text.split("\n")) {
    const m = /^(\S+)\s+(\S+)\s+->\s+(\S+)\s*$/.exec(line.trim())
    if (m) out.push({ name: m[1], from: m[2], to: m[3], source })
  }
  return out
}

/** flatpak remote-ls --updates --columns=application,version (tab separated) */
export function parseFlatpak(text: string): Update[] {
  return text
    .split("\n")
    .map((l) => l.split("\t").map((x) => x.trim()))
    .filter(([app]) => !!app && /^[A-Za-z0-9_.-]+$/.test(app) && app.includes("."))
    .map(([app, version]) => ({ name: app, from: "", to: version || "new", source: "flatpak" as const }))
}

const REBOOT = /^(linux(-lts|-zen|-hardened)?|linux-firmware.*|nvidia.*|mesa|systemd|glibc|hyprland|amd-ucode|intel-ucode)$/

/** packages whose update means you should reboot (kernel, drivers, init, libc, compositor) */
export const needsReboot = (list: Update[]) => list.filter((u) => u.source !== "flatpak" && REBOOT.test(u.name))

export function summarize(list: Update[]) {
  const by = (s: Source) => list.filter((u) => u.source === s).length
  return { total: list.length, pacman: by("pacman"), aur: by("aur"), flatpak: by("flatpak"), reboot: needsReboot(list).length }
}
