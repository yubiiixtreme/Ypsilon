import Gtk from "gi://Gtk"
import GLib from "gi://GLib"
import { createState } from "ags"
import { execAsync } from "ags/process"
import { ROOT } from "../../services/theme"
import { CONFIG_PATH, configProblems } from "../../services/config"
import { healthReport } from "../../services/health"
import { Section, ButtonRow, SettingsRow } from "./controls"

const cli = (...a: string[]) => execAsync([`${ROOT}/scripts/ypsilon`, ...a]).catch(() => "")

export default function AboutPage() {
  const [versions, setVersions] = createState("…")
  const [health, setHealth] = createState(healthReport())
  const load = async () => {
    const hypr = (await execAsync(["bash", "-c", "Hyprland --version 2>/dev/null | head -1"]).catch(() => "")).slice(0, 40)
    const ags = (await execAsync(["bash", "-c", "ags --version 2>/dev/null | head -1"]).catch(() => "")).trim()
    const commit = (await execAsync(["git", "-C", ROOT, "log", "-1", "--format=%h %cs"]).catch(() => "")).trim()
    setVersions(`${hypr || "Hyprland ?"} · ags ${ags || "?"} · GTK ${Gtk.get_major_version()}.${Gtk.get_minor_version()} · Ypsilon ${commit || "local"}`)
    setHealth(healthReport())
  }
  return (
    <box orientation={Gtk.Orientation.VERTICAL} spacing={18} $={() => void load()}>
      <box class="about-hero" orientation={Gtk.Orientation.VERTICAL} spacing={4}>
        <label class="about-logo" label="✦ Ypsilon" halign={Gtk.Align.START} />
        <label class="settings-sub" label={versions} halign={Gtk.Align.START} wrap xalign={0} />
        <label class="settings-sub" label={`${GLib.get_user_name()} @ ${GLib.get_host_name()} · ${ROOT}`} halign={Gtk.Align.START} />
      </box>
      <Section title="Health">
        <SettingsRow label="Components" sub={health}>
          <button class="pill-btn" valign={Gtk.Align.CENTER} label="Refresh" onClicked={() => setHealth(healthReport())} />
        </SettingsRow>
        <SettingsRow label="Config file" sub={configProblems().length ? `${configProblems().length} problem(s) — ypsilon config check` : `ok — ${CONFIG_PATH}`} />
        <ButtonRow label="Doctor" sub="Every missing piece with the exact fix" button="Run" icon="utilities-terminal-symbolic" onClicked={() => cli("term", `${ROOT}/scripts/ypsilon doctor`)} />
        <ButtonRow label="Logs" sub="Follow the shell log" button="Open" icon="text-x-generic-symbolic" onClicked={() => cli("term", `${ROOT}/scripts/ypsilon logs`)} />
        <ButtonRow label="Bug report" sub="Bundles doctor, checks and logs into one file in your home folder" button="Create" icon="mail-attachment-symbolic" onClicked={() => cli("term", `${ROOT}/scripts/ypsilon report`)} />
      </Section>
      <Section title="Session">
        <ButtonRow label="Restart shell" button="Restart" icon="view-refresh-symbolic" onClicked={() => cli("restart")} />
        <ButtonRow label="Edit config.json" sub={CONFIG_PATH} button="Open" icon="document-edit-symbolic" onClicked={() => cli("term", `${ROOT}/scripts/ypsilon config edit`)} />
      </Section>
    </box>
  )
}
