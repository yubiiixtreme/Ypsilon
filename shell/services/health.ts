// Crash isolation: every component is built through `guarded`, so one broken widget
// (missing daemon, unexpected API) is logged and reported instead of killing the shell.
import { execAsync } from "ags/process"
import GLib from "gi://GLib"

const failures: { name: string; error: string }[] = []
let reportScheduled = false

function report() {
  if (failures.length === 0) return
  const names = failures.map((f) => f.name).join(", ")
  execAsync([
    "notify-send", "-u", "critical", "-a", "Ypsilon", "-i", "dialog-warning-symbolic",
    `Ypsilon: ${failures.length} component(s) failed`, `${names}\nEverything else is running. Details: ypsilon logs`,
  ]).catch(() => {})
}

export function guarded<T>(name: string, build: () => T, fallback?: () => T): T | undefined {
  try {
    return build()
  } catch (e) {
    const err = e instanceof Error ? `${e.message}\n${e.stack ?? ""}` : String(e)
    printerr(`ypsilon: component "${name}" failed: ${err}`)
    failures.push({ name, error: err.split("\n")[0] })
    if (!reportScheduled) {
      reportScheduled = true
      // batch all startup failures into one notification (after the notification daemon is up)
      GLib.timeout_add(GLib.PRIORITY_DEFAULT, 2500, () => (report(), GLib.SOURCE_REMOVE))
    }
    return fallback?.()
  }
}

/** For `ags request -i ypsilon health` */
export const healthReport = () =>
  failures.length === 0 ? "ok: all components running" : failures.map((f) => `FAILED ${f.name}: ${f.error}`).join("\n")
