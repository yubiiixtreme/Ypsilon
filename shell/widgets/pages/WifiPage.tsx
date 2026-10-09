import Gtk from "gi://Gtk"
import Network from "gi://AstalNetwork"
import { createBinding, createComputed, createState, For, With } from "ags"
import { connectWifi, disconnectWifi, isSaved, refreshSaved } from "../../services/wifi"
import { dedupeAps } from "../../lib/net"

/** Call when the page opens: rescans and reloads saved profiles. */
export function refreshWifi() {
  refreshSaved()
  Network.get_default().wifi?.scan()
}

function List({ wifi }: { wifi: Network.Wifi }) {
  const [asking, setAsking] = createState<string | null>(null)
  let pw: Gtk.Entry
  const aps = createBinding(wifi, "accessPoints")
  const active = createBinding(wifi, "activeAccessPoint")
  const list = createComputed(() => dedupeAps(aps(), active()).slice(0, 14))

  const pick = async (ap: Network.AccessPoint) => {
    if (!ap.ssid || ap === active()) return
    if (!(await connectWifi(ap.ssid, ap.requiresPassword))) {
      setAsking(ap.ssid)
      pw.set_text("")
      pw.grab_focus()
    }
  }
  const submit = async () => {
    const ssid = asking()
    if (!ssid) return
    await connectWifi(ssid, true, pw.get_text())
    setAsking(null)
  }

  return (
    <box orientation={Gtk.Orientation.VERTICAL} spacing={8}>
      <scrolledwindow hscrollbarPolicy={Gtk.PolicyType.NEVER} propagateNaturalHeight maxContentHeight={320}>
        <box orientation={Gtk.Orientation.VERTICAL} spacing={2}>
          <For each={list}>
            {(ap) => (
              <button class={active((a) => `app-row${a === ap ? " selected" : ""}`)} onClicked={() => pick(ap)}>
                <box spacing={10}>
                  <image iconName={createBinding(ap, "iconName")} pixelSize={18} />
                  <label class="app-name" hexpand halign={Gtk.Align.START} label={ap.ssid ?? ""} />
                  <image iconName="network-wireless-encrypted-symbolic" pixelSize={13} visible={ap.requiresPassword} />
                  <label class="sub" label={active((a) => (a === ap ? "connected" : ap.ssid && isSaved(ap.ssid) ? "saved" : ""))} />
                </box>
              </button>
            )}
          </For>
        </box>
      </scrolledwindow>
      <box spacing={6} visible={asking((a) => a !== null)}>
        <entry
          class="search"
          hexpand
          visibility={false}
          placeholderText={asking((a) => `password for ${a ?? ""}`)}
          onActivate={submit}
          $={(self) => (pw = self)}
        />
        <button class="pill-btn" label="Join" onClicked={submit} />
      </box>
      <button class="pill-btn" label="Disconnect" onClicked={disconnectWifi} halign={Gtk.Align.END} visible={active((a) => a !== null)} />
    </box>
  )
}

export default function WifiPage({ onBack }: { onBack: () => void }) {
  const wifi = createBinding(Network.get_default(), "wifi")
  return (
    <box orientation={Gtk.Orientation.VERTICAL} spacing={8}>
      <box spacing={8}>
        <button class="icon-btn" onClicked={onBack}>
          <image iconName="go-previous-symbolic" pixelSize={14} />
        </button>
        <label class="title" label="Wi-Fi" hexpand halign={Gtk.Align.START} />
        <With value={wifi}>
          {(w) =>
            w ? (
              <box spacing={6}>
                <label class="sub" label="Scanning…" visible={createBinding(w, "scanning")} />
                <button class="icon-btn" onClicked={() => w.scan()} tooltipText="Scan again">
                  <image iconName="view-refresh-symbolic" pixelSize={14} />
                </button>
              </box>
            ) : (
              <box />
            )
          }
        </With>
      </box>
      <With value={wifi}>{(w) => (w ? <List wifi={w} /> : <label class="sub" label="No Wi-Fi adapter" />)}</With>
    </box>
  )
}
