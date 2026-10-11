// Desktop chrome, one set per monitor: rounded screen corners (cairo, drawn once).
// Click-through and idle at rest. Settings → Desktop (config `desktop.*`) switches it live.
// Wallpaper widgets (clock, stats, …) live in ./Widgets.tsx and only render when enabled
// (config `widgets.enabled`) — nothing sits on the desktop unless you put it there.
import Gtk from "gi://Gtk"
import Gdk from "gi://Gdk"
import Gio from "gi://Gio"
import Pango from "gi://Pango"
import Cairo from "cairo"
import { Astal } from "ags/gtk4"
import { createComputed, createState, For, onCleanup, type Accessor } from "ags"
import { config, writeConfig } from "../services/config"
import { entries, openDesktopEntry, openDesktopFolder } from "../services/desktop"
import { isWidgetEnabled, setWidgetEnabled, addCmdWidget, cmdWidgetIds } from "../services/widgets"
import { BUILTIN_WIDGETS, cmdSettings, cmdTitle } from "../lib/widgets"
import { openSettings } from "./settings/SettingsApp"
import { toggleWindow } from "../services/shell"
import { wallpaperNext } from "../services/system"

/** pointer input passes through to whatever is below (wallpaper, windows) */
export function clickThrough(win: Gtk.Window) {
  const apply = () => win.get_surface()?.set_input_region(new Cairo.Region())
  win.connect("map", apply)
  if (win.get_mapped()) apply()
  return apply
}

type Corner = "tl" | "tr" | "bl" | "br"

/** black fill outside a quarter circle — the screen looks physically rounded */
function drawCorner(at: Corner) {
  return (_area: Gtk.DrawingArea, cr: Cairo.Context, w: number, h: number) => {
    const r = Math.min(w, h)
    // draw the top-left shape, mirrored into place for the other corners
    cr.translate(at[1] === "r" ? w : 0, at[0] === "b" ? h : 0)
    cr.scale(at[1] === "r" ? -1 : 1, at[0] === "b" ? -1 : 1)
    cr.setSourceRGBA(0, 0, 0, 1)
    cr.moveTo(0, 0)
    cr.lineTo(r, 0)
    cr.arcNegative(r, r, r, -Math.PI / 2, -Math.PI)
    cr.closePath()
    cr.fill()
    cr.$dispose()
  }
}

function ScreenCorner({ gdkmonitor, at }: { gdkmonitor: Gdk.Monitor; at: Corner }) {
  let win: Astal.Window
  onCleanup(() => win.destroy())
  const { TOP, BOTTOM, LEFT, RIGHT } = Astal.WindowAnchor
  const size = config((c) => c.desktop.cornerRadius)
  return (
    <window
      $={(self) => {
        win = self
        clickThrough(self)
      }}
      visible={config((c) => c.desktop.screenCorners)}
      namespace="ypsilon-corner"
      class="ypsilon-corner"
      gdkmonitor={gdkmonitor}
      layer={Astal.Layer.TOP}
      exclusivity={Astal.Exclusivity.IGNORE}
      anchor={(at[0] === "t" ? TOP : BOTTOM) | (at[1] === "l" ? LEFT : RIGHT)}
      defaultWidth={size}
      defaultHeight={size}
    >
      <drawingarea contentWidth={size} contentHeight={size} $={(self) => self.set_draw_func(drawCorner(at))} />
    </window>
  )
}

export function ScreenCorners({ gdkmonitor }: { gdkmonitor: Gdk.Monitor }) {
  return (["tl", "tr", "bl", "br"] as const).map((at) => <ScreenCorner gdkmonitor={gdkmonitor} at={at} />)
}

// --- wallpaper icons + right-click menu -------------------------------------
// A fullscreen BACKGROUND-layer window: windows above it keep their clicks, empty
// areas land here. Single click selects, double-click opens, right-click menus.

function DeskIcon({ path, name, icon, iconFile, selected, onSelect }: {
  path: string
  name: string
  icon: string
  iconFile: string | null
  selected: Accessor<string | null>
  onSelect: (path: string) => void
}) {
  const sel = selected((s) => s === path)
  const press = (_g: Gtk.GestureClick, n: number) => {
    if (n >= 2) openDesktopEntry(path)
    else onSelect(path)
  }
  return (
    <box class={sel((s) => `desk-icon${s ? " sel" : ""}`)} orientation={Gtk.Orientation.VERTICAL} spacing={4} widthRequest={112}>
      <Gtk.GestureClick button={Gdk.BUTTON_PRIMARY} onPressed={press} />
      <Gtk.GestureClick button={Gdk.BUTTON_SECONDARY} onPressed={() => onSelect(path)} />
      {iconFile ? (
        <Gtk.Picture file={Gio.File.new_for_path(iconFile)} widthRequest={40} heightRequest={40} contentFit={Gtk.ContentFit.CONTAIN} halign={Gtk.Align.CENTER} />
      ) : (
        <image iconName={icon} pixelSize={40} />
      )}
      <label label={name} halign={Gtk.Align.CENTER} justify={Gtk.Justification.CENTER} wrap maxWidthChars={12} lines={2} ellipsize={Pango.EllipsizeMode.END} />
    </box>
  )
}

/** one menu row: ✓ when on, ＋ when off */
function MenuRow({ label, on, onClick }: { label: string | Accessor<string>; on: Accessor<boolean>; onClick: () => void }) {
  return (
    <button class="desk-menu-row" onClicked={onClick}>
      <box spacing={8}>
        <label class="accent" widthChars={2} label={on((v) => (v ? "✓" : "＋"))} />
        <label hexpand halign={Gtk.Align.START} label={label} />
      </box>
    </button>
  )
}

