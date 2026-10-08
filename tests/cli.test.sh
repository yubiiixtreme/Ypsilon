#!/usr/bin/env bash
# CLI + supervisor smoke tests. Hermetic: fake HOME/XDG dirs, fake `ags`/`notify-send` on PATH,
# never touches the live session. Run: tests/cli.test.sh
set -uo pipefail
ROOT=$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/.." && pwd)
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
export HOME=$T/home XDG_RUNTIME_DIR=$T/run XDG_CONFIG_HOME=$T/home/.config XDG_CACHE_HOME=$T/home/.cache
# sever every channel to the live desktop: even a buggy command cannot reach your session
unset HYPRLAND_INSTANCE_SIGNATURE WAYLAND_DISPLAY DISPLAY SWAYSOCK
export DBUS_SESSION_BUS_ADDRESS=unix:path=$T/no-such-bus
mkdir -p "$HOME" "$XDG_RUNTIME_DIR" "$T/bin"
fail=0; pass=0
ok() { pass=$((pass + 1)); }
no() { echo "FAIL: $1"; fail=$((fail + 1)); }
expect() { local name=$1 pattern=$2; shift 2; local out; out=$("$@" 2>&1); if echo "$out" | grep -qE "$pattern"; then ok; else no "$name — got: $(echo "$out" | head -3)"; fi; }

cat > "$T/bin/notify-send" <<SH
#!/usr/bin/env bash
echo "\$*" >> "$T/notifications"
SH
chmod +x "$T/bin/notify-send"
export PATH="$T/bin:$PATH"
Y="$ROOT/scripts/ypsilon"

# --- read-only commands must have NO side effects (regression: an unquoted heredoc once ran `start`) ---
for c in help frobnicate "theme list" "wallpaper list" "config path"; do
  # shellcheck disable=SC2086
  "$Y" $c >/dev/null 2>&1
done
if [ -z "$(find "$HOME" "$XDG_RUNTIME_DIR" -mindepth 1 2>/dev/null | head -1)" ]; then ok; else no "read-only commands created: $(find "$HOME" "$XDG_RUNTIME_DIR" -mindepth 1 | head -3 | tr '\n' ' ')"; fi
[ ! -s "$T/notifications" ] && ok || no "read-only commands sent notifications: $(head -2 "$T/notifications")"

# --- CLI basics ---
expect "help"            "ypsilon — our DE CLI"          "$Y" help
expect "unknown command" "unknown: frobnicate"           "$Y" frobnicate
expect "theme list"      "ypsilon-dark"                  "$Y" theme list
expect "bad theme"       "unknown theme: nope"           "$Y" theme set nope
expect "wallpaper list"  "ypsilon-neon"                  "$Y" wallpaper list
expect "config path"     "$T/home/.config/ypsilon/config.json" "$Y" config path
expect "config check (none)" "all defaults"              "$Y" config check
expect "config init"     "created:"                      "$Y" config init
expect "config check ok" "config ok"                     "$Y" config check
echo '{"workspace": 3}' > "$XDG_CONFIG_HOME/ypsilon/config.json"
expect "config typo"     'did you mean "workspaces"'     "$Y" config check
expect "doctor runs"     "doctor: (all good|[0-9]+ thing)" "$Y" doctor
expect "plugin list"     "pomodoro.*bundled"           "$Y" plugin list
expect "plugin enable"   "enabled pomodoro"            "$Y" plugin enable pomodoro
expect "plugin enabled"  "● pomodoro"                  "$Y" plugin list
expect "plugin unknown"  "no plugin 'nope'"            "$Y" plugin enable nope
expect "plugin disable"  "disabled pomodoro"           "$Y" plugin disable pomodoro
expect "plugin new"      "created .*/plugins/my-thing" "$Y" plugin new my-thing
expect "plugin new dup"  "already exists"              "$Y" plugin new my-thing
expect "plugin bad id"   "lowercase"                   "$Y" plugin new "Bad Id"
expect "config kept"     "config ok|problem"           "$Y" config check
expect "settings offline" "shell not running"          "$Y" settings updates
expect "updates usage"   "usage: ypsilon updates run"  "$Y" updates bogus
expect "toggle usage"    "usage: ypsilon toggle"         "$Y" toggle
expect "record usage"    "usage: record.sh"              "$ROOT/scripts/record.sh" bogus

