// Pure unit conversion (unit-tested in tests/plugins.test.mjs).
// Each unit: [kind, factor to the kind's base unit, display name]. Temperature is special-cased.
/** @type {Record<string, [string, number, string]>} */
const U = {}
/** @param {string} kind @param {number} f @param {string} name @param {string[]} aliases */
const def = (kind, f, name, aliases) => aliases.forEach((a) => (U[a] = [kind, f, name]))

// length (m)
def("length", 1e-3, "mm", ["mm", "millimeter", "millimeters", "millimetre", "millimetres"])
def("length", 1e-2, "cm", ["cm", "centimeter", "centimeters", "centimetre", "centimetres"])
def("length", 1, "m", ["m", "meter", "meters", "metre", "metres"])
def("length", 1e3, "km", ["km", "kilometer", "kilometers", "kilometre", "kilometres"])
def("length", 0.0254, "in", ["in", "inch", "inches", '"'])
def("length", 0.3048, "ft", ["ft", "foot", "feet", "'"])
def("length", 0.9144, "yd", ["yd", "yard", "yards"])
def("length", 1609.344, "mi", ["mi", "mile", "miles"])
def("length", 1852, "nmi", ["nmi", "nautical"])
// mass (kg)
def("mass", 1e-6, "mg", ["mg", "milligram", "milligrams"])
def("mass", 1e-3, "g", ["g", "gram", "grams"])
def("mass", 1, "kg", ["kg", "kilo", "kilos", "kilogram", "kilograms"])
def("mass", 1000, "t", ["t", "ton", "tons", "tonne", "tonnes"])
def("mass", 0.028349523125, "oz", ["oz", "ounce", "ounces"])
def("mass", 0.45359237, "lb", ["lb", "lbs", "pound", "pounds"])
// volume (l)
def("volume", 1e-3, "ml", ["ml", "milliliter", "milliliters", "millilitre", "millilitres"])
def("volume", 1, "l", ["l", "liter", "liters", "litre", "litres"])
def("volume", 3.785411784, "gal", ["gal", "gallon", "gallons"])
def("volume", 0.2365882365, "cup", ["cup", "cups"])
def("volume", 0.0295735295625, "fl oz", ["floz"])
// time (s)
def("time", 1e-3, "ms", ["ms", "millisecond", "milliseconds"])
def("time", 1, "s", ["s", "sec", "secs", "second", "seconds"])
def("time", 60, "min", ["min", "mins", "minute", "minutes"])
def("time", 3600, "h", ["h", "hr", "hrs", "hour", "hours"])
def("time", 86400, "days", ["d", "day", "days"])
def("time", 604800, "weeks", ["wk", "week", "weeks"])
def("time", 31557600, "years", ["y", "yr", "year", "years"])
// data (bytes, binary prefixes like file managers show)
def("data", 1 / 8, "bit", ["bit", "bits"])
def("data", 1, "B", ["b", "byte", "bytes"])
def("data", 1024, "KB", ["kb", "kib", "kilobyte", "kilobytes"])
def("data", 1024 ** 2, "MB", ["mb", "mib", "megabyte", "megabytes"])
def("data", 1024 ** 3, "GB", ["gb", "gib", "gigabyte", "gigabytes"])
def("data", 1024 ** 4, "TB", ["tb", "tib", "terabyte", "terabytes"])
// speed (m/s)
def("speed", 1, "m/s", ["m/s", "mps"])
def("speed", 1 / 3.6, "km/h", ["km/h", "kmh", "kph"])
def("speed", 0.44704, "mph", ["mph"])
def("speed", 0.514444, "kn", ["kn", "knot", "knots"])
// area (m²)
def("area", 1, "m²", ["m2", "sqm"])
def("area", 1e6, "km²", ["km2"])
def("area", 0.09290304, "ft²", ["ft2", "sqft"])
def("area", 10000, "ha", ["ha", "hectare", "hectares"])
def("area", 4046.8564224, "acres", ["acre", "acres"])
// temperature: handled by toKelvin/fromKelvin
for (const [a, n] of [["c", "°C"], ["°c", "°C"], ["celsius", "°C"], ["f", "°F"], ["°f", "°F"], ["fahrenheit", "°F"], ["k", "K"], ["kelvin", "K"]]) U[a] = ["temp", 0, n]

/** @param {number} v @param {string} n */
const toK = (v, n) => (n === "°C" ? v + 273.15 : n === "°F" ? (v - 32) * (5 / 9) + 273.15 : v)
/** @param {number} k @param {string} n */
const fromK = (k, n) => (n === "°C" ? k - 273.15 : n === "°F" ? (k - 273.15) * (9 / 5) + 32 : k)

/** "10 km to mi" -> { value, from, to, text } or null when the query is not a conversion */
export function convert(/** @type {string} */ q) {
  const m = /^\s*(-?\d+(?:[.,]\d+)?)\s*([a-z°'"/²0-9 ]*?)\s+(?:to|in|as|->|=)\s+([a-z°'"/²0-9 ]+?)\s*$/i.exec(q)
  if (!m) return null
  const value = Number(m[1].replace(",", "."))
  const key = (/** @type {string} */ s) => s.toLowerCase().replace(/\s+/g, "").replace(/^fl\.?oz$/, "floz")
  const a = U[key(m[2])], b = U[key(m[3])]
  if (!a || !b || a[0] !== b[0]) return null
  const out = a[0] === "temp" ? fromK(toK(value, a[2]), b[2]) : (value * a[1]) / b[1]
  return { value: out, from: `${value} ${a[2]}`, to: b[2], text: `${format(out)} ${b[2]}` }
}

/** up to 4 significant decimals, no float noise: 6.2137119 -> "6.214", 1e-7 -> "1.0e-7" */
export function format(/** @type {number} */ n) {
  if (n !== 0 && Math.abs(n) < 1e-4) return n.toExponential(1)
  const r = Math.round(n * 1e4) / 1e4
  return r.toLocaleString("en-US", { maximumFractionDigits: 4 })
}