export function Desktop({ gdkmonitor }: { gdkmonitor: Gdk.Monitor }) {
  const { TOP, BOTTOM, LEFT, RIGHT } = Astal.WindowAnchor
  let win: Astal.Window
  let pop: Gtk.Popover
  onCleanup(() => win.destroy())
  const [selected, setSelected] = createState<string | null>(null)
  const iconsOn = config((c) => c.desktop.showIcons)
  const selName = createComputed(() => entries().find((e) => e.path === selected())?.name ?? "")
  const hasSel = selected((s) => s !== null)

  const pointAt = (x: number, y: number) => {
    pop.set_pointing_to(new Gdk.Rectangle({ x: Math.round(x), y: Math.round(y), width: 1, height: 1 }))
    pop.popup()
  }
  const openSel = () => {
    const p = selected.peek()
    pop.popdown()
    if (p) openDesktopEntry(p)
  }

  return (
    <window
      $={(self) => (win = self)}
      visible
      namespace="ypsilon-desktop"
      class="ypsilon-desktop"
      gdkmonitor={gdkmonitor}
      layer={Astal.Layer.BACKGROUND}
      exclusivity={Astal.Exclusivity.IGNORE}
      anchor={TOP | BOTTOM | LEFT | RIGHT}
    >
      <box hexpand vexpand>
        <Gtk.GestureClick button={Gdk.BUTTON_PRIMARY} onPressed={() => setSelected(null)} />
        <Gtk.GestureClick button={Gdk.BUTTON_SECONDARY} onPressed={(_g, _n, x, y) => pointAt(x, y)} />
        <Gtk.FlowBox
          visible={iconsOn}
          hexpand
          vexpand
          orientation={Gtk.Orientation.VERTICAL}
          homogeneous
          rowSpacing={6}
          columnSpacing={6}
          marginTop={24}
          marginBottom={24}
          marginStart={24}
          marginEnd={24}
          selectionMode={Gtk.SelectionMode.NONE}
        >
          <For each={entries}>
            {(item) => (
              <DeskIcon
                path={item.path}
                name={item.name}
                icon={item.icon}
                iconFile={item.iconFile}
                selected={selected}
                onSelect={(p) => setSelected(p)}
              />
            )}
          </For>
        </Gtk.FlowBox>
        <Gtk.Popover $={(self) => (pop = self)} autohide hasArrow={false} onClosed={() => setSelected(null)}>
          <box class="desk-menu" orientation={Gtk.Orientation.VERTICAL} spacing={2} widthRequest={270}>
            <button class="desk-menu-row" visible={hasSel} onClicked={openSel}>
              <box spacing={8}>
                <label class="accent" widthChars={2} label="▶" />
                <label hexpand halign={Gtk.Align.START} label={selName((n) => `Open ${n}`)} />
              </box>
            </button>
            <label class="desk-menu-head" label="Widgets" halign={Gtk.Align.START} />
            {BUILTIN_WIDGETS.map((w) => (
              <MenuRow
                label={w.name}
                on={config((c) => c.widgets.enabled.includes(w.id))}
                onClick={() => setWidgetEnabled(w.id, !isWidgetEnabled(w.id))}
              />
            ))}
            <For each={cmdWidgetIds}>
              {(id) => (
                <MenuRow
                  label={config((c) => cmdTitle(id, cmdSettings(c.widgets.settings, id).title))}
                  on={config((c) => c.widgets.enabled.includes(id))}
                  onClick={() => setWidgetEnabled(id, !isWidgetEnabled(id))}
                />
              )}
            </For>
            <button
              class="desk-menu-row"
              onClicked={() => {
                addCmdWidget()
                pop.popdown()
                openSettings("desktop")
              }}
            >
              <box spacing={8}>
                <label class="accent" widthChars={2} label="＋" />
                <label hexpand halign={Gtk.Align.START} label="New command widget…" />
              </box>
            </button>
            <Gtk.Separator />
            <MenuRow
              label="Desktop icons"
              on={iconsOn}
              onClick={() => writeConfig("desktop.showIcons", !config.peek().desktop.showIcons)}
            />
            <button class="desk-menu-row" onClicked={() => (pop.popdown(), openDesktopFolder())}>
              <box spacing={8}>
                <label widthChars={2} label="" />
                <label hexpand halign={Gtk.Align.START} label="Open Desktop folder" />
              </box>
            </button>
            <Gtk.Separator />
            <button class="desk-menu-row" onClicked={() => (pop.popdown(), wallpaperNext())}>
              <box spacing={8}>
                <label widthChars={2} label="" />
                <label hexpand halign={Gtk.Align.START} label="Next wallpaper" />
              </box>
            </button>
            <button class="desk-menu-row" onClicked={() => (pop.popdown(), toggleWindow("ypsilon-wallpapers"))}>
              <box spacing={8}>
                <label widthChars={2} label="" />
                <label hexpand halign={Gtk.Align.START} label="All wallpapers…" />
              </box>
            </button>
            <button class="desk-menu-row" onClicked={() => (pop.popdown(), openSettings("desktop"))}>
              <box spacing={8}>
                <label widthChars={2} label="" />
                <label hexpand halign={Gtk.Align.START} label="Display settings…" />
              </box>
            </button>
          </box>
        </Gtk.Popover>
      </box>
    </window>
  )
}
