// Pure color parsing + conversion (unit-tested in tests/plugins.test.mjs).
// Accepts #rgb #rrggbb, rgb()/rgba(), hsl(), and a small named set.

/** @typedef {{ r: number, g: number, b: number }} RGB */

/** @type {Record<string, number[]>} */
const NAMED = {
  black: [0, 0, 0], white: [255, 255, 255], red: [255, 0, 0], lime: [0, 255, 0],
  blue: [0, 0, 255], yellow: [255, 255, 0], cyan: [0, 255, 255], magenta: [255, 0, 255],
  silver: [192, 192, 192], gray: [128, 128, 128], grey: [128, 128, 128],
  maroon: [128, 0, 0], olive: [128, 128, 0], green: [0, 128, 0], purple: [128, 0, 128],
  teal: [0, 128, 128], navy: [0, 0, 128], orange: [255, 165, 0], pink: [255, 192, 203],
}

/** @returns {RGB | null} */
export function parseColor(/** @type {string} */ q) {
  const s = q.trim().toLowerCase()
  if (!s) return null
  let m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(s)
  if (m) {
    const h = m[1].length === 3 ? m[1].split("").map((c) => c + c).join("") : m[1]
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) }
  }
  m = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*[\d.]+)?\s*\)$/.exec(s)
  if (m) {
    const [r, g, b] = [Number(m[1]), Number(m[2]), Number(m[3])]
    if ([r, g, b].every((v) => v >= 0 && v <= 255)) return { r, g, b }
    return null
  }
  m = /^hsl\(\s*(\d{1,3})\s*,\s*(\d{1,3})%\s*,\s*(\d{1,3})%\s*\)$/.exec(s)
  if (m) {
    const [h, sat, li] = [Number(m[1]), Number(m[2]), Number(m[3])]
    if (h <= 360 && sat <= 100 && li <= 100) return hslToRgb(h, sat, li)
    return null
  }
  const named = NAMED[/^[a-z]+$/.test(s) ? s : ""]
  if (named) return { r: named[0], g: named[1], b: named[2] }
  return null
}

/** @returns {RGB} */
export function hslToRgb(/** @type {number} */ h, /** @type {number} */ s, /** @type {number} */ l) {
  s /= 100
  l /= 100
  const k = (/** @type {number} */ n) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (/** @type {number} */ n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return { r: Math.round(f(0) * 255), g: Math.round(f(8) * 255), b: Math.round(f(4) * 255) }
}

/** @returns {{ h: number, s: number, l: number }} */
export function toHsl(/** @type {RGB} */ { r, g, b }) {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l: Math.round(l * 100) }
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return { h: Math.round(h * 60), s: Math.round(s * 100), l: Math.round(l * 100) }
}

export const toHex = (/** @type {RGB} */ { r, g, b }) =>
  `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`

export const toRgbString = (/** @type {RGB} */ { r, g, b }) => `rgb(${r}, ${g}, ${b})`

/** "ff0000" / "#ff0000" / "rgb(..)" -> { hex, rgb, hsl, text } or null */
export function convert(/** @type {string} */ q) {
  const c = parseColor(q.replace(/^\s*#?([0-9a-f]{6}|[0-9a-f]{3})\s*$/i, "#$1"))
  if (!c) return null
  const hsl = toHsl(c)
  const hex = toHex(c)
  const rgb = toRgbString(c)
  const hslS = `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`
  return { ...c, hex, rgb, hsl: hslS, text: `${hex} · ${rgb} · ${hslS}` }
}
