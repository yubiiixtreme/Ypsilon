// @ts-check
import { parsePs, matchProcs } from "./procs.js"

/** @param {import("../../shell/lib/plugin-types").PluginApi} api */
export default function kill(api) {
  /** @type {import("./procs.js").Proc[]} */
  let procs = []
  const refresh = () => api.exec(["ps", "x", "-o", "pid=,rss=,comm="]).then((out) => (procs = parsePs(out))).catch((e) => api.log("ps failed", e))
  void refresh()

  api.launcher.addProvider({
    name: "kill a process — kill firefox",
    prefix: "kill ",
    search: (q) => {
      void refresh()
      return matchProcs(procs, q).map((p) => ({
        title: p.name,
        sub: `pid ${p.pid} · ${p.rssMb} MB · Enter sends SIGTERM`,
        icon: "process-stop-symbolic",
        run: () => void api.exec(["kill", String(p.pid)]).catch((e) => api.notify("Kill", `could not end ${p.name}: ${e}`, "low")),
      }))
    },
  })
}
