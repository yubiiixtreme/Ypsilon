// Settings building blocks. Every control reads config.json through the reactive `config`
// and writes through writeConfig (validated, other keys preserved, compositor keys applied).
import Gtk from "gi://Gtk"
import GLib from "gi://GLib"
import { Accessor, createComputed } from "ags"
import { config, writeConfig } from "../../services/config"
import { getIn } from "../../lib/config"

const valueAt = <T,>(path: string): Accessor<T> => createComputed(() => getIn(config(), path) as T)

/** coalesce rapid writes (slider drags, typing) into one write per path */
const pending = new Map<string, number>()
export function debouncedWrite(path: string, value: unknown, ms = 250) {
  const t = pending.get(path)
  if (t) GLib.source_remove(t)
  pending.set(
    path,
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, () => {
      pending.delete(path)
      writeConfig(path, value)
      return GLib.SOURCE_REMOVE
    }),
  )
}

export function Section({ title, children }: { title: string; children?: JSX.Element | JSX.Element[] }) {
  return (
    <box class="settings-section" orientation={Gtk.Orientation.VERTICAL} spacing={2}>
      <label class="settings-section-title" label={title} halign={Gtk.Align.START} />
      <box class="settings-group" orientation={Gtk.Orientation.VERTICAL}>
        {children}
      </box>
    </box>
  )
}

function Row({ label, sub, children }: { label: string; sub?: string | Accessor<string>; children?: JSX.Element | JSX.Element[] }) {
  return (
    <box class="settings-row" spacing={12}>
      <box orientation={Gtk.Orientation.VERTICAL} hexpand valign={Gtk.Align.CENTER}>
        <label class="settings-label" label={label} halign={Gtk.Align.START} />
        {sub !== undefined && <label class="settings-sub" label={sub} halign={Gtk.Align.START} wrap xalign={0} />}
      </box>
      {children}
    </box>
  )
}
export { Row as SettingsRow }

export function SwitchRow({ label, sub, path }: { label: string; sub?: string; path: string }) {
  const v = valueAt<boolean>(path)
  return (
    <Row label={label} sub={sub}>
      <switch valign={Gtk.Align.CENTER} active={v} onNotifyActive={({ active }) => active !== v.peek() && writeConfig(path, active)} />
    </Row>
  )
}

export function SliderRow(props: { label: string; sub?: string; path: string; min: number; max: number; step?: number; unit?: string; format?: (v: number) => string }) {
  const v = valueAt<number>(props.path)
  const fmt = props.format ?? ((x: number) => `${Math.round(x * 100) / 100}${props.unit ?? ""}`)
  return (
    <Row label={props.label} sub={props.sub}>
      <box spacing={10} valign={Gtk.Align.CENTER}>
        <slider
          widthRequest={200}
          min={props.min}
          max={props.max}
          step={props.step ?? 1}
          value={v}
          onChangeValue={(_s, _scroll, value) => {
            const step = props.step ?? 1
            debouncedWrite(props.path, Math.round(value / step) * step)
          }}
        />
        <label class="settings-value" widthChars={7} xalign={1} label={v((x) => fmt(x))} />
      </box>
    </Row>
  )
}

export function EntryRow({ label, sub, path, placeholder }: { label: string; sub?: string; path: string; placeholder?: string }) {
  const v = valueAt<string>(path)
  let entry: Gtk.Entry
  const commit = () => entry.get_text() !== v.peek() && writeConfig(path, entry.get_text())
  return (
    <Row label={label} sub={sub}>
      <entry
        class="settings-entry"
        widthRequest={240}
        valign={Gtk.Align.CENTER}
        placeholderText={placeholder ?? ""}
        text={v.peek()}
        onActivate={commit}
        $={(self) => {
          entry = self
          // commit when focus leaves the field, and follow external edits while unfocused
          const fc = new Gtk.EventControllerFocus()
          fc.connect("leave", commit)
          self.add_controller(fc)
          v.subscribe(() => !self.has_focus && self.get_text() !== v.peek() && self.set_text(v.peek()))
        }}
      />
    </Row>
  )
}

export function ChoiceRow({ label, sub, path, options }: { label: string; sub?: string; path: string; options: [string, string][] }) {
  const v = valueAt<string>(path)
  return (
    <Row label={label} sub={sub}>
      <box class="segmented" valign={Gtk.Align.CENTER}>
        {options.map(([value, text]) => (
          <button class={v((cur) => `seg-btn${cur === value ? " on" : ""}`)} label={text} onClicked={() => writeConfig(path, value)} />
        ))}
      </box>
    </Row>
  )
}

export function ButtonRow({ label, sub, button, onClicked, icon }: { label: string; sub?: string | Accessor<string>; button: string; icon?: string; onClicked: () => void }) {
  return (
    <Row label={label} sub={sub}>
      <button class="pill-btn" valign={Gtk.Align.CENTER} onClicked={onClicked}>
        <box spacing={6}>
          {icon && <image iconName={icon} pixelSize={14} />}
          <label label={button} />
        </box>
      </button>
    </Row>
  )
}
