// CPU / memory / temperature sampler. One 2s timer, started from app main().
import { createState } from "ags"
import { readFile } from "ags/file"
import GLib from "gi://GLib"
import { parseCpu, cpuUsage, parseMem, hottest, type CpuSample } from "../lib/sysinfo"

const [cpu, setCpu] = createState(0)
const [mem, setMem] = createState(0)
const [temp, setTemp] = createState<number | null>(null)
const HISTORY = 60 // samples (2s each = 2 minutes)
const [cpuHistory, setCpuHistory] = createState<number[]>([])
const [memHistory, setMemHistory] = createState<number[]>([])
export { cpu, mem, temp, cpuHistory, memHistory }

const push = (arr: number[], v: number) => [...arr.slice(-(HISTORY - 1)), v]

function thermalZones(): string[] {
  const out: string[] = []
  try {
    const dir = GLib.Dir.open("/sys/class/thermal", 0)
    let name: string | null
    while ((name = dir.read_name())) if (name.startsWith("thermal_zone")) out.push(`/sys/class/thermal/${name}/temp`)
  } catch {
    /* no thermal sysfs (VM/container) */
  }
  return out
}

let started = false
export function startSysinfo() {
  if (started) return
  started = true
  const zones = thermalZones()
  let prev: CpuSample | null = null

  const tick = () => {
    try {
      const cur = parseCpu(readFile("/proc/stat"))
      if (cur && prev) {
        const u = cpuUsage(prev, cur)
        setCpu(u)
        setCpuHistory((h) => push(h, u))
      }
      if (cur) prev = cur
      const m = parseMem(readFile("/proc/meminfo"))
      if (m !== null) {
        setMem(m)
        setMemHistory((h) => push(h, m))
      }
      setTemp(hottest(zones.map((z) => Number(readFile(z).trim()))))
    } catch (e) {
      print(`ypsilon sysinfo: ${e}`)
    }
    return GLib.SOURCE_CONTINUE
  }
  tick()
  GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 2, tick)
}
