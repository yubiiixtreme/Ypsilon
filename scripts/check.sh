#!/usr/bin/env bash
# Ypsilon static checks — repo-only, no live impact. Exit 1 on any failure.
#   1. hypr conf parses under the installed Hyprland   (Hyprland --verify-config)
#   2. generated theme files are in sync with tokens.json
#   3. shell CSS parses under the installed GTK4, and every @y_* color is defined
#   4. imports resolve, strict typecheck (scripts/typecheck.sh), icon names exist
#   5. unit tests (node --test tests/)
#   6. shell scripts pass bash -n
set -uo pipefail
ROOT=$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/.." && pwd)
fail=0
ok()  { echo "OK   $1"; }
bad() { echo "FAIL $1"; fail=1; }
skip(){ echo "SKIP $1"; }

# 0. machine-specific generated files (repo path) must exist before verifying hypr
python3 "$ROOT/scripts/gen-theme.py" --paths-only >/dev/null 2>&1 || true

# 1. hyprland config
if command -v Hyprland &>/dev/null; then
  out=$(Hyprland --verify-config -c "$ROOT/hypr/ypsilon.conf" 2>&1)
  if echo "$out" | grep -q "^config ok"; then ok "hypr conf ($(Hyprland -v | head -1 | cut -c1-24))"
  else bad "hypr conf"; echo "$out" | sed -n '/Config parsing result/,$p' | sed 's/.*Ypsilon\/hypr\///' | sort -u | sed 's/^/     /'; fi
else skip "hypr conf (Hyprland not installed)"; fi

# 2. theme sync — regenerate and see whether anything changed
sig() { (cd "$ROOT" && find hypr/themes shell/style extras -path extras/current -prune -o -type f -print0 | sort -z | xargs -0 sha256sum | sha256sum); }
before=$(sig)
python3 "$ROOT/scripts/gen-theme.py" >/dev/null || bad "gen-theme.py failed"
[ "$before" = "$(sig)" ] && ok "generated files in sync with tokens.json" \
  || bad "generated files were stale — now regenerated, review 'git diff' and commit"

# 3. css
python3 - "$ROOT" <<'PY' && ok "css parses + all @y_* defined" || bad "css"
import re, sys, gi
gi.require_version("Gtk", "4.0")
from gi.repository import Gtk
root = sys.argv[1]
gen = open(f"{root}/shell/style/_generated.css").read()
base = open(f"{root}/shell/style.css").read()
errs = []
p = Gtk.CssProvider()
p.connect("parsing-error", lambda prov, sec, e: errs.append(f"line {sec.get_start_location().lines+1}: {e.message}"))
p.load_from_string(gen + "\n" + base)
defined = set(re.findall(r"@define-color\s+(\w+)", gen))
used = set(re.findall(r"@(y_\w+)", base))
errs += [f"undefined color @{u}" for u in sorted(used - defined)]
for e in errs: print("     " + e)
sys.exit(1 if errs else 0)
PY

# 4b. import audit (resolves relative imports + named exports)
if command -v node &>/dev/null; then
  out=$(node "$ROOT/scripts/check-imports.mjs" 2>&1) && ok "imports resolve" || { bad "imports"; echo "$out" | sed 's/^/     /'; }
fi

# 4c. full type-check (only if the one-time env exists: scripts/typecheck.sh --setup)
tc=$("$ROOT/scripts/typecheck.sh" 2>&1); rc=$?
[ $rc -eq 0 ] && { "$ROOT/scripts/typecheck.sh" --selftest >/dev/null 2>&1 || { rc=1; tc="typecheck selftest failed: the checker no longer catches errors"; }; }
case $rc in 0) ok "typecheck (strict, real Gtk/Gnim/AGS types; selftest ok)";; 2) skip "typecheck (run: scripts/typecheck.sh --setup)";; *) bad "typecheck"; echo "$tc" | sed 's/^/     /';; esac

# 4d. icon names exist in Adwaita
out=$("$ROOT/scripts/check-icons.sh" 2>&1); rc=$?
case $rc in 0) ok "icons exist (Adwaita)";; 2) skip "icons (Adwaita not installed)";; *) bad "icons"; echo "$out" | sed 's/^/     /';; esac

# 5. unit tests (pure logic, e.g. launcher calculator)
if command -v node &>/dev/null; then
  NODE_NO_WARNINGS=1 node --test "$ROOT/tests/" >/dev/null 2>&1 && ok "unit tests (ts)" || bad "unit tests (node --test tests/)"
else skip "unit tests (node missing)"; fi

python3 -m unittest discover -s "$ROOT/tests" >/dev/null 2>&1 && ok "unit tests (python: palette, userconf→Hyprland)" || bad "unit tests (python3 -m unittest discover -s tests)"

"$ROOT/tests/cli.test.sh" >/dev/null 2>&1 && ok "cli + supervisor tests (hermetic)" || bad "cli tests (run tests/cli.test.sh)"

# 6. shell scripts
for s in "$ROOT"/scripts/*.sh "$ROOT/scripts/ypsilon" "$ROOT"/tests/*.sh; do bash -n "$s" 2>/dev/null || bad "bash -n $(basename "$s")"; done
SC=$(command -v shellcheck || echo "$ROOT/.cache/shellcheck/shellcheck")
if [ -x "$SC" ]; then
  out=$("$SC" -S warning "$ROOT"/scripts/*.sh "$ROOT/scripts/ypsilon" "$ROOT"/tests/*.sh 2>&1) && ok "shellcheck (warnings)" || { bad "shellcheck"; echo "$out" | head -20 | sed 's/^/     /'; }
else skip "shellcheck (not installed)"; fi
[ $fail -eq 0 ] && echo "all checks passed" || echo "checks FAILED"
exit $fail
