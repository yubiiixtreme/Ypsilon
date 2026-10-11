import app from "ags/gtk4/app"
import Gtk from "gi://Gtk"
import GLib from "gi://GLib"
import Pango from "gi://Pango"
import { Astal } from "ags/gtk4"
import { createBinding, createComputed, createState, For } from "ags"
import Notifd from "gi://AstalNotifd"
import { getNotifd, setDnd, timeLabel } from "../services/notif"
import { getHypr } from "../services/hypr"
import Popup from "./Popup"
import { groupByApp, type Group } from "../lib/notifgroup"

type Notif = Notifd.Notification
const CRITICAL = Notifd.Urgency.CRITICAL

// bodies may carry Pango markup (<b>, <i>, <a>); only enable it when it parses, else show raw text
const looksLikeMarkup = (body: string) => {
  if (!/<[a-z/][^>]*>/i.test(body)) return false
  try {
    return Pango.parse_markup(body, -1, "\0")[0]
  } catch {
    return false
  }
}

const guard = (what: string, fn: () => void) => {
  try {
    fn()
  } catch (e) {
    print(`ypsilon ${what}: ${e}`)
  }
}

function Actions({ n, after }: { n: Notif; after?: () => void }) {
  const actions = n.actions ?? []
  if (actions.length === 0) return <box />
  return (
    <box spacing={6}>
      {actions.map((a) => (
        <button
          class="pill-btn"
          label={a.label}
          onClicked={() =>
            guard("notif action", () => {
              n.invoke(a.id)
              after?.()
            })
          }
        />
      ))}
    </box>
  )
}

function Card({ n, onClose, after }: { n: Notif; onClose: () => void; after?: () => void }) {
  return (
    <box class={`notif-row${n.urgency === CRITICAL ? " critical" : ""}`} orientation={Gtk.Orientation.VERTICAL} spacing={5}>
      <box spacing={8}>
        {/* app_icon may be an icon name or an absolute file path */}
        {n.appIcon?.startsWith("/") ? (
          <image file={n.appIcon} pixelSize={16} />
        ) : (
          <image iconName={n.appIcon || n.desktopEntry || "dialog-information-symbolic"} pixelSize={16} />
        )}
        <label class="notif-app" hexpand halign={Gtk.Align.START} label={`${n.appName || "app"} · ${timeLabel(n.time ?? 0)}`} />
        <button class="icon-btn" onClicked={onClose} tooltipText="Dismiss">
          <image iconName="window-close-symbolic" pixelSize={11} />
        </button>
      </box>
      <box spacing={10}>
        {/* image hint: a file path (avatars, album art, screenshots) */}
        {!!n.image && GLib.file_test(n.image, GLib.FileTest.EXISTS) && (
          <box class="notif-image" overflow={Gtk.Overflow.HIDDEN} valign={Gtk.Align.START}>
            <image file={n.image} pixelSize={48} />
          </box>
        )}
        <box orientation={Gtk.Orientation.VERTICAL} spacing={3} hexpand>
          <label class="notif-summary" halign={Gtk.Align.START} wrap xalign={0} label={n.summary || "(no title)"} />
          {n.body !== "" && (
            <label class="notif-body" halign={Gtk.Align.START} wrap xalign={0} maxWidthChars={44} useMarkup={looksLikeMarkup(n.body)} label={n.body} />
          )}
        </box>
      </box>
      <Actions n={n} after={after} />
    </box>
  )
}

// apps whose stack is unfolded (kept across rebuilds of the list)
const [expanded, setExpanded] = createState<Set<string>>(new Set())
const flip = (key: string) =>
  setExpanded((s) => {
    const next = new Set(s)
    if (!next.delete(key)) next.add(key)
    return next
  })

/** one app's notifications: newest card on top, the rest folded behind "+N more" */
function AppGroup({ g }: { g: Group<Notif> }) {
  const [first, ...rest] = g.items
  const close = (n: Notif) => () => guard("notif dismiss", () => n.dismiss())
  if (rest.length === 0) return <Card n={first} onClose={close(first)} />
  const open = expanded((s) => s.has(g.key))
  return (
    <box class="notif-group" orientation={Gtk.Orientation.VERTICAL} spacing={6}>
      <box class="notif-group-head" spacing={6}>
        <label class="notif-app" hexpand halign={Gtk.Align.START} label={`${g.name} · ${g.items.length}`} />
        <button class="pill-btn" onClicked={() => flip(g.key)} label={open((o) => (o ? "Show less" : `+${rest.length} more`))} />
        <button class="icon-btn" tooltipText={`Dismiss all from ${g.name}`} onClicked={() => guard("notif dismiss group", () => g.items.forEach((n) => n.dismiss()))}>
          <image iconName="edit-clear-all-symbolic" pixelSize={13} />
        </button>
      </box>
      <Card n={first} onClose={close(first)} />
      <revealer revealChild={open} transitionType={Gtk.RevealerTransitionType.SLIDE_DOWN}>
        <box orientation={Gtk.Orientation.VERTICAL} spacing={6}>
          {rest.map((n) => <Card n={n} onClose={close(n)} />)}
        </box>
      </revealer>
    </box>
  )
}

