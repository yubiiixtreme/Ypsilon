// Bundled plugins: pure logic + manifests validated by the same code the shell uses.
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync, readdirSync } from "node:fs"
import * as T from "../plugins/pomodoro/timer.js"
import { parseLinks, matchLinks } from "../plugins/quicklinks/links.js"
import { parseSs } from "../plugins/dev-ports/ports.js"
import { validateManifest } from "../shell/lib/plugins.ts"
import { parseNetDev, rates, formatRate } from "../plugins/netspeed/netdev.js"
import * as Todo from "../plugins/todo/list.js"
import { search as emojiSearch, EMOJI } from "../plugins/emoji/data.js"
import { convert, format as fmtUnit } from "../plugins/units/convert.js"
import { parseEntries, isWord } from "../plugins/dictionary/parse.js"

const cfg = { work: 25, shortBreak: 5, longBreak: 15, cycles: 2, autoContinue: true }

test("pomodoro: work -> short -> work -> long, pause/resume", () => {
  let t = T.start(T.idle(), cfg, 0)
  assert.equal(t.phase, "work")
  assert.equal(T.format(T.remaining(t, 0)), "25:00")
  t = T.pause(t, 60_000)
  assert.equal(T.isRunning(t), false)
  assert.equal(T.remaining(t, 10 ** 9), 24 * 60_000) // frozen while paused
  t = T.start(t, cfg, 100_000)
  assert.equal(t.endsAt, 100_000 + 24 * 60_000)
  let r = T.tick(t, cfg, t.endsAt)
  assert.equal(r.finished, "work")
  assert.equal(r.timer.phase, "short")
  r = T.tick(r.timer, cfg, r.timer.endsAt)
  assert.equal(r.timer.phase, "work")
  r = T.tick(r.timer, cfg, r.timer.endsAt)
  assert.equal(r.timer.phase, "long") // 2nd work session -> long break
  assert.equal(r.timer.done, 2)
  const manual = T.tick(T.start(T.idle(), { ...cfg, autoContinue: false }, 0), { ...cfg, autoContinue: false }, 25 * 60_000)
  assert.equal(T.isRunning(manual.timer), false) // waits for the user
})

test("quicklinks: parse + match, unsafe urls dropped", () => {
  const l = parseLinks("GitHub=https://github.com; Wiki=https://wiki.archlinux.org;bad=javascript:alert(1); noeq; =https://x.y")
  assert.deepEqual(l.map((x) => x.name), ["GitHub", "Wiki"])
  assert.deepEqual(matchLinks(l, "wi").map((x) => x.name), ["Wiki"])
  assert.deepEqual(matchLinks(l, "archlinux").map((x) => x.name), ["Wiki"])
})

test("dev-ports: ss parsing (ipv4/ipv6, dedupe, processes)", () => {
  const out = [
    'LISTEN 0 511 127.0.0.1:5173 0.0.0.0:* users:(("node",pid=4242,fd=23))',
    'LISTEN 0 511 [::1]:5173 [::]:* users:(("node",pid=4242,fd=24))',
    "LISTEN 0 4096 0.0.0.0:22 0.0.0.0:*",
    'LISTEN 0 128 [::]:8080 [::]:* users:(("python3",pid=7,fd=3))',
    "ESTAB 0 0 1.2.3.4:5 6.7.8.9:10",
  ].join("\n")
  const l = parseSs(out)
  assert.deepEqual(l.map((x) => x.port), [22, 5173, 8080])
  assert.equal(l[1].process, "node")
  assert.equal(l[1].pid, 4242)
  assert.equal(l[2].address, "::")
})

test("every bundled plugin has a valid manifest and an index.js", () => {
  for (const id of readdirSync(new URL("../plugins/", import.meta.url))) {
    if (id.includes(".")) continue
    const m = JSON.parse(readFileSync(new URL(`../plugins/${id}/plugin.json`, import.meta.url), "utf8"))
    assert.deepEqual(validateManifest(m, id).errors, [], id)
    readFileSync(new URL(`../plugins/${id}/${m.entry ?? "index.js"}`, import.meta.url))
  }
})

