import app from "ags/gtk4/app"
import Gtk from "gi://Gtk"
import { Astal } from "ags/gtk4"
import { createBinding, createState, For } from "ags"
import GLib from "gi://GLib"
import { getNotifd } from "../services/notif"

type Action = { id: string; label: string }
type Notif = {
  id: number
  summary: string
  body: string
  appName?: string
  urgency?: number
  actions?: Action[]
  dismiss(): void
  invoke(id: string): void
}

const dismissSafe = (n: Notif) => {
  try {
    n.dismiss()
  } catch (e) {
    print(`ypsilon notif: ${e}`)
  }
}

function NotifRow({ n }: { n: Notif }) {
  const urgent = n.urgency === 2
  return (
    <box class={`notif-row ${urgent ? "critical" : ""}`} orientation={Gtk.Orientation.VERTICAL} spacing={4}>
      <box spacing={8}>
        <label class="notif-summary" label={n.summary || "(no title)"} />
        <button class="pill-btn" label="x" onClicked={() => dismissSafe(n)} />
      </box>
      {n.body !== "" && <label class="notif-body" label={n.body} wrap />}
      {(n.actions?.length ?? 0) > 0 && (
        <box spacing={6}>
          {(n.actions ?? []).map((a) => (
            <button
              class="pill-btn"
              label={a.label}
              onClicked={() => {
                try {
                  n.invoke(a.id)
                } catch (e) {
                  print(`ypsilon notif action: ${e}`)
                }
              }}
            />
          ))}
        </box>
      )}
    </box>
  )
}

// History center. Toggle with: ags toggle ypsilon-notif-center (SUPER+N).
export function NotificationCenter() {
  const notifd = getNotifd()
  const list = createBinding(notifd, "notifications")

  const clearAll = () => {
    try {
      for (const n of list() as unknown as Notif[]) dismissSafe(n)
    } catch (e) {
      print(`ypsilon notif clear: ${e}`)
    }
  }

  return (
    <window
      visible={false}
      name="ypsilon-notif-center"
      namespace="ypsilon-notif-center"
      class="ypsilon-notif-center"
      anchor={Astal.WindowAnchor.TOP | Astal.WindowAnchor.RIGHT}
      application={app}
    >
      <box class="notif-center-inner" orientation={Gtk.Orientation.VERTICAL} spacing={8}>
        <box spacing={8}>
          <label class="control-title" label="notifications" />
          <button class="pill-btn" label="clear" onClicked={clearAll} />
        </box>
        <box orientation={Gtk.Orientation.VERTICAL} spacing={8}>
          <For each={list}>
            {(n) => <NotifRow n={(n as unknown) as Notif} />}
          </For>
        </box>
        {<label class="control-sub" visible={list((l) => l.length === 0)} label="all caught up ✦" />}
      </box>
    </window>
  ) as never
}

// New-notification toast (top center, auto-hides).
export function Toast() {
  const [current, setCurrent] = createState<Notif | null>(null)
  let gen = 0

  const notifd = getNotifd()
  notifd.connect("notified", (_src: object, id: number) => {
    try {
      const n = (notifd.get_notification(id) as unknown) as Notif
      setCurrent(n)
      const g = ++gen
      GLib.timeout_add(GLib.PRIORITY_DEFAULT, 4500, () => {
        if (g === gen) setCurrent(null)
        return GLib.SOURCE_REMOVE
      })
    } catch (e) {
      print(`ypsilon toast: ${e}`)
    }
  })

  return (
    <window
      visible={current((c) => c !== null)}
      name="ypsilon-toast"
      namespace="ypsilon-toast"
      class="ypsilon-toast"
      anchor={Astal.WindowAnchor.TOP}
      application={app}
    >
      <box halign={Gtk.Align.CENTER}>
        <box class="toast-inner" spacing={10}>
          <label class="notif-summary" label={current((c) => c?.summary ?? "")} />
          <label class="notif-body" label={current((c) => (c?.body ?? "").slice(0, 80))} />
          <button
            class="pill-btn"
            label="x"
            onClicked={() => {
              const n = current()
              if (n) dismissSafe(n)
              setCurrent(null)
            }}
          />
        </box>
      </box>
    </window>
  ) as never
}
