#!/usr/bin/env python3
"""`ypsilon status` — one-glance card: resources, screen/sound, session toggles.

Read-only and stdlib-only: /proc + /sys directly, a handful of quick probes (hyprctl, wpctl,
nmcli, ags) run in parallel while the CPU is sampled. Colors only on a TTY without NO_COLOR;
plain ANSI so it follows the Ypsilon-themed terminal palette.

  status.py            card
  status.py --json     machine-readable (bars, scripts)
  status.py --watch [SECS]   live refresh (Ctrl+C to quit)
"""
import glob
import json
import os
import re
import shutil
import socket
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.realpath(__file__)))
UI = sys.stdout.isatty() and not os.environ.get("NO_COLOR") and os.environ.get("TERM", "dumb") != "dumb"
STYLE = {"primary": "34", "accent": "36", "good": "32", "warn": "33", "bad": "31", "dim": "2", "bold": "1"}


# ---------------------------------------------------------------- probes (never raise)
def run(*argv, timeout=1.5):
    try:
        r = subprocess.run(argv, capture_output=True, text=True, timeout=timeout)
        return r.stdout.strip() if r.returncode == 0 else None
    except (OSError, subprocess.SubprocessError):
        return None


def read(path, default=None):
    try:
        with open(path) as f:
            return f.read().strip()
    except OSError:
        return default


def cpu_times():
    v = [int(x) for x in read("/proc/stat", "cpu 0 0 0 0").split("\n")[0].split()[1:]]
    idle = v[3] + (v[4] if len(v) > 4 else 0)
    return sum(v), idle


def meminfo():
    m = {}
    for line in read("/proc/meminfo", "").splitlines():
        k, _, rest = line.partition(":")
        m[k] = int(rest.split()[0]) * 1024 if rest.split() else 0
    return m


def temperature():
    best = None
    for d in glob.glob("/sys/class/hwmon/hwmon*"):
        if read(f"{d}/name") in ("coretemp", "k10temp", "zenpower", "cpu_thermal", "acpitz"):
            for f in glob.glob(f"{d}/temp*_input"):
                v = read(f)
                if v and v.lstrip("-").isdigit():
                    best = max(best or 0, int(v) / 1000)
    return round(best) if best else None


def battery():
    for d in sorted(glob.glob("/sys/class/power_supply/BAT*")):
        cap = read(f"{d}/capacity")
        if cap and cap.isdigit():
            return {"percent": int(cap), "state": (read(f"{d}/status") or "").lower()}
    return None


def backlight():
    for d in glob.glob("/sys/class/backlight/*"):
        cur, mx = read(f"{d}/brightness"), read(f"{d}/max_brightness")
        if cur and mx and mx.isdigit() and int(mx) > 0:
            return round(int(cur) * 100 / int(mx))
    return None


def in_hyprland():
    return bool(os.environ.get("HYPRLAND_INSTANCE_SIGNATURE"))


def sunset(key):
    out = run("hyprctl", "hyprsunset", key) if in_hyprland() else None
    return round(float(out)) if out and re.fullmatch(r"\d+(\.\d+)?", out) else None


def hypr_version():
    out = run("hyprctl", "version") if in_hyprland() else None
    m = re.search(r"Hyprland ([\d.]+)", out or "")
    return m.group(1) if m else None


def gamemode():
    out = run("hyprctl", "getoption", "animations:enabled") if in_hyprland() else None
    m = re.search(r"int: (\d+)", out or "")
    return None if not m else m.group(1) == "0"


def sound():
    vol = run("wpctl", "get-volume", "@DEFAULT_AUDIO_SINK@")
    m = re.search(r"([\d.]+)", vol or "")
    if not m:
        return None
    name = None
    status = run("wpctl", "status") or ""
    sinks = status.split("Sinks:", 1)[1].split("Sources:", 1)[0] if "Sinks:" in status else ""
    for line in sinks.splitlines():
        if "*" in line:
            name = re.sub(r"\s*\[vol:.*", "", re.sub(r"^[^\d]*\d+\.\s*", "", line)).strip()
            # shortDeviceName (shell/lib/audio.ts): keep the port after "Controller"
            name = re.sub(r"^.*\bController\s+", "", name)
            name = re.sub(r"\s*\((?:Stereo|Mono|Surround[^)]*)\)\s*$|\s+Output$", "", name).strip()
    return {"percent": round(float(m.group(1)) * 100), "muted": "MUTED" in vol, "output": name}


def network():
    out = run("nmcli", "-t", "-f", "TYPE,STATE,CONNECTION", "dev") or ""
    for line in out.splitlines():
        typ, state, conn = (line.split(":", 2) + ["", ""])[:3]
        if typ in ("wifi", "ethernet") and state == "connected":
            return {"type": typ, "name": conn}
    return None


