import Gtk from "gi://Gtk"
import { createState, For } from "ags"
import { readFile } from "ags/file"
import { ROOT } from "../services/theme"
import { parseBinds, groupBinds, type Bind } from "../lib/keys"
import Popup from "./Popup"

// Keybind cheat-sheet, parsed live from hypr/core/keybinds.conf. Toggle: SUPER+/.
export default function Cheatsheet() {
  const [groups, setGroups] = createState<[string, Bind[]][]>([])
  const load = () => {
    try {
      setGroups(groupBinds(parseBinds(readFile(`${ROOT}/hypr/core/keybinds.conf`))))
    } catch (e) {
      print(`ypsilon cheatsheet: ${e}`)
    }
  }
  return (
    <Popup name="ypsilon-cheatsheet" spacing={10} onShow={load}>
      <label class="title" label="Keyboard shortcuts" halign={Gtk.Align.START} />
      <scrolledwindow hscrollbarPolicy={Gtk.PolicyType.NEVER} propagateNaturalHeight maxContentHeight={520}>
        <box orientation={Gtk.Orientation.VERTICAL} spacing={12} class="cheat">
          <For each={groups}>
            {([name, binds]) => (
              <box orientation={Gtk.Orientation.VERTICAL} spacing={3}>
                <label class="accent" label={name} halign={Gtk.Align.START} />
                {binds.map((b) => (
                  <box spacing={12}>
                    <label class="kbd" label={b.combo} halign={Gtk.Align.START} widthChars={26} xalign={0} />
                    <label class="sub" label={b.action} halign={Gtk.Align.START} hexpand xalign={0} />
                  </box>
                ))}
              </box>
            )}
          </For>
        </box>
      </scrolledwindow>
    </Popup>
  )
}
