#!/usr/bin/env python3
"""Ypsilon default wallpapers — procedural scenes, rendered with numpy + Pillow.

Writes assets/wallpapers/*.jpg at 1920x1080 (sharp on the common laptop panels, light on disk):
  ypsilon-ridges   layered mountain ridges at dusk, under a low moon
  ypsilon-aurora   aurora curtains over a dark ridgeline, with stars
  ypsilon-dunes    warm minimal dunes (pairs with the light theme)
  ypsilon-bloom    soft colour bloom on near-black, like light through frosted glass
  ypsilon-contour  topographic contour lines

Every scene is seeded, so a rerun gives the same files. Local build tool; the images are
committed, so users never need numpy. Usage: make-wallpaper.py [NAME ...]
"""

import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "assets", "wallpapers")
W, H = 1920, 1080

try:
    import numpy as np
    from PIL import Image, ImageFilter
except ImportError as e:  # `ypsilon gen` must not fail on machines without numpy
    print("make-wallpaper: skipped (%s) — the committed wallpapers are kept" % e)
    sys.exit(0)


# ---------- helpers ----------

def rgb(h):
    h = h.lstrip("#")
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], dtype=np.float32)


def vgrad(top, bottom, curve=1.0):
    """H x W x 3 vertical gradient; curve > 1 keeps the top colour longer."""
    t = np.linspace(0, 1, H, dtype=np.float32)[:, None, None] ** curve
    return np.broadcast_to(rgb(top) * (1 - t) + rgb(bottom) * t, (H, W, 3)).copy()


def noise2(rng, cells, w=W, h=H):
    """Smooth 0..1 value noise: a small random grid upsampled bicubically."""
    small = rng.random((cells[1], cells[0])).astype(np.float32)
    # float ("F") resampling: 8-bit steps would show up as jagged contour lines
    return np.asarray(Image.fromarray(small, "F").resize((w, h), Image.BICUBIC), dtype=np.float32)


def fbm2(rng, base=4, octaves=5, w=W, h=H):
    out, amp, total = np.zeros((h, w), np.float32), 1.0, 0.0
    for o in range(octaves):
        c = base * 2 ** o
        out += noise2(rng, (c, max(2, c * h // w)), w, h) * amp
        total += amp
        amp *= 0.5
    return out / total


def fbm1(rng, n, base=3, octaves=6, rough=0.5):
    """1-D fractal noise (for ridgelines), roughly 0..1."""
    x = np.linspace(0, 1, n)
    out, amp, total = np.zeros(n), 1.0, 0.0
    for o in range(octaves):
        k = base * 2 ** o + 1
        out += np.interp(x, np.linspace(0, 1, k), rng.random(k)) * amp
        total += amp
        amp *= rough
    # interp is piecewise linear: soften the kinks a little
    padded = np.pad(out / total, 4, mode="edge")  # edge padding: no droop at the image borders
    return np.convolve(padded, np.ones(9) / 9, mode="valid")


def glow(img, cx, cy, radius, color, strength):
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    d = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2) / radius
    g = np.exp(-d * d)[..., None] * strength
    return img + rgb(color) * g


def mix(a, b, t):
    return a * (1 - t) + b * t


def finish(img, name, grain=3.0, seed=0):
    """film grain (kills gradient banding), vignette, save as JPEG."""
    rng = np.random.default_rng(seed + 991)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    v = ((xx / W - 0.5) ** 2 + (yy / H - 0.5) ** 2) * 1.3
    img = img * (1 - np.clip(v, 0, 1) ** 1.5 * 0.35)[..., None]
    img = img + rng.normal(0, grain, (H, W, 1)).astype(np.float32)
    out = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8))
    path = os.path.join(OUT_DIR, name + ".jpg")
    out.save(path, quality=92, optimize=True, progressive=True, subsampling=0)
    print("wrote", os.path.relpath(path, ROOT))