def shell_health():
    out = run("ags", "request", "-i", "ypsilon", "health", timeout=1.0)
    return out.splitlines()[0] if out else None


def active_theme():
    try:
        return json.load(open(f"{ROOT}/themes/tokens.json")).get("active")
    except (OSError, ValueError):
        return None


def collect():
    probes = {
        "hyprland": hypr_version, "gamma": lambda: sunset("gamma"), "temperature_k": lambda: sunset("temperature"),
        "gamemode": gamemode, "sound": sound, "network": network, "shell": shell_health,
        "caffeine": lambda: None if not shutil.which("pgrep") else run("pgrep", "-x", "hypridle") is None,
    }
    with ThreadPoolExecutor(max_workers=len(probes)) as pool:
        futures = {k: pool.submit(f) for k, f in probes.items()}
        t0, i0 = cpu_times()
        time.sleep(0.25)
        t1, i1 = cpu_times()
        d = {k: f.result() for k, f in futures.items()}
    m = meminfo()
    total, avail = m.get("MemTotal", 0), m.get("MemAvailable", 0)
    st, sf = m.get("SwapTotal", 0), m.get("SwapFree", 0)
    disk = shutil.disk_usage("/")
    up = float((read("/proc/uptime", "0") or "0").split()[0])
    d.update({
        "host": socket.gethostname(), "user": os.environ.get("USER", ""), "uptime_s": int(up),
        "theme": active_theme(),
        "cpu": round(100 * (1 - (i1 - i0) / (t1 - t0))) if t1 > t0 else 0,
        "load": [round(x, 2) for x in os.getloadavg()],
        "mem": {"used": total - avail, "total": total}, "swap": {"used": st - sf, "total": st},
        "disk": {"used": disk.used, "total": disk.total, "free": disk.free},
        "temp_c": temperature(), "battery": battery(), "brightness": backlight(),
    })
    if d["gamma"] is None and d["hyprland"]:
        d["gamma"] = 100  # no hyprsunset answering = neutral screen
    d["nightlight"] = d["temperature_k"] is not None and d["temperature_k"] < 6000
    return d


# ---------------------------------------------------------------- rendering
def paint(style, text):
    return f"\033[{STYLE[style]}m{text}\033[0m" if UI and style else text


class Line:
    """A row of styled segments; width counts only visible characters."""

    def __init__(self):
        self.parts = []

    def add(self, text, style=None):
        self.parts.append((str(text), style))
        return self

    def width(self):
        return sum(len(t) for t, _ in self.parts)

    def render(self):
        return "".join(paint(s, t) for t, s in self.parts)

    def fit(self, width):
        """cut to `width` visible characters (ending in …)"""
        if self.width() <= width:
            return self
        out, left = Line(), width - 1
        for t, st in self.parts:
            if left <= 0:
                break
            out.add(t[:left], st)
            left -= len(t[:left])
        return out.add("…", "dim")


def gib(n):
    return f"{n / 2**30:.1f}G"


def human_uptime(s):
    d, h, m = s // 86400, s % 86400 // 3600, s % 3600 // 60
    return (f"{d}d " if d else "") + (f"{h}h " if h or d else "") + f"{m}m"


def level(pct, warn, bad, reverse=False):
    if pct is None:
        return "dim"
    hot = (pct <= bad, pct <= warn) if reverse else (pct >= bad, pct >= warn)
    return "bad" if hot[0] else "warn" if hot[1] else "primary"


def bar(pct, width, style):
    pct = max(0, min(100, pct or 0))
    n = round(pct * width / 100)
    on, off = ("━", "─") if UI else ("#", "-")
    return [(on * n, style), (off * (width - n), "dim")]


NOTE_W = 18


def meter_row(label, pct, value, note, style, bw):
    ln = Line().add(f"{label:<6}", "dim")
    for t, s in bar(pct, bw, style):
        ln.add(t, s)
    note = note if len(note or "") <= NOTE_W else note[: NOTE_W - 1] + "…"
    return ln.add(f" {value:>5}", "bold").add(f"  {note}" if note else "", "dim")


def dot(on, label):
    if on is None:
        return [("○ ", "dim"), (label, "dim")]
    return [("● " if on else "○ ", "good" if on else "dim"), (label, None if on else "dim")]


