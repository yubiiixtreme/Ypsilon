// Static import audit for the shell: every relative import must resolve, and every
// named import must be exported by its target. Catches rename/removal slips that a
// syntax-only parse cannot (no `ags types` needed). Usage: node scripts/check-imports.mjs
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs"
import { join, dirname, resolve } from "node:path"

const root = resolve(dirname(new URL(import.meta.url).pathname), "..", "shell")
const walk = (d) =>
  readdirSync(d).flatMap((f) => {
    const p = join(d, f)
    if (f === "node_modules" || f === "@girs") return []
    return statSync(p).isDirectory() ? walk(p) : /\.(tsx?|ts)$/.test(f) ? [p] : []
  })

const files = walk(root)
const resolveMod = (from, spec) => {
  const base = resolve(dirname(from), spec)
  return [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")].find((p) => existsSync(p) && statSync(p).isFile())
}

function exportsOf(src) {
  const names = new Set()
  for (const m of src.matchAll(/export\s+(?:async\s+)?(?:const|let|var|function\*?|class|type|interface|enum)\s+(\w+)/g)) names.add(m[1])
  for (const m of src.matchAll(/export\s+(?:const|let)\s+\[([^\]]+)\]/g)) m[1].split(",").forEach((n) => names.add(n.trim()))
  for (const m of src.matchAll(/export\s*\{([^}]+)\}/g))
    m[1].split(",").forEach((n) => names.add(n.trim().split(/\s+as\s+/).pop()))
  const hasDefault = /export\s+default\b/.test(src)
  return { names, hasDefault }
}

let bad = 0
for (const f of files) {
  const src = readFileSync(f, "utf8")
  for (const m of src.matchAll(/import\s+(type\s+)?([^'"]*?)\s+from\s+["'](\.[^"']+)["']/g)) {
    const [, , clause, spec] = m
    const target = resolveMod(f, spec)
    const rel = f.slice(root.length + 1)
    if (!target) {
      if (!/\.(css|json)$/.test(spec)) (console.log(`${rel}: cannot resolve "${spec}"`), bad++)
      continue
    }
    if (/\.json$/.test(target)) continue
    const ex = exportsOf(readFileSync(target, "utf8"))
    const def = /^(\w+)\s*(,|$)/.exec(clause)
    if (def && !ex.hasDefault) (console.log(`${rel}: "${spec}" has no default export`), bad++)
    const named = /\{([^}]*)\}/.exec(clause)
    if (named)
      for (const raw of named[1].split(",")) {
        const n = raw.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0]
        if (n && !ex.names.has(n)) (console.log(`${rel}: "${n}" is not exported by "${spec}"`), bad++)
      }
  }
}
console.log(bad ? `${bad} import problem(s)` : `imports ok (${files.length} files)`)
process.exit(bad ? 1 : 0)
