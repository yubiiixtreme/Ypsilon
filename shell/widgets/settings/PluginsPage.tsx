import Gtk from "gi://Gtk"
import { createComputed, For, With } from "ags"
import { execAsync } from "ags/process"
import { plugins, setPluginEnabled, rescanPlugins, pluginSettingsAccessor, type PluginInfo } from "../../services/plugins"
import { writeConfig } from "../../services/config"
import { CONFIG_DIR } from "../../services/config"
import type { SettingSpec } from "../../lib/plugins"
import { Section, SettingsRow, ButtonRow, debouncedWrite } from "./controls"

const STATUS: Record<PluginInfo["status"], string> = {
  disabled: "off", loading: "loading…", active: "running", error: "error", invalid: "invalid",
}

/** form generated from the plugin's settings schema */
function PluginSettings({ p }: { p: PluginInfo }) {
  const values = pluginSettingsAccessor(p.id)
  const write = (key: string, v: unknown) => writeConfig(`plugins.settings.${p.id}.${key}`, v)
  const control = (s: SettingSpec) => {
    const v = values((all) => all[s.key])
    switch (s.type) {
      case "boolean":
        return <switch valign={Gtk.Align.CENTER} active={v((x) => !!x)} onNotifyActive={({ active }) => active !== !!v.peek() && write(s.key, active)} />
      case "number":
        return (
          <box spacing={8} valign={Gtk.Align.CENTER}>
            <slider widthRequest={160} min={s.min ?? 0} max={s.max ?? 100} step={s.step ?? 1} value={v((x) => Number(x))}
              onChangeValue={(_w, _sc, val) => debouncedWrite(`plugins.settings.${p.id}.${s.key}`, Math.round(val / (s.step ?? 1)) * (s.step ?? 1))} />
            <label class="settings-value" widthChars={5} label={v((x) => String(x))} />
          </box>
        )
      case "enum":
        return (
          <box class="segmented" valign={Gtk.Align.CENTER}>
            {s.options.map((o) => <button class={v((x) => `seg-btn${x === o ? " on" : ""}`)} label={o} onClicked={() => write(s.key, o)} />)}
          </box>
        )
      default:
        return (
          <entry class="settings-entry" widthRequest={260} valign={Gtk.Align.CENTER} text={String(v.peek() ?? "")}
            placeholderText={s.placeholder ?? ""} onActivate={(self) => write(s.key, self.get_text())} />
        )
    }
  }
  return (
    <box orientation={Gtk.Orientation.VERTICAL}>
      {(p.manifest?.settings ?? []).map((s) => (
        <SettingsRow label={s.label} sub={s.type === "string" ? "press Enter to save" : undefined}>
          {control(s)}
        </SettingsRow>
      ))}
    </box>
  )
}

function PluginCard({ p }: { p: PluginInfo }) {
  const enabled = p.status === "active" || p.status === "loading" || p.status === "error"
  return (
    <box class={`plugin-card${p.status === "error" || p.status === "invalid" ? " broken" : ""}`} orientation={Gtk.Orientation.VERTICAL} spacing={6}>
      <box spacing={12}>
        <image iconName="application-x-addon-symbolic" pixelSize={28} valign={Gtk.Align.START} />
        <box orientation={Gtk.Orientation.VERTICAL} hexpand>
          <box spacing={8}>
            <label class="settings-label" label={p.manifest?.name ?? p.id} />
            <label class="settings-sub" label={p.manifest ? `v${p.manifest.version}` : ""} />
            <label class={`status-chip ${p.status}`} label={STATUS[p.status]} />
            <label class="settings-sub" label={p.source === "user" ? "yours" : "bundled"} />
          </box>
          <label class="settings-sub" halign={Gtk.Align.START} wrap xalign={0} label={p.manifest?.description ?? ""} />
          <label class="settings-sub" halign={Gtk.Align.START} visible={!!p.manifest?.permissions.length}
            label={`uses: ${(p.manifest?.permissions ?? []).join(", ")}`} />
          <label class="settings-sub bad" halign={Gtk.Align.START} wrap xalign={0} visible={!!p.error} label={p.error} />
        </box>
        <switch valign={Gtk.Align.START} sensitive={!!p.manifest} active={enabled} onNotifyActive={({ active }) => active !== enabled && setPluginEnabled(p.id, active)} />
      </box>
      {p.status === "active" && (p.manifest?.settings.length ?? 0) > 0 && <PluginSettings p={p} />}
    </box>
  )
}

export default function PluginsPage() {
  const count = createComputed(() => plugins().filter((p) => p.status === "active").length)
  return (
    <box orientation={Gtk.Orientation.VERTICAL} spacing={18}>
      <box class="warn-banner" spacing={10}>
        <image iconName="dialog-warning-symbolic" pixelSize={18} />
        <label hexpand halign={Gtk.Align.START} wrap xalign={0}
          label="Plugins run with your user's permissions. Only enable plugins you trust — read their code first." />
      </box>
      <Section title="Installed">
        <box orientation={Gtk.Orientation.VERTICAL} spacing={8}>
          <For each={plugins}>{(p) => <PluginCard p={p} />}</For>
          <label class="settings-sub" visible={plugins((l) => l.length === 0)} label="No plugins found." />
        </box>
      </Section>
      <Section title="Manage">
        <ButtonRow label="Rescan plugin folders" sub={count((n) => `${n} running`)} button="Rescan" icon="view-refresh-symbolic" onClicked={rescanPlugins} />
        <ButtonRow label="Your plugins folder" sub={`${CONFIG_DIR}/plugins — create one with: ypsilon plugin new my-plugin`} button="Open" icon="folder-symbolic"
          onClicked={() => execAsync(["xdg-open", `${CONFIG_DIR}/plugins`]).catch(() => {})} />
      </Section>
      <With value={count}>{() => <box />}</With>
    </box>
  )
}
