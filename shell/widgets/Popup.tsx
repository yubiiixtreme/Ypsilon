import app from "ags/gtk4/app"
import Gtk from "gi://Gtk"
import Gdk from "gi://Gdk"
import GLib from "gi://GLib"
import Graphene from "gi://Graphene"
import { Astal } from "ags/gtk4"
import { config, configValue } from "../services/config"

type Props = {
  /** window name used by `ags toggle <name>` */
  name: string
  /** where the card sits inside the full-screen scrim */
  halign?: Gtk.Align
  valign?: Gtk.Align
  /** card layout preset: sheet = top-center, corner = top-right */
  variant?: "sheet" | "corner" | "panel"
  keymode?: Astal.Keymode
  spacing?: number
  onShow?: () => void
  onHide?: () => void
  /** extra key handling; return true to swallow the key */
  onKey?: (keyval: number, mod: Gdk.ModifierType) => boolean
  children?: JSX.Element | JSX.Element[]
}

/**
 * Shared popup shell (pattern from the official AGS applauncher example).
 * A transparent full-screen layer holds one glass card. Esc closes it, and a
 * click whose position falls outside the card's bounds closes it.
 */
export default function Popup({
  name,
  halign = Gtk.Align.CENTER,
  valign = Gtk.Align.START,
  variant = "sheet",
  keymode = Astal.Keymode.ON_DEMAND,
  spacing = 10,
  onShow,
  onHide,
  onKey,
  children,
}: Props) {
  const { TOP, BOTTOM, LEFT, RIGHT } = Astal.WindowAnchor
  let win: Astal.Window
  let card: Gtk.Box
  let rev: Gtk.Revealer

  const close = () => win.set_visible(false)

  const keyPressed = (_c: Gtk.EventControllerKey, keyval: number, _code: number, mod: Gdk.ModifierType) => {
    if (onKey?.(keyval, mod)) return true
    if (keyval === Gdk.KEY_Escape) {
      close()
      return true
    }
    return false
  }

  const pressed = (_g: Gtk.GestureClick, _n: number, x: number, y: number) => {
    const [ok, rect] = card.compute_bounds(win)
    if (ok && !rect.contains_point(new Graphene.Point({ x, y }))) close()
  }

  // slide the card in on every open (closing uses Hyprland's layer animation)
  const visibleChanged = () => {
    if (win.visible) {
      rev.set_reveal_child(false)
      GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
        rev.set_reveal_child(true)
        return GLib.SOURCE_REMOVE
      })
      onShow?.()
    } else {
      onHide?.()
    }
  }

  return (
    <window
      $={(self) => (win = self)}
      visible={false}
      name={name}
      namespace={name}
      class={`ypsilon-popup ${name}`}
      layer={Astal.Layer.OVERLAY}
      exclusivity={Astal.Exclusivity.IGNORE}
      keymode={keymode}
      anchor={TOP | BOTTOM | LEFT | RIGHT}
      application={app}
      onNotifyVisible={visibleChanged}
    >
      <Gtk.EventControllerKey propagationPhase={Gtk.PropagationPhase.CAPTURE} onKeyPressed={keyPressed} />
      <Gtk.GestureClick onPressed={pressed} />
      <box halign={halign} valign={valign}>
        <revealer
          $={(self) => (rev = self)}
          revealChild={false}
          transitionType={Gtk.RevealerTransitionType.SLIDE_DOWN}
          transitionDuration={config((c) => (c.reduceMotion ? 0 : 240))}
        >
          <box
            $={(self) => (card = self)}
            class={configValue((c) => c.bar.position)(
              // corner cards open just below a top bar instead of covering it
              (pos) => `popup-card ${variant === "sheet" ? "top-sheet" : variant === "panel" ? "panel" : "corner"}${variant === "corner" && pos === "top" ? " under-bar" : ""}`,
            )}
            orientation={Gtk.Orientation.VERTICAL}
            spacing={spacing}
          >
            {children}
          </box>
        </revealer>
      </box>
    </window>
  )
}
