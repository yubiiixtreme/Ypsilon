#!/usr/bin/env bash
# Mutation tests for the checkers themselves: inject one known fault per checker into a
# throwaway copy of the repo and require that checker to FAIL. A gate that cannot fail
# is worse than no gate. Run: tests/checkers.test.sh   (~20s)
set -uo pipefail
ROOT=$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/.." && pwd)
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
pass=0; fail=0

fresh() { # copy repo (share the heavy typecheck cache via symlink)
  rm -rf "$T/r"; mkdir -p "$T/r"
  tar -C "$ROOT" --exclude=.git --exclude=.cache -cf - . | tar -C "$T/r" -xf -
  [ -d "$ROOT/.cache" ] && ln -s "$ROOT/.cache" "$T/r/.cache"
  python3 "$T/r/scripts/gen-theme.py" >/dev/null
}
must_fail() { # name, command...
  local name=$1; shift
  if (cd "$T/r" && "$@") >/dev/null 2>&1; then echo "FAIL: '$name' did not catch its injected fault"; fail=$((fail + 1)); else pass=$((pass + 1)); fi
}

fresh; printf 'general {\n  bogus_option = 1\n}\n' >> "$T/r/hypr/core/misc.conf"
command -v Hyprland >/dev/null && must_fail "hypr verify" bash -c 'Hyprland --verify-config -c hypr/ypsilon.conf 2>&1 | grep -q "^config ok"'

fresh; echo 'label { color: @y_nope; }' >> "$T/r/shell/style.css"
must_fail "css colors" bash -c 'scripts/check.sh 2>&1 | grep -q "^FAIL css"; [ $? -ne 0 ]'

fresh; sed -i 's/from "..\/services\/shell"/from "..\/services\/shel"/' "$T/r/shell/widgets/Bar.tsx"
must_fail "imports" node scripts/check-imports.mjs

fresh; sed -i 's/"view-app-grid-symbolic"/"no-such-icon-symbolic"/' "$T/r/shell/widgets/Bar.tsx"
[ -d /usr/share/icons/Adwaita ] && must_fail "icons" scripts/check-icons.sh

fresh; sed -i 's/createBinding(bat, "percentage")/createBinding(bat, "percentge")/' "$T/r/shell/widgets/Bar.tsx"
[ -d "$ROOT/.cache/typecheck/node_modules" ] && must_fail "typecheck" scripts/typecheck.sh

fresh; sed -i 's/return i === s.length/return i <= s.length/' "$T/r/shell/lib/calc.ts"
must_fail "ts unit tests" env NODE_NO_WARNINGS=1 node --test tests/

fresh; sed -i 's/def ensure_contrast(fg, bg, ratio):/def ensure_contrast(fg, bg, ratio):\n    return fg/' "$T/r/scripts/palette.py"
must_fail "python tests" python3 -m unittest discover -s tests

fresh; sed -i 's/\[ ${#crashes\[@\]} -ge 5 \]/[ ${#crashes[@]} -ge 50 ]/' "$T/r/scripts/shell-supervisor.sh"
must_fail "cli tests" tests/cli.test.sh

fresh; echo '{"ypsilon-dark": 1}' > /dev/null; sed -i 's/"primary": "#7c7cff"/"primary": "#7c7cfe"/' "$T/r/themes/tokens.json"
must_fail "theme sync" bash -c 'scripts/check.sh 2>&1 | grep -q "generated files were stale"; [ $? -ne 0 ]'

fresh; python3 - "$T/r/scripts/ypsilon" <<'PY'
import sys
p = sys.argv[1]; s = open(p).read()
s = s.replace("  cat <<'USAGE'", "  cat <<USAGE", 1)                      # unquote the heredoc ...
s = s.replace("ypsilon — our DE CLI", "ypsilon — our DE CLI `start`", 1)    # ... and let help text run a command
open(p, "w").write(s)
PY
must_fail "cli side-effect guard" tests/cli.test.sh

echo "checker mutation tests: $pass caught, $fail missed"
exit $fail
