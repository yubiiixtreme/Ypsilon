import { test } from "node:test"
import assert from "node:assert/strict"
import { parseConfig, diagnoseConfig, DEFAULTS } from "../shell/lib/config.ts"
import { parseCpu, cpuUsage, parseMem, hottest } from "../shell/lib/sysinfo.ts"
import { rank, bump, frecency, parseUsage } from "../shell/lib/rank.ts"
import { parseBinds, groupBinds, findConflicts } from "../shell/lib/keys.ts"
import { readFileSync } from "node:fs"
import { splitTerse, parseSavedWifi, dedupeAps } from "../shell/lib/net.ts"

test("config: defaults, partial override, bad values fall back", () => {
  assert.deepEqual(parseConfig(""), DEFAULTS)
  assert.deepEqual(parseConfig("{not json"), DEFAULTS)
  const c = parseConfig(JSON.stringify({ bar: { position: "bottom", clock24h: "yes" }, workspaces: 99, battery: { warnAt: 30 } }))
  assert.equal(c.bar.position, "bottom")
  assert.equal(c.bar.clock24h, true) // wrong type -> default
  assert.equal(c.workspaces, 10) // clamped
  assert.equal(c.battery.warnAt, 30)
  assert.equal(c.battery.criticalAt, DEFAULTS.battery.criticalAt)
  assert.equal(parseConfig('{"bar":{"position":"left"}}').bar.position, "top")
  assert.equal(parseConfig('{"theme":{"followWallpaper":true}}').theme.followWallpaper, true)
  assert.equal(parseConfig('{"launcher":{"webSearch":"nope"}}').launcher.webSearch, DEFAULTS.launcher.webSearch)
})

test("sysinfo: cpu, mem, temp", () => {
  const a = parseCpu("cpu  100 0 100 800 0 0 0 0\ncpu0 1 1 1 1")!
  const b = parseCpu("cpu  200 0 200 1000 0 0 0 0")!
  assert.equal(cpuUsage(a, b), 0.5)
  assert.equal(cpuUsage(b, b), 0)
  assert.equal(parseCpu("garbage"), null)
  assert.equal(parseMem("MemTotal: 1000 kB\nMemAvailable: 250 kB\n"), 0.75)
  assert.equal(parseMem("nothing"), null)
  assert.equal(hottest([41000, 67500, 0, NaN, 999999]), 68)
  assert.equal(hottest([]), null)
})

test("rank: habits break ties but exact match leads; frecency decays", () => {
  const now = 1_000_000_000
  const apps = ["firefox", "foot", "files"]
  const none = rank(apps, (a) => a, {}, now)
  assert.deepEqual(none, apps)
  let u = {}
  for (let i = 0; i < 20; i++) u = bump(u, "files", now)
  assert.equal(rank(apps, (a) => a, u, now)[0], "files")
  assert.ok(frecency({ n: 10, t: now - 14 * 86400 }, now) < frecency({ n: 10, t: now }, now))
  assert.deepEqual(parseUsage("oops"), {})
  assert.deepEqual(parseUsage('{"a":{"n":1,"t":2},"b":5}'), { a: { n: 1, t: 2 } })
})

test("keys: parses binds, expands vars, groups", () => {
  const conf = `$mod = SUPER
bind = $mod, Space, exec, ags toggle -i ypsilon ypsilon-launcher || fuzzel
bind = $mod SHIFT, 1, movetoworkspace, 1
bindel = , XF86AudioRaiseVolume, exec, wpctl set-volume @DEFAULT_AUDIO_SINK@ 5%+ && ags request osd volume
bindm = $mod, mouse:272, movewindow
# bind = $mod, X, exec, nope
`
  const b = parseBinds(conf)
  assert.equal(b.length, 4)
  assert.equal(b[0].combo, "Super + Space")
  assert.equal(b[0].action, "toggle launcher")
  assert.equal(b[0].group, "shell")
  assert.equal(b[1].combo, "Super + Shift + 1")
  assert.equal(b[2].action, "volume up")
  assert.equal(b[3].combo, "Super + LMB")
  assert.ok(groupBinds(b).length >= 3)
})

