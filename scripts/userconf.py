#!/usr/bin/env python3
"""config.json -> Hyprland/hypridle settings (hypr/generated/user.conf, hypridle.conf).

Mirrors the hypr/input/idle/reduceMotion part of shell/lib/config.ts (DEFAULTS, RANGE,
safe-string rules). tests/lib.test.ts runs `userconf.py --dump-defaults` and fails if the
two ever drift apart.
"""
import json
import os
import re
import sys

DEFAULTS = {
    "hypr": {"gapsIn": 6, "gapsOut": 12, "borderSize": 2, "rounding": 18, "blur": True, "shadows": True, "dimInactive": True},
    "input": {"kbLayout": "us", "kbVariant": "", "kbOptions": "", "naturalScroll": True, "sensitivity": 0, "repeatRate": 35, "repeatDelay": 300},
    "idle": {"dimSec": 150, "lockSec": 300, "screenOffSec": 360, "suspendSec": 1200},
    "reduceMotion": False,
}
RANGE = {
    "hypr.gapsIn": (0, 40), "hypr.gapsOut": (0, 60), "hypr.borderSize": (0, 8), "hypr.rounding": (0, 40),
    "input.sensitivity": (-1, 1), "input.repeatRate": (5, 100), "input.repeatDelay": (100, 1500),
    "idle.dimSec": (0, 86400), "idle.lockSec": (0, 86400), "idle.screenOffSec": (0, 86400), "idle.suspendSec": (0, 86400),
}
FLOAT = {"input.sensitivity"}
SAFE = {
    "input.kbLayout": r"^[a-z0-9_,-]{0,64}$",
    "input.kbVariant": r"^[a-z0-9_,-]{0,64}$",
    "input.kbOptions": r"^[a-z0-9_:,-]{0,200}$",
}


def config_path():
    base = os.environ.get("XDG_CONFIG_HOME") or os.path.join(os.path.expanduser("~"), ".config")
    return os.path.join(base, "ypsilon", "config.json")


def _merge(base, user, path):
    if isinstance(base, dict):
        u = user if isinstance(user, dict) else {}
        return {k: _merge(v, u.get(k), "%s.%s" % (path, k) if path else k) for k, v in base.items()}
    if type(user) is not type(base) and not (isinstance(base, (int, float)) and not isinstance(base, bool)
                                              and isinstance(user, (int, float)) and not isinstance(user, bool)):
        return base
    if isinstance(base, bool):
        return user
    if isinstance(base, (int, float)):
        lo, hi = RANGE.get(path, (float("-inf"), float("inf")))
        v = min(hi, max(lo, user))
        return v if path in FLOAT else int(round(v))
    if isinstance(base, str):
        pat = SAFE.get(path)
        return user if pat is None or re.match(pat, user, re.I) else base
    return user


def load(path=None):
    try:
        with open(path or config_path()) as f:
            user = json.load(f)
    except (OSError, ValueError):
        user = {}
    return _merge(DEFAULTS, user if isinstance(user, dict) else {}, "")


def _b(v):
    return "true" if v else "false"


def render_user_conf(c):
    h, i = c["hypr"], c["input"]
    lines = [
        "# GENERATED from ~/.config/ypsilon/config.json by scripts/gen-theme.py — use Settings or `ypsilon config edit`",
        "general {", "    gaps_in = %d" % h["gapsIn"], "    gaps_out = %d" % h["gapsOut"], "    border_size = %d" % h["borderSize"], "}",
        "decoration {", "    rounding = %d" % h["rounding"], "    dim_inactive = %s" % _b(h["dimInactive"]),
        "    blur {", "        enabled = %s" % _b(h["blur"]), "    }",
        "    shadow {", "        enabled = %s" % _b(h["shadows"]), "    }", "}",
        "input {", "    kb_layout = %s" % (i["kbLayout"] or "us"),
    ]
    if i["kbVariant"]:
        lines.append("    kb_variant = %s" % i["kbVariant"])
    if i["kbOptions"]:
        lines.append("    kb_options = %s" % i["kbOptions"])
    lines += [
        "    sensitivity = %s" % (("%.2f" % i["sensitivity"]).rstrip("0").rstrip(".") or "0"),
        "    repeat_rate = %d" % i["repeatRate"], "    repeat_delay = %d" % i["repeatDelay"],
        "    touchpad {", "        natural_scroll = %s" % _b(i["naturalScroll"]), "    }", "}",
    ]
    if c["reduceMotion"]:
        lines += ["animations {", "    enabled = false", "}"]
    return "\n".join(lines) + "\n"


def render_hypridle(c, root):
    d = c["idle"]
    out = [
        "# GENERATED from config.json (idle.*) by scripts/gen-theme.py. 0 disables a step.",
        "general {",
        "    lock_cmd = %s/scripts/ypsilon lock" % root,
        "    before_sleep_cmd = loginctl lock-session",
        "    after_sleep_cmd = hyprctl dispatch dpms on",
        "    ignore_dbus_inhibit = false",
        "}",
    ]
    if d["dimSec"]:
        out += ["", "listener {", "    timeout = %d" % d["dimSec"], "    on-timeout = brightnessctl -s set 20%",
                "    on-resume = brightnessctl -r", "}"]
    if d["lockSec"]:
        out += ["", "listener {", "    timeout = %d" % d["lockSec"], "    on-timeout = loginctl lock-session", "}"]
    if d["screenOffSec"]:
        out += ["", "listener {", "    timeout = %d" % d["screenOffSec"], "    on-timeout = hyprctl dispatch dpms off",
                "    on-resume = hyprctl dispatch dpms on", "}"]
    if d["suspendSec"]:
        out += ["", "listener {", "    timeout = %d" % d["suspendSec"], "    on-timeout = systemctl suspend", "}"]
    return "\n".join(out) + "\n"


if __name__ == "__main__":
    if "--dump-defaults" in sys.argv:
        print(json.dumps({"DEFAULTS": DEFAULTS, "RANGE": {k: list(v) for k, v in RANGE.items()}, "SAFE": sorted(SAFE)}))
    else:
        print(render_user_conf(load()))