test("netspeed: /proc/net/dev parsing, busiest interface, counter resets, formatting", () => {
  const head = "Inter-|   Receive |  Transmit\n face |bytes packets errs drop fifo frame compressed multicast|bytes packets\n"
  const a = parseNetDev(head + "    lo: 900 9 0 0 0 0 0 0 900 9 0 0 0 0 0 0\n wlan0: 1000 10 0 0 0 0 0 0 500 5 0 0 0 0 0 0\n  eth0: 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0")
  assert.deepEqual(Object.keys(a), ["wlan0", "eth0"])
  const b = { wlan0: { rx: 1000 + 2048 * 2, tx: 500 + 1024 }, eth0: { rx: 0, tx: 0 } }
  assert.deepEqual(rates(a, b, 2000), { down: 2048, up: 512 })
  assert.deepEqual(rates(a, b, 2000, "eth0"), { down: 0, up: 0 })
  assert.deepEqual(rates(b, a, 2000), { down: 0, up: 0 }) // counters went backwards: no negative speed
  assert.equal(formatRate(0), "0 B/s")
  assert.equal(formatRate(1536), "1.5 KB/s")
  assert.equal(formatRate(12.5 * 1024 * 1024), "13 MB/s")
})

test("todo: add (trimmed, no duplicates), toggle, view order, clear, sanitize", () => {
  let l = Todo.add([], "  buy   milk ")
  l = Todo.add(l, "Buy milk") // duplicate of an open item
  l = Todo.add(l, "call mum")
  l = Todo.add(l, "   ")
  assert.deepEqual(l.map((i) => i.text), ["buy milk", "call mum"])
  l = Todo.toggle(l, 1)
  assert.deepEqual(Todo.view(l).map((i) => i.text), ["call mum", "buy milk"]) // open first
  assert.deepEqual(Todo.view(l, "MUM").map((i) => i.id), [2])
  assert.equal(Todo.open(l).length, 1)
  assert.deepEqual(Todo.clearDone(l).map((i) => i.id), [2])
  assert.deepEqual(Todo.sanitize([{ id: 1, text: "ok" }, { id: "x" }, null, 5]), [{ id: 1, text: "ok", done: false }])
  assert.deepEqual(Todo.sanitize("nope"), [])
})

test("emoji: exact name first, then prefixes; data is well-formed", () => {
  assert.equal(emojiSearch("fire")[0].char, "🔥")
  assert.equal(emojiSearch("heart")[0].char, "❤️")
  assert.ok(emojiSearch("thumb").some((e) => e.char === "👍"))
  assert.deepEqual(emojiSearch("   "), [])
  assert.equal(new Set(EMOJI.map((e) => e.char)).size, EMOJI.length, "no duplicate emoji")
  for (const e of EMOJI) assert.ok(e.char && e.words, JSON.stringify(e))
})

test("units: lengths, temperature, data, separators, nonsense rejected", () => {
  assert.equal(convert("10 km to mi").text, "6.2137 mi")
  assert.equal(convert("72 f in c").text, "22.2222 °C")
  assert.equal(convert("0 c to f").text, "32 °F")
  assert.equal(convert("1.5 gb to mb").text, "1,536 MB")
  assert.equal(convert("90 min to h").text, "1.5 h")
  assert.equal(convert("5,5 kg -> lb").text, "12.1254 lb")
  assert.equal(convert("10 km to kg"), null) // different kinds
  assert.equal(convert("hello world"), null)
  assert.equal(convert("10 parsecs to m"), null)
  assert.equal(fmtUnit(0.00000012), "1.2e-7")
})

