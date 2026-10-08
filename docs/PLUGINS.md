# Writing Ypsilon plugins

Plugins are plain ES modules loaded at runtime — no build step, no shell rebuild.
They get a typed API (`shell/lib/plugin-types.ts`) and can add **bar widgets**, **launcher
modes**, **control-center tiles**, **CLI commands**, **settings** (auto-rendered in
Settings → Plugins) and **persistent storage**.

```bash
ypsilon plugin new my-plugin      # scaffold ~/.config/ypsilon/plugins/my-plugin (working example)
ypsilon plugin enable my-plugin   # the running shell loads it immediately
ypsilon logs                      # print()/api.log output and errors
ypsilon plugin run my-plugin count   # call a command your plugin registered
```

> Plugins run with your user's permissions (like any program you start). Only enable
> plugins you trust; Settings → Plugins shows each plugin's declared `permissions`.

## Layout

```
~/.config/ypsilon/plugins/<id>/     yours (same id overrides a bundled plugin)
<repo>/plugins/<id>/                bundled: pomodoro, quicklinks, dev-ports
  plugin.json                       manifest (validated; errors shown in Settings)
  index.js                          entry: `export default function main(api) { … }`
```

### plugin.json

```json
{
  "id": "my-plugin",                 // = directory name, lowercase/digits/dashes
  "name": "My plugin",
  "version": "1.0.0",                // semver
  "description": "What it does",
  "apiVersion": 1,
  "entry": "index.js",               // optional, relative .js path
  "permissions": ["exec", "network"],// informational: exec network files notifications clipboard
  "settings": [
    { "key": "minutes", "label": "Minutes", "type": "number", "default": 25, "min": 1, "max": 120 },
    { "key": "sound", "label": "Play sound", "type": "boolean", "default": true },
    { "key": "mode", "label": "Mode", "type": "enum", "default": "a", "options": ["a", "b"] },
    { "key": "url", "label": "URL", "type": "string", "default": "", "placeholder": "https://…" }
  ]
}
```

Values live in `config.json → plugins.settings.<id>` and are always validated against this
schema before your plugin sees them (`api.settings`).

## The API

```js
// @ts-check   ← editor completion + `scripts/typecheck.sh` checks your plugin against the API
/** @param {import("<repo>/shell/lib/plugin-types").PluginApi} api */
export default function main(api) {
  // reactivity — the shell's own Gnim instance
  const [n, setN] = api.state(0)
  const label = api.computed(() => `clicked ${n()}×`)
  const load = api.poll(0, 5000, async () => Number(await api.exec(["cat", "/proc/loadavg"]).then((s) => s.split(" ")[0])))

  // widgets: h(type, props, ...children); any intrinsic (box, button, label, image, slider, …) or Gtk class
  api.bar.add({
    position: "right",               // left | center | right
    order: 0,
    widget: () => api.h("button", { class: "pill-btn", label, onClicked: () => setN(n.peek() + 1) }),
  })

  // launcher: rows appear when the query starts with `prefix` (omit prefix to join normal search)
  api.launcher.addProvider({
    name: "my plugin",
    prefix: "my ",
    search: (q) => [{ title: `echo ${q}`, sub: "notify", icon: "dialog-information-symbolic", run: () => api.notify("my plugin", q) }],
  })

  // control-center tile
  api.controlCenter.addTile({ icon: "alarm-symbolic", title: "Load", sub: api.computed(() => String(load())), onClick: () => {} })

  // CLI: ypsilon plugin run my-plugin reset
  api.commands.add("reset", () => (setN(0), "reset"))

  // storage survives restarts (~/.local/state/ypsilon/plugins/<id>.json)
  api.storage.set("lastRun", Date.now())

  // cleanup: everything registered above is removed automatically on disable;
  // add your own (timers, processes) here or return a function from main()
  const t = setInterval(() => {}, 1000)
  api.onCleanup(() => clearInterval(t))
}
```

Other members: `api.bind(obj, "prop")` (GObject property → accessor), `api.effect(fn)`,
`api.exec(cmd)`, `api.open(uriOrPath)`, `api.log(...)`, `api.setSetting(key, value)`,
`api.id`, `api.dir`, `api.manifest`.

Launcher `search` is synchronous: keep async data in your own state/cache and return from
it (see `plugins/dev-ports`).

## Isolation guarantees

- a plugin that throws while loading is marked **error** (Settings shows the message); the shell keeps running
- a bar widget, tile or launcher provider that throws only drops itself
- disabling a plugin removes all its contributions and runs its cleanups — no restart needed

## Testing your plugin

Put pure logic in its own module (no `api` use) and test it with `node --test`, like the
bundled plugins do (`tests/plugins.test.mjs`). Bundled plugins are also type-checked
against the API by `scripts/typecheck.sh`.