test("net: nmcli terse parsing + AP dedupe", () => {
  assert.deepEqual(splitTerse("yes:My\\:Net:80:WPA2"), ["yes", "My:Net", "80", "WPA2"])
  const saved = parseSavedWifi("Home:802-11-wireless\nWired connection 1:802-3-ethernet\nCafe\\:5G:802-11-wireless\n")
  assert.deepEqual([...saved], ["Home", "Cafe:5G"])
  const a = { ssid: "Home", strength: 40 }, b = { ssid: "Home", strength: 90 }, c = { ssid: "Cafe", strength: 70 }, d = { ssid: null, strength: 99 }
  assert.deepEqual(dedupeAps([a, b, c, d], null), [b, c])
  assert.deepEqual(dedupeAps([a, b, c], a), [a, c]) // connected AP wins and goes first
})

import { batteryAlert, INITIAL } from "../shell/lib/battery.ts"
test("battery: alerts once per threshold, resets when charging", () => {
  const cfg = { warnAt: 20, criticalAt: 8 }
  let r = batteryAlert(50, false, cfg, INITIAL)
  assert.equal(r.alert, null)
  r = batteryAlert(19, false, cfg, r.state)
  assert.equal(r.alert, "warn")
  r = batteryAlert(18, false, cfg, r.state)
  assert.equal(r.alert, null) // no repeat
  r = batteryAlert(7, false, cfg, r.state)
  assert.equal(r.alert, "critical")
  r = batteryAlert(6, false, cfg, r.state)
  assert.equal(r.alert, null)
  r = batteryAlert(6, true, cfg, r.state) // plugged in resets
  assert.deepEqual(r.state, INITIAL)
  assert.equal(batteryAlert(19, false, cfg, r.state).alert, "warn")
})

import { matchActions, actionScore } from "../shell/lib/actions.ts"
test("actions: palette matching", () => {
  const acts = [
    { id: "lock", title: "Lock screen", icon: "", keywords: ["screensaver"] },
    { id: "reboot", title: "Reboot", icon: "", keywords: ["restart"] },
    { id: "theme-neon", title: "Theme · neon", icon: "", keywords: ["colors"] },
    { id: "game", title: "Game mode", icon: "", keywords: ["performance"] },
  ]
  assert.equal(actionScore("l", acts[0]), 0) // too short
  assert.deepEqual(matchActions("lo", acts).map((a) => a.id), ["lock"])
  assert.deepEqual(matchActions("restart", acts).map((a) => a.id), ["reboot"])
  assert.deepEqual(matchActions("neon", acts).map((a) => a.id), ["theme-neon"])
  assert.deepEqual(matchActions("mode", acts).map((a) => a.id), ["game"])
  assert.deepEqual(matchActions("zzz", acts), [])
})

test("config: diagnostics explain every fallback", () => {
  assert.deepEqual(diagnoseConfig(""), [])
  assert.deepEqual(diagnoseConfig(JSON.stringify({ bar: { position: "bottom" }, workspaces: 7 })), [])
  assert.match(diagnoseConfig("{oops")[0], /not valid JSON/)
  const p = diagnoseConfig(JSON.stringify({ bar: { position: "left", clock24h: "yes", colour: 1 }, workspaces: 99, foo: 1 }))
  assert.equal(p.length, 5)
  assert.ok(p.some((x) => x.startsWith("bar.position:")))
  assert.ok(p.some((x) => x.startsWith("bar.clock24h: expected boolean")))
  assert.ok(p.some((x) => x === "bar.colour: unknown key (ignored)"))
  assert.ok(p.some((x) => x.startsWith("workspaces: 99 is not allowed — using 10")))
  assert.ok(p.some((x) => x === "foo: unknown key (ignored)"))
  assert.deepEqual(diagnoseConfig("[1,2]"), ["config: expected an object"])
  assert.deepEqual(diagnoseConfig('{"workspace": 3}'), ['workspace: unknown key (ignored) — did you mean "workspaces"?'])
  assert.match(diagnoseConfig('{"bar": {"shwTray": true}}')[0], /did you mean "showTray"/)
})

