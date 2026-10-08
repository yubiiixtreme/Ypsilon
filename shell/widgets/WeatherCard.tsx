import Gtk from "gi://Gtk"
import GLib from "gi://GLib"
import { For, createComputed } from "ags"
import { weather, weatherError } from "../services/weather"
import { describe } from "../lib/weather"
import { config } from "../services/config"
import { openSettings } from "./settings/SettingsApp"

const weekday = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number)
  return GLib.DateTime.new_local(y, m, d, 12, 0, 0)?.format("%a") ?? iso
}

/** current conditions + 5-day forecast; hidden when weather is disabled */
export default function WeatherCard() {
  const w = weather
  const now = createComputed(() => (w() ? describe(w()!.code, w()!.isDay) : { text: "", icon: "weather-severe-alert-symbolic" }))
  const days = createComputed(() => w()?.days ?? [])
  return (
    <box class="weather-card" orientation={Gtk.Orientation.VERTICAL} spacing={8} visible={config((c) => c.weather.enabled)}>
      <box spacing={14} visible={w((x) => x !== null)}>
        <image iconName={now((n) => n.icon)} pixelSize={44} />
        <box orientation={Gtk.Orientation.VERTICAL} valign={Gtk.Align.CENTER} hexpand>
          <label class="weather-temp" halign={Gtk.Align.START} label={w((x) => (x ? `${x.temp}${x.unit}` : ""))} />
          <label class="sub" halign={Gtk.Align.START} label={createComputed(() => (w() ? `${now().text} · feels ${w()!.feels}${w()!.unit}` : ""))} />
        </box>
        <box orientation={Gtk.Orientation.VERTICAL} valign={Gtk.Align.CENTER}>
          <label class="sub" halign={Gtk.Align.END} label={w((x) => x?.place ?? "")} />
          <label class="hint" halign={Gtk.Align.END} label={w((x) => (x ? `💧${x.humidity}% · 🌬${x.wind}` : ""))} />
        </box>
      </box>
      <box spacing={6} homogeneous visible={days((d) => d.length > 0)}>
        <For each={days}>
          {(d) => (
            <box class="weather-day" orientation={Gtk.Orientation.VERTICAL} spacing={2}>
              <label class="hint" label={weekday(d.date)} />
              <image iconName={describe(d.code).icon} pixelSize={18} />
              <label class="sub" label={`${d.max}° / ${d.min}°`} />
            </box>
          )}
        </For>
      </box>
      <button class="pill-btn" visible={createComputed(() => !w() && weatherError() !== "")} onClicked={() => openSettings("general")}>
        <label label={weatherError} wrap />
      </button>
    </box>
  )
}
