// Bundled plugins: pure logic + manifests validated by the same code the shell uses.
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync, readdirSync } from "node:fs"
import * as T from "../plugins/pomodoro/timer.js"
import { parseLinks, matchLinks } from "../plugins/quicklinks/links.js"
import { parseSs } from "../plugins/dev-ports/ports.js"
import { validateManifest } from "../shell/lib/plugins.ts"

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
