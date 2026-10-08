#!/usr/bin/env python3
"""`ypsilon plugin …` helpers that work without the shell running.

  list                  every plugin found (bundled + ~/.config/ypsilon/plugins), enabled state
  enable ID / disable ID   edit plugins.enabled in config.json (the running shell reacts live)
  new ID                scaffold ~/.config/ypsilon/plugins/ID with a typed, working example
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CFG_DIR = os.path.join(os.environ.get("XDG_CONFIG_HOME") or os.path.expanduser("~/.config"), "ypsilon")
CFG = os.path.join(CFG_DIR, "config.json")
DIRS = [(os.path.join(ROOT, "plugins"), "bundled"), (os.path.join(CFG_DIR, "plugins"), "user")]


def read_cfg():
    try:
        with open(CFG) as f:
            data = json.load(f)
        return data if isinstance(data, dict) else {}
    except FileNotFoundError:
        return {}
    except ValueError:
        sys.exit("config.json is not valid JSON — fix it first (ypsilon config check)")


def write_cfg(data):
    os.makedirs(CFG_DIR, exist_ok=True)
    tmp = CFG + ".tmp"
    with open(tmp, "w") as f:
        json.dump(data, f, indent=2)
        f.write("\n")
    os.replace(tmp, CFG)  # atomic: the shell never sees a half-written file


def found():
    out = {}
    for base, source in DIRS:
        if not os.path.isdir(base):
            continue
        for pid in sorted(os.listdir(base)):
            mf = os.path.join(base, pid, "plugin.json")
            if os.path.isfile(mf):
                try:
                    with open(mf) as f:
                        out[pid] = (source, json.load(f))
                except ValueError as e:
                    out[pid] = (source, {"name": "?", "version": "?", "description": "invalid plugin.json: %s" % e})
    return out


def enabled_list(cfg):
    p = cfg.get("plugins") if isinstance(cfg.get("plugins"), dict) else {}
    return [x for x in p.get("enabled", []) if isinstance(x, str)]


def set_enabled(pid, on):
    plugins = found()
    if on and pid not in plugins:
        sys.exit("no plugin '%s' (see: ypsilon plugin list)" % pid)
    cfg = read_cfg()
    lst = [x for x in enabled_list(cfg) if x != pid] + ([pid] if on else [])
    cfg.setdefault("plugins", {}) if isinstance(cfg.get("plugins"), dict) else cfg.__setitem__("plugins", {})
    cfg["plugins"]["enabled"] = lst
    write_cfg(cfg)
    print("%s %s" % ("enabled" if on else "disabled", pid))


TEMPLATE_JSON = {
    "id": "", "name": "", "version": "0.1.0", "description": "My Ypsilon plugin", "apiVersion": 1,
    "permissions": [], "settings": [{"key": "greeting", "label": "Greeting", "type": "string", "default": "hello"}],
}

TEMPLATE_JS = '''// @ts-check
// Ypsilon plugin. Docs: %(root)s/docs/PLUGINS.md
// Enable: ypsilon plugin enable %(id)s    Logs: ypsilon logs
/** @param {import("%(root)s/shell/lib/plugin-types").PluginApi} api */
export default function main(api) {
  const [clicks, setClicks] = api.state(api.storage.get("clicks", 0))

  // a bar widget
  api.bar.add({
    position: "right",
    widget: () =>
      api.h("button", {
        class: "pill-btn",
        label: api.computed(() => `${api.settings().greeting} · ${clicks()}`),
        onClicked: () => {
          setClicks(clicks.peek() + 1)
          api.storage.set("clicks", clicks.peek())
        },
      }),
  })

  // a launcher mode: type "%(id)s " in the launcher
  api.launcher.addProvider({
    name: "%(id)s",
    prefix: "%(id)s ",
    search: (q) => [{ title: `say "${q || "hi"}"`, icon: "dialog-information-symbolic", run: () => api.notify("%(id)s", q || "hi") }],
  })

  // a CLI command: ypsilon plugin run %(id)s count
  api.commands.add("count", () => String(clicks.peek()))
}
'''


def new(pid):
    if not re.match(r"^[a-z0-9][a-z0-9-]{1,39}$", pid):
        sys.exit("plugin id must be lowercase letters, digits and dashes (2-40 chars)")
    d = os.path.join(CFG_DIR, "plugins", pid)
    if os.path.exists(d):
        sys.exit("%s already exists" % d)
    os.makedirs(d)
    m = dict(TEMPLATE_JSON, id=pid, name=pid.replace("-", " ").title())
    with open(os.path.join(d, "plugin.json"), "w") as f:
        json.dump(m, f, indent=2)
        f.write("\n")
    with open(os.path.join(d, "index.js"), "w") as f:
        f.write(TEMPLATE_JS % {"root": ROOT, "id": pid})
    print("created %s\nnext: ypsilon plugin enable %s" % (d, pid))


def main(argv):
    cmd = argv[0] if argv else "list"
    if cmd == "list":
        en = set(enabled_list(read_cfg()))
        for pid, (src, m) in found().items():
            print("%s %-14s %-8s %-7s %s" % ("●" if pid in en else "○", pid, m.get("version", "?"), src, m.get("description", "")))
        return 0
    if cmd in ("enable", "disable") and len(argv) > 1:
        set_enabled(argv[1], cmd == "enable")
        return 0
    if cmd == "new" and len(argv) > 1:
        new(argv[1])
        return 0
    print(__doc__)
    return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
