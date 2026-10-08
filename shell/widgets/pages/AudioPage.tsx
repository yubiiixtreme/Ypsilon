import Gtk from "gi://Gtk"
import Wp from "gi://AstalWp"
import { createBinding, For } from "ags"
import { audioList } from "../../services/audio"

function DeviceRow({ ep, fallbackIcon }: { ep: Wp.Endpoint; fallbackIcon: string }) {
  return (
    <button class={createBinding(ep, "isDefault")((d) => `app-row${d ? " selected" : ""}`)} onClicked={() => ep.set_is_default(true)}>
      <box spacing={10}>
        <image iconName={ep.icon || fallbackIcon} pixelSize={18} />
        <label class="app-name" halign={Gtk.Align.START} hexpand label={(ep.description || ep.name || "device").slice(0, 38)} />
        <image iconName="object-select-symbolic" pixelSize={14} visible={createBinding(ep, "isDefault")} />
      </box>
    </button>
  )
}

/** per-app volume (an app playing audio = a WirePlumber stream) */
function StreamRow({ s }: { s: Wp.Stream }) {
  return (
    <box class="slider-row" spacing={10}>
      <image iconName={s.icon || "application-x-executable"} pixelSize={18} tooltipText={s.description || s.name} />
      <box orientation={Gtk.Orientation.VERTICAL} hexpand>
        <label class="sub" halign={Gtk.Align.START} label={(s.description || s.name || "app").slice(0, 34)} />
        <slider hexpand min={0} max={1.5} value={createBinding(s, "volume")} onChangeValue={(_w, _scroll, v) => s.set_volume(v)} />
      </box>
      <button class={createBinding(s, "mute")((m) => `icon-btn${m ? " on" : ""}`)} onClicked={() => s.set_mute(!s.mute)}>
        <image iconName={createBinding(s, "volumeIcon")} pixelSize={14} />
      </button>
    </box>
  )
}

export default function AudioPage({ onBack }: { onBack: () => void }) {
  const streams = audioList("streams")
  const speakers = audioList("speakers")
  const mics = audioList("microphones")
  return (
    <box orientation={Gtk.Orientation.VERTICAL} spacing={8}>
      <box spacing={8}>
        <button class="icon-btn" onClicked={onBack}>
          <image iconName="go-previous-symbolic" pixelSize={14} />
        </button>
        <label class="title" label="Sound" hexpand halign={Gtk.Align.START} />
      </box>
      <label class="sub" label="output" halign={Gtk.Align.START} />
      <box orientation={Gtk.Orientation.VERTICAL} spacing={2}>
        <For each={speakers}>{(ep) => <DeviceRow ep={ep} fallbackIcon="audio-speakers-symbolic" />}</For>
      </box>
      <label class="sub" label="input" halign={Gtk.Align.START} />
      <box orientation={Gtk.Orientation.VERTICAL} spacing={2}>
        <For each={mics}>{(ep) => <DeviceRow ep={ep} fallbackIcon="audio-input-microphone-symbolic" />}</For>
      </box>
      <label class="sub" label="apps" halign={Gtk.Align.START} visible={streams((l) => l.length > 0)} />
      <scrolledwindow hscrollbarPolicy={Gtk.PolicyType.NEVER} propagateNaturalHeight maxContentHeight={240}>
        <box orientation={Gtk.Orientation.VERTICAL} spacing={6}>
          <For each={streams}>{(s) => <StreamRow s={s} />}</For>
        </box>
      </scrolledwindow>
    </box>
  )
}