// History center, grouped by app. Toggle with: ags toggle ypsilon-notif-center (SUPER+N).
export function NotificationCenter() {
  const notifd = getNotifd()
  const list = createBinding(notifd, "notifications")
  const dnd = createBinding(notifd, "dontDisturb")
  const groups = createComputed(() => groupByApp(list()))

  const clearAll = () => guard("notif clear", () => list().forEach((n) => n.dismiss()))

  return (
    <Popup name="ypsilon-notif-center" variant="corner" halign={Gtk.Align.END} spacing={10}>
      <box spacing={8}>
        <label class="title" hexpand halign={Gtk.Align.START} label="Notifications" marginStart={4} />
        <label class="sub" label="Do not disturb" />
        <switch active={dnd} valign={Gtk.Align.CENTER} onNotifyActive={({ active }) => setDnd(active)} />
        <button class="pill-btn" label="Clear all" visible={list((l) => l.length > 0)} onClicked={clearAll} />
      </box>
      <scrolledwindow
        hscrollbarPolicy={Gtk.PolicyType.NEVER}
        propagateNaturalHeight
        maxContentHeight={520}
        visible={list((l) => l.length > 0)}
      >
        <box class="notif-center-list" orientation={Gtk.Orientation.VERTICAL} spacing={8}>
          <For each={groups}>{(g) => <AppGroup g={g} />}</For>
        </box>
      </scrolledwindow>
      <box orientation={Gtk.Orientation.VERTICAL} spacing={8} visible={list((l) => l.length === 0)} marginTop={24} marginBottom={24}>
        <image iconName="notifications-disabled-symbolic" pixelSize={32} class="dim" />
        <label class="sub" label="No notifications" />
      </box>
    </Popup>
  )
}

// New-notification toasts (top center, stacked, auto-hide).
// Quiet while DND is on or a fullscreen app is focused (games, video) — critical ones always show.
export function Toast() {
  const [toasts, setToasts] = createState<Notif[]>([])
  const notifd = getNotifd()
  const timers = new Map<number, number>() // notification id -> GLib source id

  const remove = (id: number) => {
    const t = timers.get(id)
    if (t !== undefined) GLib.source_remove(t)
    timers.delete(id)
    setToasts((list) => list.filter((n) => n.id !== id))
  }

  const quiet = () => notifd.dontDisturb || !!getHypr()?.focusedWorkspace?.hasFullscreen

  notifd.connect("notified", (_src, id) => {
    guard("toast", () => {
      const n = notifd.get_notification(id)
      if (!n || (quiet() && n.urgency !== CRITICAL)) return
      // a replaced notification (same id, e.g. progress updates) restarts its own timer
      const old = timers.get(id)
      if (old !== undefined) GLib.source_remove(old)
      setToasts((list) => [...list.filter((t) => t.id !== id), n].slice(-3))
      timers.set(
        id,
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, n.urgency === CRITICAL ? 9000 : 4500, () => {
          timers.delete(id)
          setToasts((list) => list.filter((t) => t.id !== id))
          return GLib.SOURCE_REMOVE
        }),
      )
    })
  })
  notifd.connect("resolved", (_src, id) => remove(id))

  return (
    <window
      visible={toasts((t) => t.length > 0)}
      name="ypsilon-toast"
      namespace="ypsilon-toast"
      class="ypsilon-toast"
      layer={Astal.Layer.OVERLAY}
      anchor={Astal.WindowAnchor.TOP}
      application={app}
    >
      <box orientation={Gtk.Orientation.VERTICAL} spacing={8} halign={Gtk.Align.CENTER}>
        <For each={toasts}>
          {(n) => (
            <box class={`toast-inner${n.urgency === CRITICAL ? " critical" : ""}`}>
              <Card n={n} onClose={() => remove(n.id)} after={() => remove(n.id)} />
            </box>
          )}
        </For>
      </box>
    </window>
  )
}
