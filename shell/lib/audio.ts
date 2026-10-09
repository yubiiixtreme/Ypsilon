// Short, human names for audio devices. Pure + unit-tested.

/** "Alder Lake PCH-P High Definition Audio Controller Speaker" → "Speaker" */
export function shortDeviceName(description: string | null | undefined, max = 22): string {
  let d = (description ?? "").trim()
  if (!d) return "output"
  // ALSA cards: "<chipset> … Controller <port>" — the port is the part you recognise
  const port = /\bController\s+(.+)$/i.exec(d)
  if (port) d = port[1]
  d = d.replace(/\s*\((?:Stereo|Mono|Surround[^)]*)\)\s*$/i, "").replace(/\s+Output$/i, "").trim()
  return d.length > max ? `${d.slice(0, max - 1).trimEnd()}…` : d
}
