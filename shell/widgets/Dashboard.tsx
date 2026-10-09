import Gtk from "gi://Gtk"
import GLib from "gi://GLib"
import { Accessor, createState } from "ags"
import { pollWhileMapped } from "../services/watch"
import { cpu, mem, temp, cpuHistory, memHistory } from "../services/sysinfo"
import Graph from "./Graph"
import WeatherCard from "./WeatherCard"
import { config } from "../services/config"
import { pct } from "../lib/sysinfo"
import Popup from "./Popup"
import MediaCard from "./MediaCard"

const greeting = () => {
  const h = new Date().getHours()
  return h < 5 ? "burning the midnight oil" : h < 12 ? "good morning" : h < 18 ? "good afternoon" : "good evening"
}

function Stat(props: { label: string; value: Accessor<number>; text: Accessor<string> }) {
  return (
    <box orientation={Gtk.Orientation.VERTICAL} spacing={4} hexpand>
      <box>
        <label class="sub" label={props.label} hexpand halign={Gtk.Align.START} />
        <label class="stat-val" label={props.text} />
      </box>
      <levelbar class="stat-bar" value={props.value} />
    </box>
  )
}

// Dashboard: big clock, calendar, live system stats, now playing.
// Toggle: click the bar clock, or SUPER+Shift+C.
export default function Dashboard() {
  let cal: Gtk.Calendar | null = null
  // clock + date tick only while the dashboard is open
  const [time, setTime] = createState("")
  const [date, setDate] = createState("")
  const [hello, setHello] = createState("")
  const tick = () => {
    const now = GLib.DateTime.new_now_local()
    setHello(`${greeting()}, ${GLib.get_user_name()}`)
    setTime(now.format(config.peek().bar.clock24h ? "%H:%M" : "%I:%M %p") ?? "")
    setDate(now.format("%A, %d %B") ?? "")
  }

  return (
    <Popup
      name="ypsilon-dashboard"
      variant="corner"
      halign={Gtk.Align.CENTER}
      spacing={14}
      onShow={() => cal?.select_day(GLib.DateTime.new_now_local())}
    >
      <box orientation={Gtk.Orientation.VERTICAL} $={(self) => pollWhileMapped(self, 1000, tick)}>
        <label class="sub" label={hello} halign={Gtk.Align.START} />
        <label class="big-clock" label={time} halign={Gtk.Align.START} />
        <label class="sub" label={date} halign={Gtk.Align.START} />
      </box>
      <WeatherCard />
      <Gtk.Calendar $={(self: Gtk.Calendar) => (cal = self)} />
      <box spacing={14}>
        <Stat label="cpu" value={cpu} text={cpu((v) => pct(v))} />
        <Stat label="memory" value={mem} text={mem((v) => pct(v))} />
        <Stat label="temp" value={temp((t) => Math.min(1, (t ?? 0) / 100))} text={temp((t) => (t === null ? "—" : `${t}°`))} />
      </box>
      <box spacing={10}>
        <box orientation={Gtk.Orientation.VERTICAL} hexpand spacing={4}>
          <label class="hint" label="cpu · 2 min" halign={Gtk.Align.START} />
          <box class="graph-cpu"><Graph data={cpuHistory} /></box>
        </box>
        <box orientation={Gtk.Orientation.VERTICAL} hexpand spacing={4}>
          <label class="hint" label="memory · 2 min" halign={Gtk.Align.START} />
          <box class="graph-mem"><Graph data={memHistory} /></box>
        </box>
      </box>
      <MediaCard />
    </Popup>
  )
}
