import Gtk from "gi://Gtk"
import { createComputed, createState, For } from "ags"
import { readFile } from "ags/file"
import { ROOT } from "../services/theme"
import { filterBinds, groupBinds, parseBinds, type Bind } from "../lib/keys"
import Popup from "./Popup"

// Keybind cheat-sheet, parsed live from hypr/core/keybinds.lua. Toggle: SUPER+K or SUPER+/.
// Type to filter (matches "Super + Space launcher", "vim", "workspace", ...).
export default function Cheatsheet() {
  const [groups, setGroups] = createState<[string, Bind[]][]>([])
  const [query, setQuery] = createState("")
  const filtered = createComputed(() => filterBinds(groups(), query()))
  const load = () => {
    try {
      setGroups(groupBinds(parseBinds(readFile(`${ROOT}/hypr/core/keybinds.lua`))))
    } catch (e) {
      print(`ypsilon cheatsheet: ${e}`)
    }
  }
  return (
    <Popup name="ypsilon-cheatsheet" spacing={10} onShow={() => { load(); setQuery("") }}>
      <label class="title" label="Keyboard shortcuts" halign={Gtk.Align.START} />
      <entry
        class="search"
        primaryIconName="system-search-symbolic"
        placeholderText="Search shortcuts…"
        text={query}
        onNotifyText={({ text }) => setQuery(text)}
      />
      <scrolledwindow hscrollbarPolicy={Gtk.PolicyType.NEVER} propagateNaturalHeight maxContentHeight={520}>
        <box orientation={Gtk.Orientation.VERTICAL} spacing={12} class="cheat">
          <For each={filtered}>
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