# --- installers refuse piped stdin (regression: `yes | install.sh` looped on a numeric prompt
#     and filled a RAM-backed /tmp with a 2.8 GB log); they must exit before any sudo/pacman ---
for sc in install-deps.sh install.sh recover.sh; do
  out=$(yes | timeout 5 "$ROOT/scripts/$sc" 2>&1); rc=$?
  [ "$rc" = 2 ] && echo "$out" | grep -q "terminal" && ok || no "$sc must refuse piped stdin (rc=$rc: $(echo "$out" | head -1))"
done
expect "install bad flag" "unknown option" "$ROOT/scripts/install.sh" --frobnicate

# --- supervisor: crash loop stops after 5 crashes, with a notification ---
cat > "$T/bin/ags" <<'SH'
#!/usr/bin/env bash
echo run >> "$CRASHLOG"; exit 3
SH
chmod +x "$T/bin/ags"
export CRASHLOG=$T/crashes
YPSILON_SKIP_PREFLIGHT=1 YPSILON_RESTART_DELAY=0 timeout 20 "$ROOT/scripts/shell-supervisor.sh" >/dev/null 2>&1
rc=$?
[ "$rc" = 1 ] && ok || no "supervisor should give up with rc=1 (got $rc)"
[ "$(wc -l < "$CRASHLOG")" = 5 ] && ok || no "supervisor should try exactly 5 times (got $(wc -l < "$CRASHLOG"))"
grep -q "keeps crashing" "$T/notifications" && ok || no "supervisor should notify about the crash loop"

# --- supervisor: clean quit is not restarted ---
printf '#!/usr/bin/env bash\necho run >> "$CRASHLOG"; exit 0\n' > "$T/bin/ags"
: > "$CRASHLOG"
YPSILON_SKIP_PREFLIGHT=1 YPSILON_RESTART_DELAY=0 timeout 10 "$ROOT/scripts/shell-supervisor.sh" >/dev/null 2>&1
[ $? = 0 ] && [ "$(wc -l < "$CRASHLOG")" = 1 ] && ok || no "clean exit must not restart"

# --- supervisor: preflight names what is missing ---
if python3 -c 'import gi' 2>/dev/null; then
  : > "$T/notifications"
  timeout 10 "$ROOT/scripts/shell-supervisor.sh" >/dev/null 2>&1
  grep -q "cannot start.*missing:.*Astal" "$T/notifications" && ok || no "preflight should list missing Astal libs (or they are all installed)"
fi

# --- start: idempotent (Hyprland reloads / double exec-once must not duplicate daemons) ---
for b in hypridle awww-daemon; do printf '#!/usr/bin/env bash\nexec sleep 30\n' > "$T/bin/$b"; chmod +x "$T/bin/$b"; done
# fake ags: `ags run` blocks like the real shell; quit/request/toggle return at once (no instance)
printf '#!/usr/bin/env bash\n[ "$1" = run ] && exec sleep 30\nexit 1\n' > "$T/bin/ags"; chmod +x "$T/bin/ags"
printf '#!/usr/bin/env bash\nexit 0\n' > "$T/bin/awww"; chmod +x "$T/bin/awww"
printf '#!/usr/bin/env bash\nexit 0\n' > "$T/bin/hyprctl"; chmod +x "$T/bin/hyprctl"
export WAYLAND_DISPLAY=ypsilon-test-$$ YPSILON_SKIP_PREFLIGHT=1
"$Y" start >/dev/null 2>&1; sleep 0.3
pidf="$XDG_RUNTIME_DIR/ypsilon/$WAYLAND_DISPLAY.hypridle.pid"
first=$(cat "$pidf" 2>/dev/null)
"$Y" start >/dev/null 2>&1; sleep 0.3
second=$(cat "$pidf" 2>/dev/null)
[ -n "$first" ] && [ "$first" = "$second" ] && kill -0 "$first" 2>/dev/null && ok || no "start twice must keep exactly one hypridle (pid $first vs $second)"
[ -f "$XDG_CONFIG_HOME/ypsilon/.welcomed" ] && ok || no "first start should mark welcome"
[ -f "$XDG_CONFIG_HOME/ypsilon/config.json" ] && ok || no "first start should create config.json"
expect "stop"            "stopped hypridle"            "$Y" stop
sleep 0.3
kill -0 "$first" 2>/dev/null && no "stop must end the daemons" || ok
ls "$XDG_RUNTIME_DIR"/ypsilon/*.pid >/dev/null 2>&1 && no "stop must remove pid files" || ok

echo "cli tests: $pass passed, $fail failed"
exit $fail
