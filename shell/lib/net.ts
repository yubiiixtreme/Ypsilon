// nmcli terse-output parsing. Pure + unit-tested.

/** Split an nmcli -t line on unescaped ':' and unescape '\:' and '\\'. */
export function splitTerse(line: string): string[] {
  const out: string[] = []
  let cur = ""
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === "\\" && i + 1 < line.length) cur += line[++i]
    else if (c === ":") (out.push(cur), (cur = ""))
    else cur += c
  }
  out.push(cur)
  return out
}

/** Saved Wi-Fi profile names from: nmcli -t -f NAME,TYPE connection show */
export function parseSavedWifi(text: string): Set<string> {
  const names = new Set<string>()
  for (const line of text.split("\n")) {
    const [name, type] = splitTerse(line)
    if (name && type === "802-11-wireless") names.add(name)
  }
  return names
}

/** Strongest entry per SSID, connected one first, then by strength. */
export function dedupeAps<T extends { ssid: string | null; strength: number }>(aps: T[], active: T | null): T[] {
  const best = new Map<string, T>()
  for (const ap of aps) {
    if (!ap.ssid) continue
    const prev = best.get(ap.ssid)
    if (!prev || ap === active || (prev !== active && ap.strength > prev.strength)) best.set(ap.ssid, ap)
  }
  return [...best.values()].sort((a, b) => Number(b === active) - Number(a === active) || b.strength - a.strength)
}