def ridge_layers(img, rng, layers, ys):
    """Paint silhouettes back to front. layers: [(color, base_y, amplitude, roughness)]."""
    for color, base, amp, rough in layers:
        line = base * H - fbm1(rng, W, base=2, rough=rough) * amp * H
        mask = (ys >= line[None, :]).astype(np.float32)
        # 1px soft edge
        edge = np.clip(ys - line[None, :] + 0.5, 0, 1)
        mask = np.maximum(mask, edge)[..., None]
        depth = np.clip((ys - line[None, :]) / (H * 0.5), 0, 1)[..., None]
        shade = rgb(color) * (1 - depth * 0.35)
        img = img * (1 - mask) + shade * mask
    return img


# ---------- scenes ----------

def ridges(seed=7):
    rng = np.random.default_rng(seed)
    ys = np.mgrid[0:H, 0:W][0].astype(np.float32)
    img = vgrad("#141a3a", "#e8907a", curve=1.6)
    img = glow(img, W * 0.68, H * 0.46, 380, "#ffb48a", 0.35)
    # moon + its halo
    img = glow(img, W * 0.68, H * 0.40, 120, "#fff1df", 0.25)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    moon = np.clip(46 - np.sqrt((xx - W * 0.68) ** 2 + (yy - H * 0.40) ** 2), 0, 1)[..., None]
    img = mix(img, rgb("#fff3e6"), moon * 0.92)
    sky = (ys < H * 0.45).astype(np.float32) * (1 - ys / (H * 0.45))
    st = np.zeros((H, W), np.float32)
    n = 500
    st[rng.integers(0, int(H * 0.45), n), rng.integers(0, W, n)] = rng.random(n) ** 4 * 200
    img = img + (st * sky)[..., None]
    layers = [
        ("#b9677a", 0.66, 0.30, 0.58),
        ("#874870", 0.74, 0.30, 0.56),
        ("#55305c", 0.83, 0.26, 0.54),
        ("#2e1e45", 0.92, 0.22, 0.50),
        ("#150f26", 1.02, 0.18, 0.46),
    ]
    img = ridge_layers(img, rng, layers, ys)
    finish(img, "ypsilon-ridges", seed=seed)


def aurora(seed=21):
    rng = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    img = vgrad("#03050d", "#0b1a2a", curve=0.9)
    # stars: sparse points, a few brighter with a tiny glow
    stars = np.zeros((H, W), np.float32)
    n = 1400
    sx, sy = rng.integers(0, W, n), rng.integers(0, int(H * 0.8), n)
    stars[sy, sx] = rng.random(n) ** 3 * 255
    st = Image.fromarray(stars.astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6))
    img = img + np.asarray(st, np.float32)[..., None] * 1.6
    # curtains: a wavy base line; light rises above it in vertical streaks
    x = np.linspace(0, 1, W)
    patch = fbm2(rng, base=2, octaves=3)  # some stretches of sky glow, others stay dark
    for k, (y0, amp, gain) in enumerate(((0.40, 0.09, 1.0), (0.30, 0.06, 0.45))):
        base = H * (y0 + amp * np.sin(x * (4.1 + k * 2.3) + 1.3 + k) + 0.035 * np.sin(x * 10.7 + k) + (fbm1(rng, W, base=4) - 0.5) * 0.08)
        streaks = fbm2(rng, base=70, octaves=2, w=W, h=6)
        streaks = np.asarray(Image.fromarray(streaks, "F").resize((W, H), Image.BICUBIC), np.float32)
        above = (base[None, :] - yy) / (H * 0.30)
        curtain = np.where(above > 0, np.exp(-above * 2.6), np.exp(above * 7.0))
        band = curtain * (0.25 + np.clip(streaks, 0, 1) ** 2.2 * 1.4) * np.clip(patch * 1.8 - 0.35, 0, 1)
        t = np.clip(above, 0, 1)[..., None]
        color = mix(rgb("#38f5a8"), rgb("#8a5cff"), np.clip(t * 1.5, 0, 1))
        img = img + color * band[..., None] * 0.9 * gain
    # soft reflection of the light on the haze near the horizon
    img = glow(img, W * 0.5, H * 0.95, 900, "#1f6b6b", 0.18)
    img = ridge_layers(img, rng, [("#081620", 0.84, 0.16, 0.55), ("#03070b", 0.96, 0.12, 0.48)], yy)
    finish(img, "ypsilon-aurora", grain=2.5, seed=seed)


