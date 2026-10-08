// Open-Meteo parsing + WMO weather-code mapping. Pure + unit-tested.
export type Day = { date: string; code: number; max: number; min: number }
export type Weather = {
  place: string
  temp: number
  feels: number
  humidity: number
  wind: number
  code: number
  isDay: boolean
  days: Day[]
  unit: "°C" | "°F"
}

// WMO 4677 codes used by Open-Meteo -> [description, adwaita icon (day), icon (night)]
const CODES: [number[], string, string, string][] = [
  [[0], "Clear", "weather-clear-symbolic", "weather-clear-night-symbolic"],
  [[1, 2], "Partly cloudy", "weather-few-clouds-symbolic", "weather-few-clouds-night-symbolic"],
  [[3], "Overcast", "weather-overcast-symbolic", "weather-overcast-symbolic"],
  [[45, 48], "Fog", "weather-fog-symbolic", "weather-fog-symbolic"],
  [[51, 53, 55, 56, 57], "Drizzle", "weather-showers-scattered-symbolic", "weather-showers-scattered-symbolic"],
  [[61, 63, 65, 66, 67, 80, 81, 82], "Rain", "weather-showers-symbolic", "weather-showers-symbolic"],
  [[71, 73, 75, 77, 85, 86], "Snow", "weather-snow-symbolic", "weather-snow-symbolic"],
  [[95, 96, 99], "Thunderstorm", "weather-storm-symbolic", "weather-storm-symbolic"],
]

export function describe(code: number, isDay = true): { text: string; icon: string } {
  const hit = CODES.find(([codes]) => codes.includes(code))
  if (!hit) return { text: "Unknown", icon: "weather-severe-alert-symbolic" }
  return { text: hit[1], icon: isDay ? hit[2] : hit[3] }
}

export function forecastUrl(lat: number, lon: number, units: "metric" | "imperial"): string {
  const q = [
    `latitude=${lat.toFixed(4)}`, `longitude=${lon.toFixed(4)}`,
    "current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,is_day",
    "daily=weather_code,temperature_2m_max,temperature_2m_min", "forecast_days=5", "timezone=auto",
    ...(units === "imperial" ? ["temperature_unit=fahrenheit", "wind_speed_unit=mph"] : []),
  ]
  return `https://api.open-meteo.com/v1/forecast?${q.join("&")}`
}

export const geocodeUrl = (name: string) =>
  `https://geocoding-api.open-meteo.com/v1/search?count=1&format=json&name=${encodeURIComponent(name)}`

export function parseGeocode(json: string): { lat: number; lon: number; place: string } | null {
  try {
    const r = JSON.parse(json)?.results?.[0]
    if (!r || !Number.isFinite(r.latitude) || !Number.isFinite(r.longitude)) return null
    return { lat: r.latitude, lon: r.longitude, place: [r.name, r.country_code].filter(Boolean).join(", ") }
  } catch {
    return null
  }
}

export function parseForecast(json: string, place: string, units: "metric" | "imperial"): Weather | null {
  try {
    const o = JSON.parse(json)
    const c = o?.current
    const d = o?.daily
    if (!c || !Number.isFinite(c.temperature_2m)) return null
    const days: Day[] = (d?.time ?? []).map((date: string, i: number) => ({
      date,
      code: d.weather_code?.[i] ?? -1,
      max: Math.round(d.temperature_2m_max?.[i] ?? NaN),
      min: Math.round(d.temperature_2m_min?.[i] ?? NaN),
    }))
    return {
      place,
      temp: Math.round(c.temperature_2m),
      feels: Math.round(c.apparent_temperature ?? c.temperature_2m),
      humidity: Math.round(c.relative_humidity_2m ?? 0),
      wind: Math.round(c.wind_speed_10m ?? 0),
      code: c.weather_code ?? -1,
      isDay: c.is_day !== 0,
      days: days.filter((x) => Number.isFinite(x.max)),
      unit: units === "imperial" ? "°F" : "°C",
    }
  } catch {
    return null
  }
}
