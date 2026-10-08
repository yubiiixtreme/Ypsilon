// @ts-check
import * as T from "./timer.js"

const LABEL = { idle: "Pomodoro", work: "Focus", short: "Short break", long: "Long break" }
const ICON = { idle: "alarm-symbolic", work: "alarm-symbolic", short: "emoji-food-symbolic", long: "emoji-food-symbolic" }

/** @param {import("../../shell/lib/plugin-types").PluginApi} api */
export default function pomodoro(api) {
  const cfg = () => /** @type {T.Cfg} */ (/** @type {unknown} */ (api.settings.peek()))
  const [timer, setTimer] = api.state(api.storage.get("timer", T.idle()))
  const save = (/** @type {T.Timer} */ t) => (setTimer(t), api.storage.set("timer", t))

  // 1s clock; the state machine decides when a phase is over
  const now = api.poll(Date.now(), 1000, () => {
    const r = T.tick(timer.peek(), cfg(), Date.now())
    if (r.finished) {
      save(r.timer)
      const msg = r.finished === "work" ? `Session ${r.timer.done} done — ${LABEL[r.timer.phase].toLowerCase()} time` : "Break over — back to focus"
      api.notify("Pomodoro", msg, "normal")
    }
    return Date.now()
  })

  const left = api.computed(() => T.format(T.remaining(timer(), now())))
  const running = api.computed(() => T.isRunning(timer()))
  const active = api.computed(() => timer().phase !== "idle")

  const toggle = () => save(T.isRunning(timer.peek()) ? T.pause(timer.peek(), Date.now()) : T.start(timer.peek(), cfg(), Date.now()))
  const reset = () => save(T.idle())

  api.bar.add({
    position: "right",
    order: -10,
    widget: () =>
      api.h(
        "button",
        { class: "pill-btn plugin-pomodoro", visible: active, onClicked: toggle, tooltipText: "click: pause/resume" },
        api.h("box", { spacing: 6 },
          api.h("image", { iconName: api.computed(() => ICON[timer().phase]), pixelSize: 13 }),
          api.h("label", { label: api.computed(() => `${left()}${running() ? "" : " ⏸"}`) }),
        ),
      ),
  })

  api.controlCenter.addTile({
    icon: "alarm-symbolic",
    title: "Pomodoro",
    sub: api.computed(() => (timer().phase === "idle" ? `${cfg().work} min focus` : `${LABEL[timer().phase]} · ${left()}`)),
    active: running,
    onClick: toggle,
  })

  api.launcher.addProvider({
    name: "pomodoro: start · pause · reset",
    prefix: "pomo",
    search: () => [
      { title: running.peek() ? "Pause" : "Start / resume", icon: "media-playback-start-symbolic", run: toggle },
      { title: "Reset", sub: `${timer.peek().done} sessions done`, icon: "view-refresh-symbolic", run: reset },
    ],
  })

  api.commands.add("toggle", () => (toggle(), T.isRunning(timer.peek()) ? "running" : "paused"))
  api.commands.add("reset", () => (reset(), "reset"))
  api.commands.add("status", () => `${LABEL[timer.peek().phase]} ${left.peek()} (${timer.peek().done} done)`)
}