test("keys: the REAL keybinds.conf has no duplicate combos and every bind parses", () => {
  const conf = readFileSync(new URL("../hypr/core/keybinds.conf", import.meta.url), "utf8")
  const binds = parseBinds(conf)
  const lines = conf.split("\n").filter((l) => /^\s*bind[a-z]*\s*=/.test(l))
  assert.equal(binds.length, lines.length, "every bind line must parse")
  assert.deepEqual(findConflicts(binds), [])
  assert.deepEqual(findConflicts(parseBinds("bind = SUPER, Q, killactive,\nbind = SUPER, Q, exec, x")), ["Super + Q"])
})

import { setIn, coerce, getIn } from "../shell/lib/config.ts"
test("config: new sections, injection-safe strings, plugin settings, setIn", () => {
  const c = parseConfig(JSON.stringify({
    hypr: { gapsIn: 999, rounding: 10.6 },
    input: { kbLayout: "us,de", kbOptions: "grp:alt_shift_toggle", sensitivity: 0.37 },
    terminal: "kitty; rm -rf ~",
    plugins: { enabled: ["pomodoro", 3, "pomodoro", "quicklinks"], settings: { pomodoro: { minutes: 50 }, bad: 7 } },
  }))
  assert.equal(c.hypr.gapsIn, 40)            // clamped
  assert.equal(c.hypr.rounding, 11)          // rounded
  assert.equal(c.input.sensitivity, 0.37)    // float kept
  assert.equal(c.input.kbLayout, "us,de")
  assert.equal(c.terminal, "")               // shell metacharacters rejected
  assert.deepEqual(c.plugins.enabled, ["pomodoro", "quicklinks"])
  assert.deepEqual(c.plugins.settings, { pomodoro: { minutes: 50 } })
  assert.equal(parseConfig('{"input":{"kbLayout":"us\\nexec-once = evil"}}').input.kbLayout, "us")

  const o = setIn({ bar: { position: "top", clock24h: false }, x: 1 }, "bar.position", "bottom")
  assert.deepEqual(o, { bar: { position: "bottom", clock24h: false }, x: 1 })
  assert.deepEqual(setIn({}, "plugins.settings.pomodoro.minutes", 25), { plugins: { settings: { pomodoro: { minutes: 25 } } } })
  const orig = { a: { b: 1 } }
  setIn(orig, "a.b", 2)
  assert.equal(orig.a.b, 1)                  // immutable
  assert.equal(coerce("hypr.rounding", 99), 40)
  assert.equal(getIn(DEFAULTS, "hypr.rounding"), 18)
  assert.equal(getIn(DEFAULTS, "nope.deeper"), undefined)
  assert.equal(getIn({ a: 5 }, "a.b"), undefined)
  assert.equal(coerce("bar.position", "left"), "top")
})

import { execFileSync } from "node:child_process"
import { RANGE } from "../shell/lib/config.ts"
test("config: Python (userconf.py) and TypeScript defaults/ranges never drift", () => {
  const py = JSON.parse(execFileSync("python3", [new URL("../scripts/userconf.py", import.meta.url).pathname, "--dump-defaults"], { encoding: "utf8" }))
  assert.deepEqual(py.DEFAULTS.hypr, DEFAULTS.hypr)
  assert.deepEqual(py.DEFAULTS.input, DEFAULTS.input)
  assert.deepEqual(py.DEFAULTS.idle, DEFAULTS.idle)
  assert.equal(py.DEFAULTS.reduceMotion, DEFAULTS.reduceMotion)
  for (const [k, v] of Object.entries(py.RANGE)) assert.deepEqual(RANGE[k], v, k)
})

