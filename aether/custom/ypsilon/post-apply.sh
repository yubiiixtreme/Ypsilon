#!/usr/bin/env bash
# Aether post-apply hook (Ypsilon custom app — link it with scripts/link-aether.sh).
# Aether renders wallpaper.env from its template on every apply (Ctrl+Enter); this feeds
# the wallpaper to Ypsilon so theme + wallpaper change in one action.
# Must never fail the apply: every error path exits 0.
ENV_FILE="$HOME/.cache/ypsilon/aether-wallpaper.env"
[ -f "$ENV_FILE" ] || exit 0
img=$(grep '^YPSILON_WALLPAPER=' "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '\r')
img=${img%\"}; img=${img#\"}; img=${img%\'}; img=${img#\'}
[ -n "$img" ] && [ -f "$img" ] || exit 0
cli=""
command -v ypsilon >/dev/null 2>&1 && cli=ypsilon
[ -z "$cli" ] && [ -x "$HOME/Projects/Ypsilon/scripts/ypsilon" ] && cli="$HOME/Projects/Ypsilon/scripts/ypsilon"
[ -z "$cli" ] && [ -x "$HOME/Ypsilon/scripts/ypsilon" ] && cli="$HOME/Ypsilon/scripts/ypsilon"
[ -n "$cli" ] || exit 0
"$cli" wallpaper set "$img" >/dev/null 2>&1 || true
exit 0
