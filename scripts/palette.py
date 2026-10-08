#!/usr/bin/env python3
"""Wallpaper -> Ypsilon theme (Material-You style, stdlib math + Pillow for decoding).

  palette.py IMAGE [--name ypsilon-auto] [--light]   write themes/user/<name>.json

Pipeline: downscale -> k-means in RGB (deterministic seeds) -> score clusters by
population x chroma -> primary/accent with hue separation -> dark (or light)
surfaces tinted by the primary hue -> every text/ui color pushed until it meets
WCAG contrast against the background. Pure functions are unit-tested
(tests/test_palette.py); only load_pixels() touches Pillow.
"""
import colorsys
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
USER_THEMES = os.path.join(ROOT, "themes", "user")

# ---------- color math ----------

def hex_of(rgb):
    return "#%02x%02x%02x" % tuple(max(0, min(255, round(c))) for c in rgb)


def rgb_of(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def _lin(c):
    c /= 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def luminance(rgb):
    r, g, b = (_lin(c) for c in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast(a, b):
    la, lb = luminance(a), luminance(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def hls(rgb):
    return colorsys.rgb_to_hls(*(c / 255.0 for c in rgb))


def from_hls(h, l, s):
    return tuple(c * 255.0 for c in colorsys.hls_to_rgb(h % 1.0, max(0.0, min(1.0, l)), max(0.0, min(1.0, s))))


def ensure_contrast(fg, bg, ratio):
    """Move fg's lightness away from bg until contrast >= ratio (keeps hue/saturation)."""
    h, l, s = hls(fg)
    up = luminance(bg) < 0.5
    for _ in range(60):
        if contrast(from_hls(h, l, s), bg) >= ratio:
            break
        l += 0.02 if up else -0.02
        if l <= 0 or l >= 1:
            break
    return from_hls(h, l, s)


def hue_dist(a, b):
    d = abs(a - b) % 1.0
    return min(d, 1.0 - d)

# ---------- clustering ----------

def kmeans(pixels, k=6, iters=12):
    """Deterministic k-means: seeds spread over the luminance-sorted pixel list."""
    if not pixels:
        return []
    pts = sorted(pixels, key=luminance)
    k = min(k, len(set(pts)))
    cents = [pts[int((i + 0.5) * len(pts) / k)] for i in range(k)]
    groups = []
    for _ in range(iters):
        groups = [[] for _ in cents]
        for p in pixels:
            j = min(range(len(cents)), key=lambda i: sum((p[c] - cents[i][c]) ** 2 for c in range(3)))
            groups[j].append(p)
        new = [tuple(sum(p[c] for p in g) / len(g) for c in range(3)) if g else cents[i] for i, g in enumerate(groups)]
        if new == cents:
            break
        cents = new
    return sorted(((cents[i], len(g)) for i, g in enumerate(groups) if g), key=lambda x: -x[1])


def score(cluster, total):
    rgb, n = cluster
    h, l, s = hls(rgb)
    chroma = s * (1 - abs(2 * l - 1))  # HSL chroma
    usable = 0.15 < l < 0.85
    return (n / total) * (0.25 + chroma * 2.5) * (1.0 if usable else 0.35)

# ---------- theme ----------

FALLBACK_PRIMARY = (124, 124, 255)


def pick_seeds(clusters):
    total = sum(n for _, n in clusters) or 1
    ranked = sorted(clusters, key=lambda c: -score(c, total))
    colorful = [c for c in ranked if hls(c[0])[2] > 0.12]
    primary = colorful[0][0] if colorful else FALLBACK_PRIMARY
    ph = hls(primary)[0]
    accent = next((c[0] for c in colorful[1:] if hue_dist(hls(c[0])[0], ph) > 0.11), None)
    if accent is None:  # monochrome wallpaper: rotate the primary hue
        h, l, s = hls(primary)
        accent = from_hls(h + 0.17, l, max(s, 0.45))
    return primary, accent


def build_theme(clusters, light=False):
    primary, accent = pick_seeds(clusters)
    ph, _, ps = hls(primary)
    tint = min(ps, 0.35)
    if light:
        bg, bg_alt = from_hls(ph, 0.95, tint * 0.6), from_hls(ph, 0.99, tint * 0.3)
        fg_seed, muted_seed = from_hls(ph, 0.12, tint), from_hls(ph, 0.40, tint * 0.6)
    else:
        bg, bg_alt = from_hls(ph, 0.06, tint * 0.8), from_hls(ph, 0.11, tint * 0.7)
        fg_seed, muted_seed = from_hls(ph, 0.92, tint * 0.4), from_hls(ph, 0.66, tint * 0.4)

    # vivid, legible UI colors
    def vivid(c):
        h, l, s = hls(c)
        return from_hls(h, min(max(l, 0.45), 0.72) if not light else min(max(l, 0.30), 0.50), max(s, 0.55))

    fg = ensure_contrast(fg_seed, bg, 12.0)
    muted = ensure_contrast(muted_seed, bg, 4.6)
    primary = ensure_contrast(vivid(primary), bg, 4.5)
    accent = ensure_contrast(vivid(accent), bg, 4.5)
    sem = {k: ensure_contrast(from_hls(h, 0.62 if not light else 0.38, 0.7), bg, 4.5)
           for k, h in (("good", 0.40), ("warn", 0.12), ("bad", 0.97))}

    surf_a = 0.78 if light else 0.72
    br, bgc = rgb_of(hex_of(primary)), rgb_of(hex_of(bg_alt))
    theme = {
        "bg": hex_of(bg), "bg_alt": hex_of(bg_alt), "fg": hex_of(fg), "muted": hex_of(muted),
        "primary": hex_of(primary), "accent": hex_of(accent),
        "good": hex_of(sem["good"]), "warn": hex_of(sem["warn"]), "bad": hex_of(sem["bad"]),
        "surface": "rgba(%d,%d,%d,%s)" % (bgc + (surf_a,)),
        "border": "rgba(%d,%d,%d,%s)" % (br + (0.22 if light else 0.30,)),
    }
    theme["ansi"] = ansi(theme, light)
    return theme


def ansi(t, light):
    bg, fg = rgb_of(t["bg"]), rgb_of(t["fg"])
    base = {1: 0.98, 2: 0.38, 3: 0.13, 4: 0.62, 5: 0.80, 6: 0.50}
    normal = [t["bg"]] + [hex_of(ensure_contrast(from_hls(h, 0.60 if not light else 0.40, 0.65), bg, 4.5)) for h in base.values()] + [t["fg"]]
    bright = [hex_of(ensure_contrast(from_hls(hls(bg)[0], 0.35 if not light else 0.55, 0.15), bg, 2.2))]
    bright += [hex_of(ensure_contrast(from_hls(h, 0.72 if not light else 0.32, 0.75), bg, 6.0)) for h in base.values()]
    bright += ["#ffffff" if not light else "#000000"]
    return normal + bright


def load_pixels(path, size=64):
    from PIL import Image  # only dependency, imported lazily
    with Image.open(path) as im:
        im = im.convert("RGB")
        im.thumbnail((size, size))
        flat = getattr(im, "get_flattened_data", None)  # Pillow >= 12.1
        return list(flat() if flat else im.getdata())


def main(argv):
    if not argv or argv[0] in ("-h", "--help"):
        print(__doc__)
        return 0
    path = argv[0]
    name = argv[argv.index("--name") + 1] if "--name" in argv else "ypsilon-auto"
    light = "--light" in argv
    theme = build_theme(kmeans(load_pixels(path)), light=light)
    theme["source"] = os.path.abspath(path)
    os.makedirs(USER_THEMES, exist_ok=True)
    out = os.path.join(USER_THEMES, "%s.json" % name)
    with open(out, "w") as f:
        json.dump(theme, f, indent=2)
        f.write("\n")
    print("theme %s <- %s (primary %s, accent %s)" % (name, os.path.basename(path), theme["primary"], theme["accent"]))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
