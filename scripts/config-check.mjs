// `ypsilon config check` — explain problems in ~/.config/ypsilon/config.json.
// Uses the same pure module as the shell (Node >= 22.6 runs .ts by stripping types).
import { readFileSync, existsSync } from "node:fs"
import { diagnoseConfig } from "../shell/lib/config.ts"

const path = process.argv[2]
if (!existsSync(path)) {
  console.log(`no config at ${path} — all defaults (create one: ypsilon config init)`)
  process.exit(0)
}
const problems = diagnoseConfig(readFileSync(path, "utf8"))
if (problems.length === 0) console.log(`config ok: ${path}`)
else {
  console.log(`${problems.length} problem(s) in ${path}:`)
  for (const p of problems) console.log(`  - ${p}`)
  process.exit(1)
}
