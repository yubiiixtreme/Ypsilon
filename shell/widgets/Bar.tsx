import app from "ags/gtk4/app"
import { Astal } from "ags/gtk4"
import { createBinding, createComputed, For } from "ags"
import { createPoll } from "ags/time"
import Tray from "gi://AstalTray"
import Network from "gi://AstalNetwork"
import Battery from "gi://AstalBattery"
import Mpris from "gi://AstalMpris"
import { getHypr, STRIP, gotoWorkspace } from "../services/hypr"
import { getWp, toggleMute } from "../services/audio"
import { togglePlay } from "../services/media"

function Workspaces() {
  const hypr = getHypr()
  const spaces = createBinding(hypr, "workspaces")
  const focused = createBinding(hypr, "focusedWorkspace")

  const occupied = createComputed(() => new Set(spaces().map((w) => w.id)))
  const activeId = createComputed(() => focused()?.id ?? -1)
  const state = createComputed(() => ({ active: activeId(), occ: occupied() }))

  return (
    <box class="ws-strip" spacing={4}>
      {STRIP.map((id) => (
        <button
          class={state((s) => `ws-btn${id === s.active ? " active" : ""}${s.occ.has(id) ? " occupied" : ""}`)}
          label={String(id)}
          onClicked={() => gotoWorkspace(id)}
        />
      ))}
    </box>
  )
}

function TrayBox() {
  const tray = Tray.get_default()
  const items = createBinding(tray, "items")
  return (
    <box class="tray-box" spacing={2}>
      <For each={items}>
        {(item) => (
          <button
            class="tray-btn"
            tooltipText={item.title || "tray"}
            onClicked={() => {
              try {
                item.activate(0, 0)
              } catch (e) {
                print(`ypsilon tray: ${e}`)
              }
            }}
          >
            <image gicon={createBinding(item, "gicon")} />
          </button>
        )}
      </For>
      {<label class="tray-empty" visible={items((l) => l.length === 0)} label="no tray" />}
    </box>
  )
}

function NetPill() {
  const net = Network.get_default()
  const wifi = createBinding(net, "wifi")
  const ssid = createComputed(() => wifi()?.ssid || "offline")
  return (
    <button class="pill-btn" onClicked={() => app.get_window("ypsilon-control")?.set_visible(true)}>
      <label class="status-sub" label={ssid((s) => `wifi ${s}`)} />
    </button>
  )
}

function VolPill() {
  const speaker = createBinding(getWp().audio, "defaultSpeaker")
  const pct = createComputed(() => (speaker() ? Math.round(speaker().volume * 100) : 0))
  const muted = createComputed(() => (speaker() ? speaker().mute : false))
  return (
    <button class="pill-btn" onClicked={toggleMute}>
      <label class="status-sub" label={pct((v) => (muted() ? "muted" : `vol ${v}`))} />
    </button>
  )
}

function BatPill() {
  const bat = Battery.get_default()
  const pct = createBinding(bat, "percentage")
  const icon = createComputed(() => {
    const v = pct()
    if (v > 0.8) return "battery-full-symbolic"
    if (v > 0.4) return "battery-good-symbolic"
    if (v > 0.15) return "battery-low-symbolic"
    return "battery-caution-symbolic"
  })
  return (
    <box class="pill-btn" spacing={4}>
      <image iconName={icon} pixelSize={14} />
      <label class="status-sub" label={pct((v) => `${Math.round(v * 100)}%`)} />
    </box>
  )
}

function MediaMini() {
  const players = createBinding(Mpris.get_default(), "players")
  const one = createComputed(() => players().find((p) => p.available) ?? null)
  return (
    <box class="media-mini" spacing={6} visible={one((p) => p !== null)}>
      <label class="accent" label="♪" />
      <label class="media-title" label={one((p) => (p?.title || "—").slice(0, 28))} />
      <button
        class="pill-btn"
        label="play"
        onClicked={() => {
          const p = one()
          if (p) togglePlay(p)
        }}
      />
    </box>
  )
}

export default function Bar(monitor: number) {
  const { TOP, LEFT, RIGHT } = Astal.WindowAnchor
  const clock = createPoll("", 1000, 'date "+%a %d %b · %H:%M"')

  const toggle = (name: string) => {
    const w = app.get_window(name)
    if (w) w.visible = !w.visible
  }

  return (
    <window
      visible
      name={`ypsilon-bar-${monitor}`}
      namespace="ypsilon-bar"
      class="ypsilon-bar"
      monitor={monitor}
      exclusivity={Astal.Exclusivity.EXCLUSIVE}
      anchor={TOP | LEFT | RIGHT}
      application={app}
    >
      <centerbox class="bar-inner">
        <box $type="start" class="bar-left" spacing={8}>
          <button class="launch-btn" label="✦ apps" onClicked={() => toggle("ypsilon-launcher")} />
          <Workspaces />
        </box>
        <box $type="center" class="bar-center" spacing={10}>
          <label class="clock" label={clock} />
          <MediaMini />
        </box>
        <box $type="end" class="bar-right" spacing={6}>
          <TrayBox />
          <NetPill />
          <VolPill />
          <BatPill />
          <button class="power-btn" label="power" onClicked={() => toggle("ypsilon-power")} />
        </box>
      </centerbox>
    </window>
  ) as never
}
