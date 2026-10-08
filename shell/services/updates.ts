// Pending system updates: checkupdates (pacman-contrib; safe, no root, temp sync db),
// paru/yay -Qua for the AUR, flatpak. Checked on an interval from config + on demand.
import { createState } from "ags"
import { execAsync } from "ags/process"
import GLib from "gi://GLib"
import { parseArrowList, parseFlatpak, type Update } from "../lib/updates"
import { config } from "./config"
import { ROOT } from "./theme"

const [updates, setUpdates] = createState<Update[]>([])
const [checking, setChecking] = createState(false)
const [lastChecked, setLastChecked] = createState(0)
const [error, setError] = createState("")
export { updates, checking, lastChecked, error }

const has = (bin: string) => GLib.find_program_in_path(bin) !== null

/**
 * Run a lister and treat its "nothing to report" exit codes as success.
 * (AGS execAsync rejects with stderr text only — no exit code — so the codes are mapped in bash:
 * checkupdates exits 2 and paru/yay -Qua exit 1 when there are no updates.)
 */
function list(argv: string[], okCodes: number[]): Promise<string> {
  const ok = okCodes.join(" ")
  return execAsync(["bash", "-c", `"$@"; rc=$?; for c in 0 ${ok}; do [ "$rc" = "$c" ] && exit 0; done; exit "$rc"`, "_", ...argv])
}

const firstLine = (e: unknown) => (e instanceof Error ? e.message : String(e)).split("\n")[0] || "failed"

export async function checkUpdates() {
  if (checking.peek()) return
  setChecking(true)
  setError("")
  const found: Update[] = []
  const problems: string[] = []
  try {
    if (has("checkupdates")) {
      try {
        found.push(...parseArrowList(await list(["checkupdates", "--nocolor"], [2]), "pacman"))
      } catch (e) {
        problems.push(`pacman: ${firstLine(e)}`)
      }
    } else problems.push("install pacman-contrib for update checks")

    const aur = ["paru", "yay"].find(has)
    if (aur) {
      try {
        found.push(...parseArrowList(await list([aur, "-Qua"], [1]), "aur"))
      } catch (e) {
        problems.push(`aur: ${firstLine(e)}`)
      }
    }

    if (config.peek().updates.flatpak && has("flatpak")) {
      try {
        found.push(...parseFlatpak(await list(["flatpak", "remote-ls", "--updates", "--columns=application,version"], [])))
      } catch (e) {
        problems.push(`flatpak: ${firstLine(e)}`)
      }
    }
    setUpdates(found)
    setError(problems.join(" · "))
  } finally {
    setLastChecked(Math.floor(Date.now() / 1000))
    setChecking(false)
  }
}

export const runUpdates = () =>
  execAsync([`${ROOT}/scripts/ypsilon`, "updates", "run"]).catch((e) => printerr(`ypsilon updates: ${e}`))

let timer = 0
/** start periodic checks (first one after 90s so login stays snappy) */
export function startUpdateChecks() {
  const schedule = (delaySec: number) => {
    if (timer) GLib.source_remove(timer)
    timer = GLib.timeout_add_seconds(GLib.PRIORITY_LOW, delaySec, () => {
      timer = 0
      if (config.peek().updates.enabled) checkUpdates().catch(() => {})
      schedule(config.peek().updates.intervalMin * 60)
      return GLib.SOURCE_REMOVE
    })
  }
  schedule(90)
}

// ---------- Ypsilon itself ----------
const [selfStatus, setSelfStatus] = createState("")
export { selfStatus }

export async function checkSelf() {
  const git = (...a: string[]) => execAsync(["git", "-C", ROOT, ...a])
  try {
    const head = (await git("log", "-1", "--format=%h · %cr")).trim()
    const remote = (await git("remote")).trim()
    if (!remote) return setSelfStatus(`local build ${head} (no remote configured)`)
    await git("fetch", "--quiet").catch(() => "")
    const behind = Number((await git("rev-list", "--count", "HEAD..@{u}").catch(() => "0")).trim()) || 0
    setSelfStatus(behind > 0 ? `${behind} new commit(s) available — current ${head}` : `up to date — ${head}`)
  } catch {
    setSelfStatus("not a git checkout")
  }
}
