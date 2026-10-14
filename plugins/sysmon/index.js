// @ts-check
import { parseMem, parseLoad, formatMb } from "./stats.js"

/** @param {import("../../shell/lib/plugin-types").PluginApi} api */
export default function sysmon(api) {
  const every = Math.max(2, Number(api.settings.peek().intervalSec ?? 5)) * 1000
  const stats = api.poll({ mem: /** @type {ReturnType<typeof parseMem>} */ (null), load: /** @type {number | null} */ (null) }, every, async (prev) => {
    const [m, l] = await Promise.all([
      api.exec(["cat", "/proc/meminfo"]).catch(() => ""),
      api.exec(["cat", "/proc/loadavg"]).catch(() => ""),
    ])
    return { mem: parseMem(m) ?? prev.mem, load: parseLoad(l) ?? prev.load }
  })

  const pos = /** @type {"left" | "center" | "right"} */ (String(api.settings.peek().position ?? "right"))
  api.bar.add({
    position: pos,
    order: -4,
    widget: () =>
      api.h(
        "box",
        {
          class: "plugin-chip",
          spacing: 8,
          visible: api.computed(() => stats().mem !== null),
          tooltipText: api.computed(() => {
            const { mem, load } = stats()
            return mem ? `RAM ${formatMb(mem.usedMb)} of ${formatMb(mem.totalMb)}\nLoad ${load?.toFixed(2) ?? "?"}` : ""
          }),
        },
        api.h("box", { spacing: 4 },
          api.h("image", { iconName: "drive-harddisk-symbolic", pixelSize: 13 }),
          api.h("label", { class: "status-sub", label: api.computed(() => `${stats().mem?.usedPct ?? 0}%`) }),
        ),
        api.h("label", { class: "status-sub", label: api.computed(() => (stats().load ?? 0).toFixed(1)) }),
      ),
  })

  api.commands.add("now", () => {
    const { mem, load } = stats.peek()
    return mem ? `RAM ${formatMb(mem.usedMb)}/${formatMb(mem.totalMb)} (${mem.usedPct}%) · load ${load?.toFixed(2)}` : "no data yet"
  })
}
