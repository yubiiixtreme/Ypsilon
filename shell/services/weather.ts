// Weather via Open-Meteo (no API key). Nothing is fetched until a location is configured.
import { createState } from "ags"
import { execAsync } from "ags/process"
import { readFile, writeFile } from "ags/file"
import GLib from "gi://GLib"
import { forecastUrl, geocodeUrl, parseForecast, parseGeocode, type Weather } from "../lib/weather"
import { config } from "./config"

const CACHE = `${GLib.get_user_cache_dir()}/ypsilon/weather.json`
const [weather, setWeather] = createState<Weather | null>(null)
const [weatherError, setWeatherError] = createState("")
export { weather, weatherError }

const curl = (url: string) => execAsync(["curl", "-fsS", "--max-time", "12", url])

let geo: { key: string; lat: number; lon: number; place: string } | null = null

export async function refreshWeather() {
  const { enabled, location, units } = config.peek().weather
  if (!enabled) return setWeather(null)
  if (!location.trim()) {
    setWeather(null)
    return setWeatherError("set a location in Settings → General")
  }
  try {
    if (!geo || geo.key !== location) {
      const g = parseGeocode(await curl(geocodeUrl(location)))
      if (!g) return setWeatherError(`location "${location}" not found`)
      geo = { key: location, ...g }
    }
    const text = await curl(forecastUrl(geo.lat, geo.lon, units))
    const w = parseForecast(text, geo.place, units)
    if (!w) return setWeatherError("weather service returned no data")
    setWeather(w)
    setWeatherError("")
    writeFile(CACHE, JSON.stringify(w))
  } catch (e) {
    setWeatherError("offline — showing last known weather")
    printerr(`ypsilon weather: ${e}`)
  }
}

export function startWeather() {
  try {
    setWeather(JSON.parse(readFile(CACHE)) as Weather) // instant paint from cache
  } catch {
    /* first run */
  }
  refreshWeather()
  GLib.timeout_add_seconds(GLib.PRIORITY_LOW, 30 * 60, () => (refreshWeather(), GLib.SOURCE_CONTINUE))
  // re-fetch when the location/units change
  let last = JSON.stringify(config.peek().weather)
  config.subscribe(() => {
    const now = JSON.stringify(config.peek().weather)
    if (now !== last) {
      last = now
      refreshWeather()
    }
  })
}
