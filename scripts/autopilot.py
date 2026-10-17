#!/usr/bin/env python3
"""Ypsilon autopilot: an event-driven performance governor (no polling loops).

  fullscreen window  -> game-mode visuals (no blur/shadow/animations/screen shader: the
                        compositor can direct-scan-out the app); restored when it ends
  on battery         -> blur + shadows off, power-saver profile; restored on AC

Only undoes what it applied itself: a manual `ypsilon gamemode on` is never reverted.
Wakes on Hyprland socket2 events; a 20 s sysfs read covers the (event-less) AC state.
Toggle: `ypsilon autopilot on|off|status`.
"""
import glob, json, os, selectors, socket, subprocess, sys, time

RUN = os.environ.get("XDG_RUNTIME_DIR", "/tmp")
SIG = os.environ.get("HYPRLAND_INSTANCE_SIGNATURE", "")
HYPR = f"{RUN}/hypr/{SIG}"
BATTERY_POLL = 20
DEBOUNCE = 0.15
WATCH = (b"fullscreen>>", b"closewindow>>", b"activewindowv2>>", b"workspacev2>>", b"movewindowv2>>")

# Lua config: options change via `hyprctl eval hl.config{}` (`hyprctl keyword` is rejected)
FULL = 'hl.config({ animations = { enabled = false }, decoration = { rounding = 0, screen_shader = "", blur = { enabled = false }, shadow = { enabled = false } } })'
LITE = 'hl.config({ decoration = { blur = { enabled = false }, shadow = { enabled = false } } })'


def hyprctl(*args):
    try:
        return subprocess.run(["hyprctl", *args], capture_output=True, text=True, timeout=5).stdout
    except (OSError, subprocess.SubprocessError):
        return ""


def fullscreen_active():
    """True when the focused window is fullscreen (asks Hyprland's command socket directly)."""
    try:
        with socket.socket(socket.AF_UNIX) as s:
            s.settimeout(2)
            s.connect(f"{HYPR}/.socket.sock")
            s.sendall(b"j/activewindow")
            buf = b""
            while chunk := s.recv(65536):
                buf += chunk
        return int(json.loads(buf or b"{}").get("fullscreen", 0)) > 0
    except (OSError, ValueError):
        return False


def on_battery():
    for d in glob.glob("/sys/class/power_supply/BAT*"):
        try:
            if open(f"{d}/status").read().strip() == "Discharging":
                return True
        except OSError:
            pass
    return False


def gamemode_manual():
    out = hyprctl("getoption", "animations:enabled")
    return "bool: false" in out or "int: 0" in out


class Governor:
    def __init__(self):
        self.level = None          # None | "lite" | "full"  (what we applied)
        self.prev_profile = None

    def want(self):
        if fullscreen_active():
            return "full"
        return "lite" if on_battery() else None

    def settle(self):
        want = self.want()
        if want == self.level:
            return
        if self.level is None and gamemode_manual():
            return                       # user's own game mode: hands off
        if self.level is not None:
            hyprctl("reload")            # clean slate: config re-applies every keyword
        if want:
            hyprctl("eval", FULL if want == "full" else LITE)
        self.profile(want == "lite" or (want == "full" and on_battery()))
        self.level = want

    def profile(self, saver):
        if not os.path.exists("/usr/bin/powerprofilesctl"):
            return
        if saver and self.prev_profile is None:
            cur = subprocess.run(["powerprofilesctl", "get"], capture_output=True, text=True).stdout.strip()
            if cur and cur != "power-saver":
                self.prev_profile = cur
                subprocess.run(["powerprofilesctl", "set", "power-saver"])
        elif not saver and self.prev_profile:
            subprocess.run(["powerprofilesctl", "set", self.prev_profile])
            self.prev_profile = None

    def shutdown(self):
        if self.level is not None:
            hyprctl("reload")
        self.profile(False)


def main():
    if not SIG or not os.path.exists(f"{HYPR}/.socket2.sock"):
        sys.exit("autopilot: not inside a Hyprland session")
    gov = Governor()
    ev = socket.socket(socket.AF_UNIX)
    ev.connect(f"{HYPR}/.socket2.sock")
    sel = selectors.DefaultSelector()
    sel.register(ev, selectors.EVENT_READ)
    gov.settle()
    pending = None          # debounce deadline for a burst of events
    buf = b""
    try:
        while True:
            timeout = BATTERY_POLL if pending is None else max(0, pending - time.monotonic())
            if sel.select(timeout):
                data = ev.recv(65536)
                if not data:
                    break                # compositor gone
                buf += data
                lines = buf.split(b"\n")
                buf = lines.pop()
                if any(l.startswith(WATCH) for l in lines) and pending is None:
                    pending = time.monotonic() + DEBOUNCE
            else:
                pending = None
                gov.settle()
    except KeyboardInterrupt:
        pass
    finally:
        gov.shutdown()


if __name__ == "__main__":
    import signal
    signal.signal(signal.SIGTERM, lambda *_: (_ for _ in ()).throw(KeyboardInterrupt()))
    main()
