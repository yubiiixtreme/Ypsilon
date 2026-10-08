#!/usr/bin/env bash
# Full TypeScript type-check of the shell WITHOUT installing AGS/Astal system-wide.
#   scripts/typecheck.sh --setup   one-time: npm deps + AGS 3.1.2 lib source -> .cache/typecheck (gitignored)
#   scripts/typecheck.sh           run tsc (strict) and report errors in shell/ only
# Gtk/GLib/Gnim types are the real published ones; Astal types are tools/typecheck/astal.d.ts,
# hand-written from the Astal sources (Astal's GIR types are not published on npm).
set -euo pipefail
ROOT=$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/.." && pwd)
C=$ROOT/.cache/typecheck   # inside the repo, gitignored
AGS_TAG=${AGS_TAG:-v3.1.2}

setup() {
  mkdir -p "$C" && cd "$C"
  [ -f package.json ] || npm init -y >/dev/null
  npm i --no-audit --no-fund typescript@5.9 gnim@1.9.1 \
    @girs/gjs @girs/gtk-4.0 @girs/gdk-4.0 @girs/gio-2.0 @girs/glib-2.0 @girs/gobject-2.0 @girs/graphene-1.0 >/dev/null
  rm -rf vendor/ags-src && mkdir -p vendor
  git clone -q --depth 1 --branch "$AGS_TAG" https://github.com/Aylur/ags.git vendor/ags-src 2>/dev/null \
    || git clone -q --depth 1 https://github.com/Aylur/ags.git vendor/ags-src
  echo "typecheck env ready: $C"
}

run() {
  [ -d "$C/node_modules/typescript" ] && [ -d "$C/vendor/ags-src/lib" ] || { echo "not set up — run: $0 --setup"; exit 2; }
  local A="$C/vendor/ags-src/lib" N="$C/node_modules"
  cat > "$C/tsconfig.json" <<JSON
{
  "compilerOptions": {
    "target": "ES2022", "module": "ESNext", "moduleResolution": "Bundler",
    "jsx": "react-jsx", "jsxImportSource": "ags/gtk4", "strict": true, "noEmit": true,
    "skipLibCheck": true, "allowImportingTsExtensions": true, "resolveJsonModule": true,
    "lib": ["ES2023"], "types": [], "allowJs": true, "checkJs": true,
    "paths": {
      "ags": ["$A/index.ts"], "ags/gtk4": ["$A/gtk4/index.ts"], "ags/gtk4/app": ["$A/gtk4/app.ts"],
      "ags/gtk4/jsx-runtime": ["$A/gtk4/jsx-runtime.ts"], "ags/*": ["$A/*.ts"],
      "gnim": ["$N/gnim/dist/index.ts"], "gnim/gobject": ["$N/gnim/dist/gobject.ts"],
      "gnim/gtk4/jsx-runtime": ["$N/gnim/dist/gtk4/jsx-runtime.ts"], "gnim/*": ["$N/gnim/dist/*"],
      "@girs/*": ["$N/@girs/*"],
      "cairo": ["$N/@girs/gjs/cairo.d.ts"], "system": ["$N/@girs/gjs/system.d.ts"],
      "console": ["$N/@girs/gjs/console.d.ts"], "gettext": ["$N/@girs/gjs/gettext.d.ts"]
    }
  },
  "files": ["$ROOT/tools/typecheck/env.d.ts", "$ROOT/tools/typecheck/astal.d.ts"],
  "include": ["$ROOT/shell/**/*.ts", "$ROOT/shell/**/*.tsx", "$ROOT/plugins/**/*.js"],
  "exclude": ["$ROOT/shell/@girs", "$ROOT/shell/node_modules", "$ROOT/shell/env.d.ts"]
}
JSON
  # tsc prints paths relative to $C; keep only errors in our files (library-internal noise is ignored)
  local out; out=$(cd "$C" && "$N/.bin/tsc" -p . --pretty false 2>&1 | grep "error TS" | grep -v "node_modules/\|vendor/" | sed -E "s#^(\\.\\./)+##" || true)
  if [ -n "$out" ]; then echo "$out"; echo "typecheck FAILED ($(echo "$out" | wc -l) errors)"; exit 1; fi
  echo "typecheck ok"
}

# guard against a checker that can never fail: a file with a known type error must be reported
selftest() {
  local probe="$ROOT/shell/zz_typecheck_probe.ts"
  echo 'const n: number = "not a number"; export default n' > "$probe"
  local rc=0; ( run ) >/dev/null 2>&1 || rc=$?
  rm -f "$probe"
  [ $rc -eq 1 ] && echo "typecheck selftest ok (catches errors)" || { echo "typecheck selftest FAILED: a known error was not reported"; exit 1; }
}

case "${1:-}" in
  --setup) setup;;
  --selftest) selftest;;
  *) run;;
esac
