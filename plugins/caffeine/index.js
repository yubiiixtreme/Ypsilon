// @ts-check
const WHO = "ypsilon-caffeine"

/** @param {import("../../shell/lib/plugin-types").PluginApi} api */
export default function caffeine(api) {
  const [on, setOn] = api.state(false)
  // clear any inhibitor left behind by a previous shell instance
  const stop = () => api.exec(["pkill", "-f", `systemd-inhibit --what=idle:sleep --who=${WHO}`]).catch(() => {})
  void stop()

  const enable = () => {
    if (on.peek()) return
    const secs = Math.round(Number(api.settings.peek().maxHours ?? 4) * 3600)
    setOn(true)
    // the inhibitor lives exactly as long as this `sleep`; it ends by itself after maxHours
    api.exec(["systemd-inhibit", "--what=idle:sleep", `--who=${WHO}`, "--why=Caffeine is on", "sleep", String(secs)])
      .catch(() => {})
      .finally(() => setOn(false))
  }
  const disable = () => (setOn(false), void stop())
  const toggle = () => (on.peek() ? disable() : enable())
  api.onCleanup(() => void stop())

  api.launcher.addProvider({
    name: "Caffeine — keep the machine awake",
    prefix: "caffeine",
    search: () => [{ title: on() ? "Turn caffeine off" : "Keep awake", sub: on() ? "Screen may dim and sleep again" : "Blocks idle dimming, lock and suspend", icon: "weather-clear-symbolic", run: toggle }],
  })

  api.controlCenter.addTile({
    icon: "weather-clear-symbolic",
    title: "Caffeine",
    sub: api.computed(() => (on() ? "Staying awake" : "Off")),
    active: on,
    onClick: toggle,
  })

  api.bar.add({
    position: "right",
    order: -7,
    widget: () =>
      api.h("button", { class: "plugin-chip", visible: on, tooltipText: "Caffeine on — click to turn off", onClicked: disable },
        api.h("image", { iconName: "weather-clear-symbolic", pixelSize: 13 })),
  })

  api.commands.add("toggle", () => (toggle(), on.peek() ? "on" : "off"))
  api.commands.add("status", () => (on.peek() ? "on" : "off"))
}
