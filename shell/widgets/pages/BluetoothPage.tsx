import Gtk from "gi://Gtk"
import Bluetooth from "gi://AstalBluetooth"
import { createBinding, createComputed, For } from "ags"
import { execAsync } from "ags/process"
import { toggleBt } from "../../services/system"

const act = (verb: "connect" | "disconnect", address: string) =>
  execAsync(["bluetoothctl", verb, address]).catch((e) => print(`ypsilon bt ${verb}: ${e}`))

export default function BluetoothPage({ onBack }: { onBack: () => void }) {
  const bt = Bluetooth.get_default()
  const devices = createBinding(bt, "devices")
  const on = createBinding(bt, "isPowered")
  const known = createComputed(() => devices().filter((d) => d.paired || d.connected))
  return (
    <box orientation={Gtk.Orientation.VERTICAL} spacing={8}>
      <box spacing={8}>
        <button class="icon-btn" onClicked={onBack}>
          <image iconName="go-previous-symbolic" pixelSize={14} />
        </button>
        <label class="title" label="Bluetooth" hexpand halign={Gtk.Align.START} />
        <switch active={on} valign={Gtk.Align.CENTER} onNotifyActive={({ active }) => active !== on() && toggleBt(!active)} />
      </box>
      <scrolledwindow hscrollbarPolicy={Gtk.PolicyType.NEVER} propagateNaturalHeight maxContentHeight={320}>
        <box orientation={Gtk.Orientation.VERTICAL} spacing={2}>
          <For each={known}>
            {(d) => (
              <button
                class={createBinding(d, "connected")((c) => `app-row${c ? " selected" : ""}`)}
                onClicked={() => act(d.connected ? "disconnect" : "connect", d.address)}
              >
                <box spacing={10}>
                  <image iconName={d.icon ? `${d.icon}-symbolic` : "bluetooth-symbolic"} pixelSize={18} />
                  <label class="app-name" hexpand halign={Gtk.Align.START} label={d.alias || d.name || d.address} />
                  <label class="sub" visible={createBinding(d, "batteryPercentage")((b) => b > 0)} label={createBinding(d, "batteryPercentage")((b) => `${Math.round(b * 100)}%`)} />
                  <label class="sub" label={createBinding(d, "connected")((c) => (c ? "connected" : "paired"))} />
                </box>
              </button>
            )}
          </For>
        </box>
      </scrolledwindow>
      <label class="sub" label="pair new devices with bluetoothctl or blueman" />
    </box>
  )
}
