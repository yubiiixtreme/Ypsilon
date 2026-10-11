# shellcheck shell=bash
# Capture: screenshots, OCR and the color picker (recording lives in scripts/record.sh).

# "X,Y WxH" of the focused window (grim -g format), empty if none
active_geom() {
  hyprctl activewindow | awk -F'[ ,]' '/^\tat:/{x=$2; y=$3} /^\tsize:/{w=$2; h=$3} END{if (w) printf "%s,%s %sx%s", x, y, w, h}'
}

# "X,Y WxH" of every window visible right now (active + open special workspace of each monitor)
window_rects() {
  python3 - 2>/dev/null <<'PY'
import json, subprocess
def q(*a):
    out = subprocess.run(["hyprctl", "-j", *a], capture_output=True, text=True).stdout
    return json.loads(out or "[]")
mons = q("monitors")
shown = {m["activeWorkspace"]["id"] for m in mons} | {m.get("specialWorkspace", {}).get("id") for m in mons} - {None, 0}
for c in q("clients"):
    if c.get("mapped") and not c.get("hidden") and c["workspace"]["id"] in shown:
        (x, y), (w, h) = c["at"], c["size"]
        print(f"{x},{y} {w}x{h}")
PY
}

# pick_region — click a window to take it whole, or drag any area (Esc: empty + exit 1)
pick_region() { window_rects | slurp; }

cmd_shot() {
  local dir=~/Pictures/Screenshots f geom
  mkdir -p "$dir"; f="$dir/ypsilon-$(date +%Y%m%d_%H%M%S).png"
  case "${1:-select}" in
    full) grim "$f" || return 1;;
    delay) sleep 3; grim "$f" || return 1;;   # time to open a menu first
    window)
      geom=$(active_geom); [ -n "$geom" ] || { echo "no active window"; return 1; }
      grim -g "$geom" "$f" || return 1;;
    annotate|edit)
      local -a ed
      if have satty; then ed=(satty --filename "$f" --output-filename "$f")
      elif have swappy; then ed=(swappy -f "$f" -o "$f")
      else echo "install satty (or swappy) to annotate"; return 1; fi
      geom=$(pick_region) || return 0
      grim -g "$geom" "$f" || return 1
      "${ed[@]}" >/dev/null 2>&1;;
    *)
      geom=$(pick_region) || return 0   # Esc in slurp = cancel, not an error
      grim -g "$geom" "$f" || return 1;;
  esac
  wl-copy < "$f"
  have notify-send && notify-send -i "$f" "Screenshot saved" "$f"
  echo "shot -> $f (+ clipboard)"
}

# ocr — text from a region (window snapping like `shot`) -> clipboard; tesseract, else NormCap
cmd_ocr() {
  local geom text lang=${YPSILON_OCR_LANG:-eng}
  if ! have tesseract; then
    if have normcap; then setsid normcap >/dev/null 2>&1 & return 0; fi
    echo "install tesseract tesseract-data-eng (or normcap)"; return 1
  fi
  geom=$(pick_region) || return 0
  text=$(grim -g "$geom" - | tesseract - - -l "$lang" 2>/dev/null | sed -e 's/[[:space:]]*$//' | cat -s)
  text=${text%$'\n'}
  [ -n "$text" ] || { have notify-send && notify-send -a Ypsilon "No text found" "Try a larger area"; echo "no text found"; return 1; }
  printf '%s' "$text" | wl-copy
  have notify-send && notify-send -a Ypsilon -i edit-copy-symbolic "Text copied" "${text:0:160}"
  printf '%s\n' "$text"
}

cmd_pick() {
  local c
  have hyprpicker || { echo "install hyprpicker"; return 1; }
  c=$(hyprpicker -a -n) && { have notify-send && notify-send "Color copied" "$c"; echo "$c"; }
}
