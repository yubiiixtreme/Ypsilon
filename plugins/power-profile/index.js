// @ts-check
import { PROFILES, LABEL, ICON, parseProfile, nextProfile, matchProfiles } from "./profiles.js"

/** @param {import("../../shell/lib/plugin-types").PluginApi} api */
export default function powerProfile(api) {
  const current = api.poll(/** @type {string | null} */ (null), 15_000, async (prev) => parseProfile(await api.exec(["powerprofilesctl", "get"]).catch(() => "")) ?? prev)
  const [override, setOverride] = api.state(/** @type {string | null} */ (null))
  const active = api.computed(() => override() ?? current())
  const set = (/** @type {string} */ p) => {
    setOverride(p)
    api.exec(["powerprofilesctl", "set", p]).catch((e) => (setOverride(null), api.notify("Power profile", `could not switch: ${e}`, "low")))
  }

  api.launcher.addProvider({
    name: "Power profile — power · power perf · power save",
    prefix: "power",
    search: (q) =>
      matchProfiles(q).map((p) => ({
        title: LABEL[/** @type {keyof typeof LABEL} */ (p)],
        sub: p === active() ? "Active" : "Enter to switch",
        icon: ICON[/** @type {keyof typeof ICON} */ (p)],
        run: () => set(p),
      })),
  })

  api.controlCenter.addTile({
    icon: api.computed(() => ICON[/** @type {keyof typeof ICON} */ (active() ?? "balanced")]),
    title: "Power profile",
    sub: api.computed(() => LABEL[/** @type {keyof typeof LABEL} */ (active() ?? "balanced")] ?? "Unknown"),
    active: api.computed(() => active() === "performance"),
    onClick: () => set(nextProfile(active.peek())),
  })

  // ypsilon plugin run power-profile set performance · get
  api.commands.add("get", () => active.peek() ?? "unknown")
  api.commands.add("set", (args) => {
    const p = PROFILES.find((x) => x === args[0])
    if (!p) return `usage: set <${PROFILES.join(" | ")}>`
    set(p)
    return `switching to ${p}`
  })
}