def card(d, cols):
    w = max(44, min(cols - 4, 64))          # inner width
    bw = w - 6 - 6 - 2 - NOTE_W             # bar width: label, value, gap, note
    rows = []

    head = Line().add(f"up {human_uptime(d['uptime_s'])}", "dim")
    if d["hyprland"]:
        head.add(f" · Hyprland {d['hyprland']}", "dim")
    if d["theme"]:
        head.add(" · theme ", "dim").add(d["theme"].replace("ypsilon-", ""), "accent")
    rows += [head, None]

    m, sw, dk = d["mem"], d["swap"], d["disk"]
    pm = round(100 * m["used"] / m["total"]) if m["total"] else 0
    rows.append(meter_row("cpu", d["cpu"], f"{d['cpu']}%", f"load {d['load'][0]}", level(d["cpu"], 70, 90), bw))
    rows.append(meter_row("mem", pm, f"{pm}%", f"{gib(m['used'])}/{gib(m['total'])}", level(pm, 80, 92), bw))
    if sw["total"]:
        ps = round(100 * sw["used"] / sw["total"])
        rows.append(meter_row("swap", ps, f"{ps}%", f"{gib(sw['used'])}/{gib(sw['total'])}", level(ps, 50, 80), bw))
    pd = round(100 * dk["used"] / dk["total"]) if dk["total"] else 0
    rows.append(meter_row("disk", pd, f"{pd}%", f"/ · {gib(dk['free'])} free", level(pd, 85, 95), bw))
    if d["temp_c"] is not None:
        rows.append(meter_row("temp", d["temp_c"], f"{d['temp_c']}°C", "cpu", level(d["temp_c"], 70, 85), bw))
    if d["battery"]:
        b = d["battery"]
        rows.append(meter_row("power", b["percent"], f"{b['percent']}%", b["state"], level(b["percent"], 20, 8, True), bw))
    rows.append(None)

    if d["brightness"] is not None:
        rows.append(meter_row("light", d["brightness"], f"{d['brightness']}%", "backlight", "primary", bw))
    if d["gamma"] is not None:
        g = d["gamma"]
        note = f"night {d['temperature_k']}K" if d["nightlight"] else "night light off"
        rows.append(meter_row("gamma", min(g, 100), f"{g}%", note, "accent" if g != 100 else "primary", bw))
    s = d["sound"]
    if s:
        rows.append(meter_row("sound", 0 if s["muted"] else s["percent"], "mute" if s["muted"] else f"{s['percent']}%",
                              s["output"] or "", "dim" if s["muted"] else "primary", bw))
    rows.append(None)

    net = d["network"]
    line = Line()
    for part in [dot(d["shell"] is not None and d["shell"].startswith("ok"), "shell"),
                 dot(net is not None, net["name"][:20] if net else "offline"),
                 dot(d["gamemode"], "game mode"), dot(d["caffeine"], "caffeine")]:
        item_w = sum(len(t) for t, _ in part)
        if line.parts and line.width() + 3 + item_w > w:   # wrap instead of overflowing the card
            rows.append(line)
            line = Line()
        if line.parts:
            line.add("   ")
        for t, st in part:
            line.add(t, st)
    rows.append(line)

    title = Line().add("─ ", "dim").add("✦ ", "primary").add("ypsilon", "bold").add(" ", None)
    who = f" {d['user']}@{d['host']} " if d["user"] else f" {d['host']} "
    fill = w - title.width() - len(who)
    out = [paint("dim", "╭") + title.render() + paint("dim", "─" * max(fill, 1)) + paint("dim", who) + paint("dim", "─╮")]
    for r in rows:
        if r is None:
            out.append(paint("dim", "├" + "─" * (w + 2) + "┤"))
        else:
            r = r.fit(w)
            pad = max(0, w - r.width())
            out.append(paint("dim", "│ ") + r.render() + " " * pad + paint("dim", " │"))
    out.append(paint("dim", "╰" + "─" * (w + 2) + "╯"))
    return "\n".join(out)


def main(argv):
    if "-h" in argv or "--help" in argv:
        print(__doc__.strip())
        return 0
    if "--json" in argv:
        print(json.dumps(collect(), indent=2))
        return 0
    cols = shutil.get_terminal_size((72, 24)).columns
    if "--watch" in argv or "-w" in argv:
        i = argv.index("--watch" if "--watch" in argv else "-w")
        every = float(argv[i + 1]) if i + 1 < len(argv) and re.fullmatch(r"\d+(\.\d+)?", argv[i + 1]) else 2.0
        try:
            while True:
                text = card(collect(), shutil.get_terminal_size((72, 24)).columns)
                sys.stdout.write("\033[H\033[2J" + text + "\n" + paint("dim", f"  every {every:g}s · Ctrl+C to quit") + "\n")
                sys.stdout.flush()
                time.sleep(max(0.5, every - 0.25))
        except KeyboardInterrupt:
            return 0
    print(card(collect(), cols))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
