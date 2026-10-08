#!/usr/bin/env python3
"""Ypsilon wallpaper generator (pure stdlib, no Pillow).

Writes per-theme gradient PNGs sized for the laptop panel (1366x768):
  assets/wallpapers/ypsilon-dark.png
  assets/wallpapers/ypsilon-neon.png
  assets/wallpapers/ypsilon-light.png

Local build tool. Safe to run anytime.
"""

import json
import os
import random
import struct
import zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "assets", "wallpapers")
W, H = 1366, 768


def hex_rgb(h):
    h = h.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


def lerp(a, b, t):
    return int(a + (b - a) * t)


def write_png(path, w, h, pixels):
    def chunk(ctype, data):
        c = ctype + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c) & 0xFFFFFFFF)

    raw = b"".join(b"\x00" + bytes(row) for row in pixels)
    png = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw, 6))
        + chunk(b"IEND", b"")
    )
    with open(path, "wb") as f:
        f.write(png)


def make_gradient(top, bottom, glow, seed):
    rng = random.Random(seed)
    noise = [[rng.randint(-6, 6) for _ in range(W)] for _ in range(H)]
    cx, cy = W * 0.72, H * 0.30
    maxd = (cx * cx + cy * cy) ** 0.5
    rows = []
    for y in range(H):
        t = y / max(H - 1, 1)
        row = []
        for x in range(W):
            d = (((x - cx) ** 2 + (y - cy) ** 2) ** 0.5) / maxd
            g = max(0.0, 1.0 - d) ** 2 * 0.35
            n = noise[y][x]
            row += [
                max(0, min(255, lerp(top[0], bottom[0], t) + int(glow[0] * g) + n)),
                max(0, min(255, lerp(top[1], bottom[1], t) + int(glow[1] * g) + n)),
                max(0, min(255, lerp(top[2], bottom[2], t) + int(glow[2] * g) + n)),
            ]
        rows.append(row)
    return rows


def main():
    with open(os.path.join(ROOT, "themes", "tokens.json")) as f:
        tokens = json.load(f)
    os.makedirs(OUT_DIR, exist_ok=True)
    jobs = {
        "ypsilon-dark": ("ypsilon-dark", 11),
        "ypsilon-neon": ("ypsilon-neon", 22),
        "ypsilon-light": ("ypsilon-light", 33),
    }
    for fname, (theme, seed) in jobs.items():
        t = tokens["themes"][theme]
        rows = make_gradient(hex_rgb(t["bg_alt"]), hex_rgb(t["bg"]), hex_rgb(t["primary"]), seed)
        path = os.path.join(OUT_DIR, fname + ".png")
        write_png(path, W, H, rows)
        print("wrote %s (%dx%d)" % (path, W, H))


if __name__ == "__main__":
    main()