import { parseArrowList, parseFlatpak, needsReboot, summarize } from "../shell/lib/updates.ts"
test("updates: pacman/aur/flatpak parsing + reboot detection", () => {
  const pac = parseArrowList("linux 6.17.1-1 -> 6.17.2-1\nfirefox 143.0-1 -> 144.0-1\n\nwarning: something\n", "pacman")
  assert.deepEqual(pac.map((u) => u.name), ["linux", "firefox"])
  assert.equal(pac[0].to, "6.17.2-1")
  const aur = parseArrowList("visual-studio-code-bin 1.104-1 -> 1.105-1\nfoo 1 -> 2 [ignored]\n", "aur")
  assert.deepEqual(aur.map((u) => u.name), ["visual-studio-code-bin"])
  const fp = parseFlatpak("com.spotify.Client\t1.2.70\norg.gnome.Platform\t49\nLooking for updates…\n\n")
  assert.deepEqual(fp.map((u) => u.name), ["com.spotify.Client", "org.gnome.Platform"])
  const all = [...pac, ...aur, ...fp]
  assert.deepEqual(needsReboot(all).map((u) => u.name), ["linux"])
  assert.deepEqual(summarize(all), { total: 5, pacman: 2, aur: 1, flatpak: 2, reboot: 1 })
})

import { describe as wdescribe, parseForecast, parseGeocode, forecastUrl } from "../shell/lib/weather.ts"
test("weather: codes, geocode, forecast parsing", () => {
  assert.equal(wdescribe(0).icon, "weather-clear-symbolic")
  assert.equal(wdescribe(0, false).icon, "weather-clear-night-symbolic")
  assert.equal(wdescribe(63).text, "Rain")
  assert.equal(wdescribe(1234).text, "Unknown")
  assert.deepEqual(parseGeocode('{"results":[{"name":"Berlin","country_code":"DE","latitude":52.52,"longitude":13.41}]}'), { lat: 52.52, lon: 13.41, place: "Berlin, DE" })
  assert.equal(parseGeocode('{"generationtime_ms":0.1}'), null)
  assert.equal(parseGeocode("<html>"), null)
  const w = parseForecast(JSON.stringify({
    current: { temperature_2m: 21.6, apparent_temperature: 20.2, relative_humidity_2m: 55, wind_speed_10m: 12.4, weather_code: 2, is_day: 1 },
    daily: { time: ["2026-10-08", "2026-10-09"], weather_code: [2, 61], temperature_2m_max: [22.4, 18.1], temperature_2m_min: [11.2, 9.9] },
  }), "Berlin, DE", "metric")!
  assert.equal(w.temp, 22)
  assert.equal(w.days.length, 2)
  assert.equal(w.days[1].code, 61)
  assert.equal(w.unit, "°C")
  assert.equal(parseForecast("{}", "x", "metric"), null)
  assert.match(forecastUrl(1, 2, "imperial"), /temperature_unit=fahrenheit/)
})

import { validateManifest, resolveSettings } from "../shell/lib/plugins.ts"
test("plugins: manifest validation + settings resolution", () => {
  const good = { id: "pomodoro", name: "Pomodoro", version: "1.0.0", apiVersion: 1, permissions: ["notifications"],
    settings: [{ key: "work", label: "Work", type: "number", default: 25, min: 1, max: 120 },
               { key: "sound", type: "boolean", default: true },
               { key: "mode", type: "enum", default: "a", options: ["a", "b"] }] }
  const r = validateManifest(good, "pomodoro")
  assert.deepEqual(r.errors, [])
  assert.equal(r.manifest!.entry, "index.js")
  assert.equal(r.manifest!.settings.length, 3)

  const bad = validateManifest({ id: "Bad Id", name: "", version: "one", entry: "../../evil.js", apiVersion: 2, permissions: ["root"] }, "other")
  assert.ok(bad.errors.length >= 6, bad.errors.join("\n"))
  assert.equal(bad.manifest, undefined)
  assert.ok(validateManifest({ ...good, id: "pomo" }, "pomodoro").errors.some((e) => e.includes("directory name")))
  assert.ok(validateManifest({ ...good, settings: [{ key: "x", type: "number", default: "5" }] }, "pomodoro").errors.length === 1)

  const s = resolveSettings(r.manifest!.settings, { work: 500, sound: "yes", mode: "b", junk: 1 })
  assert.deepEqual(s, { work: 120, sound: true, mode: "b" })
  assert.deepEqual(resolveSettings(r.manifest!.settings, undefined), { work: 25, sound: true, mode: "a" })
})