def dunes(seed=33):
    rng = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    img = vgrad("#e9c7b4", "#f0b896", curve=1.1)
    img = glow(img, W * 0.30, H * 0.34, 560, "#ffd9b8", 0.16)
    sun = np.clip(70 - np.sqrt((xx - W * 0.30) ** 2 + (yy - H * 0.34) ** 2), 0, 1)[..., None]
    img = mix(img, rgb("#fffaf4"), sun * 0.95)
    x = np.linspace(0, 1, W)
    layers = [("#efc09d", 0.55), ("#e8aa83", 0.64), ("#dd946e", 0.74), ("#c97c5c", 0.85), ("#b1664b", 0.97)]
    for i, (color, base) in enumerate(layers):
        ph = rng.random() * 6.28
        line = H * (base - 0.06 * np.sin(x * (2.2 + i * 0.6) + ph) - 0.025 * np.sin(x * (5.1 + i) + ph * 2))
        d = yy - line[None, :]
        mask = np.clip(d + 0.5, 0, 1)[..., None]
        # lit crest fading into shadow below it
        light = np.exp(-np.clip(d, 0, None) / (H * 0.035))[..., None]
        shade = mix(rgb(color), rgb("#fff1e3"), light * 0.45) * (1 - np.clip(d / H, 0, 1)[..., None] * 0.25)
        img = img * (1 - mask) + shade * mask
    finish(img, "ypsilon-dunes", grain=2.2, seed=seed)


def bloom(seed=44):
    rng = np.random.default_rng(seed)
    small_w, small_h = W // 4, H // 4
    yy, xx = np.mgrid[0:small_h, 0:small_w].astype(np.float32)
    img = np.zeros((small_h, small_w, 3), np.float32) + rgb("#07060c")
    blobs = [("#e8366a", 0.18, 0.22, 0.62), ("#6a2cf0", 0.62, 0.12, 0.70), ("#ff8a3c", 0.88, 0.86, 0.52),
             ("#2456d8", 0.30, 0.95, 0.60), ("#b22ad8", 0.98, 0.35, 0.45)]
    for color, cx, cy, r in blobs:
        d = np.sqrt(((xx / small_w - cx) * 1.6) ** 2 + (yy / small_h - cy) ** 2) / r
        img = img + rgb(color) * (np.exp(-d * d * 1.6) * 0.75)[..., None]
    # tone-map so overlapping blobs blend instead of clipping
    img = 255 * (1 - np.exp(-img / 230))
    big = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).resize((W, H), Image.BICUBIC).filter(ImageFilter.GaussianBlur(60))
    img = np.asarray(big, np.float32)
    # a faint diagonal sheen, like glass
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    img = img + (np.exp(-(((xx - yy * 1.2) / W - 0.15) ** 2) * 40) * 18)[..., None]
    finish(img, "ypsilon-bloom", grain=4.0, seed=seed)


def contour(seed=55):
    rng = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    img = vgrad("#0a0f14", "#101820")
    field = fbm2(rng, base=3, octaves=3)
    levels = field * 30
    frac = np.abs(levels - np.round(levels))
    gy, gx = np.gradient(levels)
    width = np.sqrt(gx * gx + gy * gy) * 1.1 + 1e-4  # constant on-screen line width
    line = np.clip(1 - frac / width, 0, 1)
    major = (np.round(levels).astype(int) % 5 == 0)
    tint = mix(rgb("#3fbfa8"), rgb("#e0b25a"), np.clip((field[..., None] - 0.3) * 2.2, 0, 1))
    img = img + tint * (line * np.where(major, 0.85, 0.32))[..., None]
    img = glow(img, W * 0.72, H * 0.38, 700, "#163a3a", 0.35)
    finish(img, "ypsilon-contour", grain=2.0, seed=seed)


SCENES = {"ypsilon-ridges": ridges, "ypsilon-aurora": aurora, "ypsilon-dunes": dunes,
          "ypsilon-bloom": bloom, "ypsilon-contour": contour}


def main(argv):
    os.makedirs(OUT_DIR, exist_ok=True)
    names = argv or list(SCENES)
    for n in names:
        if n not in SCENES:
            print("unknown scene %s (have: %s)" % (n, " ".join(SCENES)))
            return 1
        SCENES[n]()
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
