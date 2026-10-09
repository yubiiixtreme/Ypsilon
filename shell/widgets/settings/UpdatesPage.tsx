import Gtk from "gi://Gtk"
import GLib from "gi://GLib"
import { createComputed, For } from "ags"
import { execAsync } from "ags/process"
import { updates, checking, lastChecked, error, checkUpdates, runUpdates, selfStatus, checkSelf } from "../../services/updates"
import { needsReboot, summarize, type Source } from "../../lib/updates"
import { ROOT } from "../../services/theme"
import { openUri } from "../../services/system"
import { Section, SwitchRow, SliderRow, ButtonRow } from "./controls"

const SOURCES: [Source, string, string][] = [
  ["pacman", "Official packages", "system-software-install-symbolic"],
  ["aur", "AUR", "application-x-addon-symbolic"],
  ["flatpak", "Flatpak", "application-x-executable-symbolic"],
]

const ago = (t: number) => {
  if (!t) return "never"
  const s = Math.floor(Date.now() / 1000) - t
  return s < 60 ? "just now" : s < 3600 ? `${Math.floor(s / 60)} min ago` : `${Math.floor(s / 3600)} h ago`
}

export default function UpdatesPage() {
  const sum = createComputed(() => summarize(updates()))
  const reboot = createComputed(() => needsReboot(updates()).map((u) => u.name).join(", "))
  const headline = createComputed(() =>
    checking() ? "Checking for updates…" : sum().total === 0 ? "Your system is up to date" : `${sum().total} update${sum().total === 1 ? "" : "s"} available`,
  )

  return (
    <box orientation={Gtk.Orientation.VERTICAL} spacing={18} $={() => { if (!lastChecked.peek()) checkUpdates(); checkSelf() }}>
      <box class="updates-hero" spacing={14}>
        <image iconName={sum((s) => (s.total ? "software-update-available-symbolic" : "object-select-symbolic"))} pixelSize={40} />
        <box orientation={Gtk.Orientation.VERTICAL} hexpand valign={Gtk.Align.CENTER}>
          <label class="settings-hero-title" label={headline} halign={Gtk.Align.START} />
          <label class="settings-sub" halign={Gtk.Align.START}
            label={createComputed(() => `${sum().pacman} official · ${sum().aur} AUR · ${sum().flatpak} Flatpak — checked ${ago(lastChecked())}`)} />
          <label class="settings-sub bad" halign={Gtk.Align.START} visible={error((e) => e !== "")} label={error} wrap xalign={0} />
        </box>
        <button class="pill-btn" valign={Gtk.Align.CENTER} sensitive={checking((c) => !c)} onClicked={() => checkUpdates()}>
          <box spacing={6}>
            <image iconName="view-refresh-symbolic" pixelSize={14} />
            <label label="Check" />
          </box>
        </button>
        <button class="pill-btn primary" valign={Gtk.Align.CENTER} visible={sum((s) => s.total > 0)} onClicked={runUpdates} tooltipText="Opens a terminal: pacman/AUR + flatpak">
          <box spacing={6}>
            <image iconName="system-software-install-symbolic" pixelSize={14} />
            <label label="Update all" />
          </box>
        </button>
      </box>

      <box class="reboot-banner" spacing={10} visible={reboot((r) => r !== "")}>
        <image iconName="system-reboot-symbolic" pixelSize={18} />
        <label hexpand halign={Gtk.Align.START} wrap xalign={0} label={reboot((r) => `Reboot after updating — ${r} will change`)} />
      </box>

      {SOURCES.map(([src, title, icon]) => {
        const list = createComputed(() => updates().filter((u) => u.source === src))
        return (
          <box orientation={Gtk.Orientation.VERTICAL} visible={list((l) => l.length > 0)}>
            <Section title={title}>
              <scrolledwindow hscrollbarPolicy={Gtk.PolicyType.NEVER} propagateNaturalHeight maxContentHeight={260}>
                <box orientation={Gtk.Orientation.VERTICAL}>
                  <For each={list}>
                    {(u) => (
                      <box class="settings-row update-row" spacing={10}>
                        <image iconName={icon} pixelSize={16} />
                        <label class="settings-label" label={u.name} hexpand halign={Gtk.Align.START} />
                        <label class="settings-sub mono" label={u.from ? `${u.from} → ${u.to}` : u.to} />
                      </box>
                    )}
                  </For>
                </box>
              </scrolledwindow>
            </Section>
          </box>
        )
      })}

      <Section title="Automatic checks">
        <SwitchRow label="Check for updates" sub="Uses checkupdates (no root, separate database) + your AUR helper" path="updates.enabled" />
        <SliderRow label="Every" path="updates.intervalMin" min={10} max={1440} step={10} format={(m) => (m < 60 ? `${m} min` : `${Math.round(m / 6) / 10} h`)} />
        <SwitchRow label="Include Flatpak" path="updates.flatpak" />
      </Section>

      <Section title="Ypsilon">
        <ButtonRow label="Ypsilon itself" sub={selfStatus} button="Update Ypsilon" icon="view-refresh-symbolic"
          onClicked={() => execAsync([`${ROOT}/scripts/ypsilon`, "term", `${ROOT}/scripts/ypsilon self-update`]).catch(() => {})} />
        <ButtonRow label="Arch news" sub="Read before big upgrades" button="Open" icon="web-browser-symbolic"
          onClicked={() => openUri("https://archlinux.org/news/")} />
      </Section>
      <label class="hint" halign={Gtk.Align.START} label={`Last check: ${GLib.DateTime.new_now_local().format("%H:%M") ?? ""} session · data refreshes automatically`} visible={false} />
    </box>
  )
}