test("dictionary: Wiktionary HTML stripped, senses spread over parts of speech, language picked", () => {
  const json = JSON.stringify({
    en: [
      { partOfSpeech: "Verb", definitions: [{ definition: "To <a href='/wiki/move'>move</a> fast." }, { definition: "To operate &amp; manage." }] },
      { partOfSpeech: "Noun", definitions: [{ definition: "An act of running.", examples: ["a <b>morning</b> run"] }, { definition: "" }] },
    ],
    de: [{ partOfSpeech: "Noun", definitions: [{ definition: "<a>house</a>, building" }] }],
  })
  const s = parseEntries(json, "en", "run", 3)
  assert.deepEqual(s.map((x) => `${x.pos}:${x.text}`), ["verb:To move fast.", "noun:An act of running.", "verb:To operate & manage."])
  assert.equal(s[1].example, "a morning run")
  assert.deepEqual(parseEntries(json, "de", "Haus").map((x) => x.text), ["house, building"])
  assert.deepEqual(parseEntries(json, "fr"), [])
  assert.deepEqual(parseEntries("not json"), [])
  assert.ok(isWord("serendipity") && isWord("well-being") && isWord("Straße") && !isWord("rm -rf") && !isWord("a"))
})

import { parseQuery as parsePw, generate as genPw, strength as pwStrength } from "../plugins/pass/gen.js"
test("pass: lengths, symbol modes, deterministic output", () => {
  assert.deepEqual(parsePw(""), { length: 20, symbols: true, digits: true })
  assert.deepEqual(parsePw("16"), { length: 16, symbols: true, digits: true })
  assert.deepEqual(parsePw("16 no symbols"), { length: 16, symbols: false, digits: true })
  assert.equal(parsePw("2"), null)
  assert.equal(parsePw("once upon a time"), null)
  const a = genPw(12, { symbols: true }, () => 0.5)
  const b = genPw(12, { symbols: true }, () => 0.5)
  assert.equal(a, b)
  assert.equal(a.length, 12)
  assert.ok(/^[a-zA-Z0-9!@#$%^&*+\-=?]+$/.test(a))
  const plain = genPw(16, { symbols: false }, () => 0.1)
  assert.ok(!/[!@#$%^&*+\-=?]/.test(plain))
  assert.equal(pwStrength(8, 70), "weak")
  assert.equal(pwStrength(20, 74), "very strong")
})

import { parseColor, convert as convertColor, toHex } from "../plugins/color/color.js"
test("color: hex, rgb, hsl, named", () => {
  assert.deepEqual(parseColor("#ff0000"), { r: 255, g: 0, b: 0 })
  assert.deepEqual(parseColor("#f00"), { r: 255, g: 0, b: 0 })
  assert.deepEqual(parseColor("rgb(255, 0, 0)"), { r: 255, g: 0, b: 0 })
  assert.deepEqual(parseColor("hsl(0, 100%, 50%)"), { r: 255, g: 0, b: 0 })
  assert.deepEqual(parseColor("teal"), { r: 0, g: 128, b: 128 })
  assert.equal(parseColor("not a color"), null)
  assert.equal(parseColor(""), null)
  const c = convertColor("#ff0000")
  assert.equal(c.hex, "#ff0000")
  assert.ok(c.text.includes("rgb(255, 0, 0)"))
  assert.equal(toHex({ r: 0, g: 128, b: 128 }), "#008080")
  assert.equal(convertColor("hello world"), null)
})

import { parseQuery as parseZone, formatAt, offsetToString } from "../plugins/clock/zones.js"
test("clock: zones, offsets, formatting", () => {
  assert.deepEqual(parseZone("tokyo")?.offset, 540)
  assert.deepEqual(parseZone("utc+5:30")?.offset, 330)
  assert.deepEqual(parseZone("gmt-4")?.offset, -240)
  assert.deepEqual(parseZone(""), { name: "local", offset: null })
  assert.equal(parseZone("mordor"), null)
  assert.equal(parseZone("utc+99"), null)
  assert.equal(formatAt(Date.UTC(2026, 0, 1, 12, 0, 0), 330), "17:30")
  assert.equal(formatAt(Date.UTC(2026, 0, 1, 12, 0, 0), -240), "08:00")
  assert.equal(offsetToString(330), "+05:30")
  assert.equal(offsetToString(-240), "-04:00")
})
