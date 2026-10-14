// @ts-check
import { parseDuration, format } from "./countdown.js"

/** @param {import("../../shell/lib/plugin-types").PluginApi} api */
export default function timer(api) {
  // timers: label + absolute end time; the 1 s tick only exists while at least one is running
  const [timers, setTimers] = api.state(/** @type {{ id: number, label: string, endsAt: number }[]} */ ([]))
  const [now, setNow] = api.state(Date.now())
  let seq = 0
  /** @type {ReturnType<typeof setInterval> | null} */
  let tick = null

  const stopTick = () => (tick && clearInterval(tick), (tick = null))
  const update = () => {
    const t = Date.now()
    const due = timers.peek().filter((x) => x.endsAt <= t)
    for (const d of due) api.notify("Timer finished", d.label, "critical")
    if (due.length) setTimers(timers.peek().filter((x) => x.endsAt > t))
    if (!timers.peek().length) stopTick()
    else setNow(t)
  }
  const add = (/** @type {number} */ ms) => {
    const label = format(ms)
    setTimers([...timers.peek(), { id: ++seq, label: `${label} timer`, endsAt: Date.now() + ms }])
    setNow(Date.now())
    if (!tick) tick = setInterval(update, 1000)
  }
  const cancelAll = () => (setTimers([]), stopTick())
  api.onCleanup(stopTick)

  const next = api.computed(() => {
    const t = timers()
    return t.length ? Math.min(...t.map((x) => x.endsAt)) - now() : 0
  })

  api.launcher.addProvider({
    name: "Timer — timer 5m · timer 1h30m · timer 90s",
    prefix: "timer",
    search: (q) => {
      /** @type {import("../../shell/lib/plugin-types").Row[]} */
      const rows = []
      const ms = parseDuration(q)
      if (ms) rows.push({ title: `Start ${format(ms)} timer`, sub: "Notifies when time is up", icon: "alarm-symbolic", run: () => add(ms) })
      else if (q.trim()) rows.push({ title: "Not a duration", sub: "Try 5m, 1h30m, 90s or a bare number of minutes", icon: "dialog-question-symbolic", run: () => {} })
      now() // tracked: running rows count down live
      for (const t of timers())
        rows.push({ title: `${format(t.endsAt - Date.now())} left`, sub: `${t.label} · Enter to cancel`, icon: "alarm-symbolic", run: () => setTimers(timers.peek().filter((x) => x.id !== t.id)) })
      return rows
    },
  })

  api.bar.add({
    position: "right",
    order: -6,
    widget: () =>
      api.h(
        "box",
        { class: "plugin-chip", spacing: 5, visible: api.computed(() => api.settings().showInBar !== false && timers().length > 0) },
        api.h("image", { iconName: "alarm-symbolic", pixelSize: 13 }),
        api.h("label", { class: "status-sub", label: api.computed(() => format(next())) }),
      ),
  })

  // ypsilon plugin run timer start 5m · list · cancel
  api.commands.add("start", (args) => {
    const ms = parseDuration(args.join(" "))
    if (!ms) return "usage: start <5m | 1h30m | 90s | minutes>"
    add(ms)
    return `started ${format(ms)}`
  })
  api.commands.add("list", () => timers.peek().map((t) => `${format(t.endsAt - Date.now())}  ${t.label}`).join("\n") || "no timers")
  api.commands.add("cancel", () => (cancelAll(), "cancelled"))
}
