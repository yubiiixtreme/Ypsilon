#!/usr/bin/env python3
"""Generate the Ypsilon 3D room: a stylized fantasy meadow (original art, no third-party assets).

Writes world.glb (terrain, pond, path, trees, ruins, crystals, floating islands) and sky.png
(equirectangular anime-style sky) into the output dir (default ~/.local/share/ypsilon/3d).
Pure stdlib for the mesh; numpy + Pillow for the sky. Deterministic (seeded).

    make-3d-world.py [OUTDIR]
"""
import json
import math
import os
import random
import struct
import sys

R = random.Random(7)
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser("~/.local/share/ypsilon/3d")
os.makedirs(OUT, exist_ok=True)

# ---------------------------------------------------------------- materials
MATS = {
    "grass":   dict(c=(0.36, 0.62, 0.22)),
    "grass2":  dict(c=(0.45, 0.72, 0.28)),
    "dirt":    dict(c=(0.55, 0.42, 0.28)),
    "stone":   dict(c=(0.62, 0.62, 0.66)),
    "stone2":  dict(c=(0.48, 0.5, 0.56)),
    "trunk":   dict(c=(0.42, 0.28, 0.18)),
    "leaf":    dict(c=(0.2, 0.52, 0.28)),
    "leaf2":   dict(c=(0.95, 0.62, 0.7)),   # sakura-ish
    "water":   dict(c=(0.25, 0.7, 0.85, 0.82), e=(0.02, 0.1, 0.14)),
    "crystal": dict(c=(0.4, 0.85, 1.0), e=(0.2, 0.7, 1.0)),
    "gold":    dict(c=(0.95, 0.78, 0.35), e=(0.25, 0.18, 0.04)),
    "flower":  dict(c=(1.0, 0.9, 0.5), e=(0.3, 0.25, 0.05)),
    "cloudy":  dict(c=(1.0, 1.0, 1.0), e=(0.5, 0.5, 0.5)),
}
MAT_ORDER = list(MATS)
# geometry per (group, material): positions, normals, indices
G = {}


def bucket(group, mat):
    return G.setdefault((group, mat), ([], [], []))


def tri(group, mat, a, b, c):
    pos, nor, idx = bucket(group, mat)
    ux, uy, uz = b[0] - a[0], b[1] - a[1], b[2] - a[2]
    vx, vy, vz = c[0] - a[0], c[1] - a[1], c[2] - a[2]
    n = (uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx)
    l = math.sqrt(n[0] ** 2 + n[1] ** 2 + n[2] ** 2) or 1.0
    n = (n[0] / l, n[1] / l, n[2] / l)
    base = len(pos)
    for p in (a, b, c):
        pos.append(p)
        nor.append(n)
    idx.extend((base, base + 1, base + 2))


def quad(group, mat, a, b, c, d):
    tri(group, mat, a, b, c)
    tri(group, mat, a, c, d)


def add(p, q):
    return (p[0] + q[0], p[1] + q[1], p[2] + q[2])


def box(group, mat, cx, cy, cz, sx, sy, sz, rot=0.0):
    cs, sn = math.cos(rot), math.sin(rot)

    def P(x, y, z):
        return (cx + x * cs - z * sn, cy + y, cz + x * sn + z * cs)
    hx, hy, hz = sx / 2, sy / 2, sz / 2
    v = [P(-hx, -hy, -hz), P(hx, -hy, -hz), P(hx, hy, -hz), P(-hx, hy, -hz),
         P(-hx, -hy, hz), P(hx, -hy, hz), P(hx, hy, hz), P(-hx, hy, hz)]
    for f in ((0, 3, 2, 1), (4, 5, 6, 7), (0, 4, 7, 3), (1, 2, 6, 5), (3, 7, 6, 2), (0, 1, 5, 4)):
        quad(group, mat, v[f[0]], v[f[1]], v[f[2]], v[f[3]])


def cone(group, mat, cx, cy, cz, r, h, seg=8, r_top=0.0, rot=0.0):
    ring = [(cx + r * math.cos(rot + 2 * math.pi * i / seg), cy, cz + r * math.sin(rot + 2 * math.pi * i / seg)) for i in range(seg)]
    top = [(cx + r_top * math.cos(rot + 2 * math.pi * i / seg), cy + h, cz + r_top * math.sin(rot + 2 * math.pi * i / seg)) for i in range(seg)]
    for i in range(seg):
        j = (i + 1) % seg
        if r_top > 0:
            quad(group, mat, ring[i], top[i], top[j], ring[j])
        else:
            tri(group, mat, ring[i], (cx, cy + h, cz), ring[j])
        tri(group, mat, (cx, cy, cz), ring[j], ring[i])
    if r_top > 0:
        for i in range(seg):
            tri(group, mat, (cx, cy + h, cz), top[(i + 1) % seg], top[i])


def blob(group, mat, cx, cy, cz, rx, ry, rz, lat=5, lon=8):
    def P(i, j):
        th = math.pi * i / lat
        ph = 2 * math.pi * j / lon
        return (cx + rx * math.sin(th) * math.cos(ph), cy + ry * math.cos(th), cz + rz * math.sin(th) * math.sin(ph))
    for i in range(lat):
        for j in range(lon):
            a, b, c, d = P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)
            if i == 0:
                tri(group, mat, a, b, c)
            elif i == lat - 1:
                tri(group, mat, a, b, d)
            else:
                quad(group, mat, a, b, c, d)


def crystal(group, mat, cx, cy, cz, h, r):
    seg = 6
    mid = cy + h * 0.65
    ring = [(cx + r * math.cos(2 * math.pi * i / seg), mid, cz + r * math.sin(2 * math.pi * i / seg)) for i in range(seg)]
    for i in range(seg):
        j = (i + 1) % seg
        tri(group, mat, ring[i], (cx, cy + h, cz), ring[j])
        tri(group, mat, ring[j], (cx, cy, cz), ring[i])


# ---------------------------------------------------------------- terrain
RAD = 70.0


def height(x, z):
    d = math.hypot(x, z)
    h = (math.sin(x * 0.11) * math.cos(z * 0.09) * 1.8 + math.sin(x * 0.045 + 1.3) * math.sin(z * 0.05) * 3.2
         + math.sin(x * 0.23 + z * 0.17) * 0.35)
    h *= min(1.0, d / 12.0)                                  # flat plaza near spawn
    h -= max(0.0, 1.0 - math.hypot(x - 22, z + 14) / 11.0) * 4.2   # pond basin
    h += max(0.0, d - 52) * 0.35                              # rim rises, hides the edge
    return h


def inside(x, z):
    return math.hypot(x, z) <= RAD


STEP = 3.5
n = int(RAD * 2 / STEP)
for ix in range(n):
    for iz in range(n):
        x0, z0 = -RAD + ix * STEP, -RAD + iz * STEP
        c = (x0 + STEP / 2, z0 + STEP / 2)
        if not inside(*c):
            continue
        pts = [(x0, z0), (x0 + STEP, z0), (x0 + STEP, z0 + STEP), (x0, z0 + STEP)]
        v = [(p[0], height(*p), p[1]) for p in pts]
        near_path = abs(c[1] - math.sin(c[0] * 0.09) * 5) < 2.4 and c[0] > -5
        in_pond = math.hypot(c[0] - 22, c[1] + 14) < 8.5
        mat = "dirt" if (near_path or in_pond) else ("grass2" if (ix + iz) % 2 else "grass")
        quad("ground", mat, v[0], v[3], v[2], v[1])
# skirt so the disc looks like a floating island from outside
SK = 36
for i in range(SK):
    a0, a1 = 2 * math.pi * i / SK, 2 * math.pi * (i + 1) / SK
    p0 = (RAD * math.cos(a0), height(RAD * math.cos(a0), RAD * math.sin(a0)), RAD * math.sin(a0))
    p1 = (RAD * math.cos(a1), height(RAD * math.cos(a1), RAD * math.sin(a1)), RAD * math.sin(a1))
    b0 = (RAD * 0.35 * math.cos(a0), -28.0, RAD * 0.35 * math.sin(a0))
    b1 = (RAD * 0.35 * math.cos(a1), -28.0, RAD * 0.35 * math.sin(a1))
    quad("ground", "stone2", p0, p1, b1, b0)
    tri("ground", "stone", b0, b1, (0, -32.0, 0))

# pond surface (walk-through)
seg = 20
for i in range(seg):
    a0, a1 = 2 * math.pi * i / seg, 2 * math.pi * (i + 1) / seg
    c0 = (22 + 8.4 * math.cos(a0), -1.9, -14 + 8.4 * math.sin(a0))
    c1 = (22 + 8.4 * math.cos(a1), -1.9, -14 + 8.4 * math.sin(a1))
    tri("nocol_water", "water", (22, -1.9, -14), c1, c0)

# ---------------------------------------------------------------- props
def ground_y(x, z):
    return height(x, z)


# stone path stepping stones along the dirt road
for i in range(-4, 36):
    x = i * 1.9
    z = math.sin(x * 0.09) * 5
    box("ground", "stone", x, ground_y(x, z) + 0.02, z, 1.1, 0.12, 0.9, rot=R.uniform(-0.3, 0.3))

# trees: pines + sakura-like round trees
for _ in range(70):
    a, d = R.uniform(0, 2 * math.pi), R.uniform(10, 62)
    x, z = d * math.cos(a), d * math.sin(a)
    if math.hypot(x - 22, z + 14) < 11 or abs(z - math.sin(x * 0.09) * 5) < 4:
        continue
    y = ground_y(x, z)
    s = R.uniform(0.8, 1.7)
    if R.random() < 0.5:
        cone("ground", "trunk", x, y, z, 0.28 * s, 2.0 * s, 6)
        for k in range(3):
            cone("nocol_leaf", "leaf", x, y + (1.4 + k * 1.2) * s, z, (1.9 - k * 0.5) * s, 2.0 * s, 8)
    else:
        cone("ground", "trunk", x, y, z, 0.3 * s, 3.0 * s, 6, r_top=0.2 * s)
        blob("nocol_leaf", "leaf2" if R.random() < 0.6 else "leaf", x, y + 4.2 * s, z, 2.3 * s, 1.8 * s, 2.3 * s)

# rocks
for _ in range(40):
    a, d = R.uniform(0, 2 * math.pi), R.uniform(6, 64)
    x, z = d * math.cos(a), d * math.sin(a)
    if math.hypot(x - 22, z + 14) < 9:
        continue
    s = R.uniform(0.5, 1.8)
    blob("ground", R.choice(("stone", "stone2")), x, ground_y(x, z) + 0.2 * s, z, s, s * 0.7, s * 0.9, 3, 6)

# flowers / grass tufts (no collision)
for _ in range(500):
    a, d = R.uniform(0, 2 * math.pi), R.uniform(3, 64)
    x, z = d * math.cos(a), d * math.sin(a)
    if math.hypot(x - 22, z + 14) < 9:
        continue
    y = ground_y(x, z)
    if R.random() < 0.3:
        cone("nocol_flora", "flower", x, y, z, 0.12, 0.35, 5, r_top=0.08)
    else:
        cone("nocol_flora", "grass2", x, y, z, 0.14, R.uniform(0.35, 0.7), 4)

# ruined shrine arch (Teyvat-ish) on the hill
sx, sz = -24.0, -18.0
sy = ground_y(sx, sz)
for dx in (-3.2, 3.2):
    box("ground", "stone", sx + dx, sy + 3.0, sz, 1.1, 6.0, 1.1)
    box("ground", "gold", sx + dx, sy + 6.15, sz, 1.4, 0.3, 1.4)
box("ground", "stone", sx, sy + 6.6, sz, 8.8, 1.0, 1.4)
box("ground", "gold", sx, sy + 7.25, sz, 9.2, 0.3, 1.6)
box("ground", "stone2", sx, sy + 0.15, sz + 4, 4.0, 0.3, 4.0)
crystal("nocol_crystal", "crystal", sx, sy + 1.2, sz + 4, 2.4, 0.5)

# crystals scattered (glowing)
for _ in range(14):
    a, d = R.uniform(0, 2 * math.pi), R.uniform(14, 56)
    x, z = d * math.cos(a), d * math.sin(a)
    if math.hypot(x - 22, z + 14) < 10:
        continue
    crystal("ground", "crystal", x, ground_y(x, z), z, R.uniform(1.2, 3.0), R.uniform(0.3, 0.6))

# waypoint-like lantern posts along the path
for i in range(0, 34, 6):
    x = i * 1.9
    z = math.sin(x * 0.09) * 5 + 2.4
    y = ground_y(x, z)
    box("ground", "trunk", x, y + 1.1, z, 0.18, 2.2, 0.18)
    box("nocol_crystal", "flower", x, y + 2.35, z, 0.4, 0.5, 0.4)

# floating islands with crystals + trees, drifting around the plaza
for k in range(7):
    a = 2 * math.pi * k / 7 + R.uniform(-0.3, 0.3)
    d = R.uniform(30, 52)
    cx, cz = d * math.cos(a), d * math.sin(a)
    cy = R.uniform(14, 34)
    r = R.uniform(4, 8)
    cone("ground", "stone2", cx, cy - r * 0.9, cz, r * 0.9, r * 0.9, 8)          # underside
    cone("ground", "grass", cx, cy - 0.05, cz, r, 0.1, 10, r_top=r)              # flat top disc
    blob("ground", "grass2", cx, cy, cz, r, 0.35, r, 2, 10)
    if R.random() < 0.7:
        cone("ground", "trunk", cx, cy, cz, 0.22, 2.4, 6, r_top=0.16)
        blob("nocol_leaf", "leaf2", cx, cy + 3.2, cz, 1.7, 1.4, 1.7)
    crystal("ground", "crystal", cx + r * 0.4, cy, cz, R.uniform(1.0, 2.4), 0.35)

# giant sky-ring (decor) for the 'monument in the distance' look
for i in range(24):
    a0, a1 = 2 * math.pi * i / 24, 2 * math.pi * (i + 1) / 24
    r0, r1 = 120.0, 126.0
    y0 = 70.0
    quad("nocol_decor", "gold",
         (r0 * math.cos(a0), y0 + 1, r0 * math.sin(a0)), (r1 * math.cos(a0), y0 + 1, r1 * math.sin(a0)),
         (r1 * math.cos(a1), y0 + 1, r1 * math.sin(a1)), (r0 * math.cos(a1), y0 + 1, r0 * math.sin(a1)))

# ---------------------------------------------------------------- GLB writer
bin_chunks, views, accs, meshes, nodes, mat_list = [], [], [], [], [], []
for name in MAT_ORDER:
    m = MATS[name]
    d = {"name": name, "pbrMetallicRoughness": {"baseColorFactor": list(m["c"]) if len(m["c"]) == 4 else list(m["c"]) + [1.0],
                                                  "metallicFactor": 0.0, "roughnessFactor": 0.9}}
    if "e" in m:
        d["emissiveFactor"] = list(m["e"])
    if len(m["c"]) == 4 and m["c"][3] < 1:
        d["alphaMode"] = "BLEND"
    d["doubleSided"] = True
    mat_list.append(d)


def push(data, target):
    off = sum(len(c) for c in bin_chunks)
    pad = (-len(data)) % 4
    bin_chunks.append(data + b"\0" * pad)
    views.append({"buffer": 0, "byteOffset": off, "byteLength": len(data), "target": target})
    return len(views) - 1


groups = {}
for (grp, mat), geo in G.items():
    groups.setdefault(grp, []).append((mat, geo))
for grp, items in groups.items():
    prims = []
    for mat, (pos, nor, idx) in items:
        if not idx:
            continue
        pb = b"".join(struct.pack("<3f", *p) for p in pos)
        nb = b"".join(struct.pack("<3f", *p) for p in nor)
        ib = struct.pack("<%dI" % len(idx), *idx)
        mn = [min(p[i] for p in pos) for i in range(3)]
        mx = [max(p[i] for p in pos) for i in range(3)]
        vp, vn, vi = push(pb, 34962), push(nb, 34962), push(ib, 34963)
        accs.append({"bufferView": vp, "componentType": 5126, "count": len(pos), "type": "VEC3", "min": mn, "max": mx})
        accs.append({"bufferView": vn, "componentType": 5126, "count": len(nor), "type": "VEC3"})
        accs.append({"bufferView": vi, "componentType": 5125, "count": len(idx), "type": "SCALAR"})
        a = len(accs) - 3
        prims.append({"attributes": {"POSITION": a, "NORMAL": a + 1}, "indices": a + 2, "material": MAT_ORDER.index(mat)})
    meshes.append({"name": grp, "primitives": prims})
    nodes.append({"name": grp, "mesh": len(meshes) - 1})

blob_bin = b"".join(bin_chunks)
gltf = {"asset": {"version": "2.0", "generator": "ypsilon make-3d-world.py"}, "scene": 0,
        "scenes": [{"nodes": list(range(len(nodes)))}], "nodes": nodes, "meshes": meshes, "materials": mat_list,
        "accessors": accs, "bufferViews": views, "buffers": [{"byteLength": len(blob_bin)}]}
js = json.dumps(gltf, separators=(",", ":")).encode()
js += b" " * ((-len(js)) % 4)
total = 12 + 8 + len(js) + 8 + len(blob_bin)
with open(os.path.join(OUT, "world.glb"), "wb") as f:
    f.write(struct.pack("<III", 0x46546C67, 2, total))
    f.write(struct.pack("<II", len(js), 0x4E4F534A) + js)
    f.write(struct.pack("<II", len(blob_bin), 0x004E4942) + blob_bin)
tris = sum(len(g[2]) // 3 for g in G.values())
print(f"world.glb: {tris} triangles, {total / 1e6:.1f} MB")

# ---------------------------------------------------------------- sky panorama
try:
    import numpy as np
    from PIL import Image, ImageFilter
except ImportError:
    print("numpy/Pillow missing — skipped sky.png")
    sys.exit(0)

W, H = 2048, 1024
rng = np.random.default_rng(3)
lat = (0.5 - (np.arange(H) + 0.5) / H) * np.pi            # +pi/2 top
lon = ((np.arange(W) + 0.5) / W) * 2 * np.pi
LA, LO = np.meshgrid(lat, lon, indexing="ij")
t = np.clip(LA / (np.pi / 2), -1, 1)
top, mid, hor = np.array([0.18, 0.42, 0.88]), np.array([0.45, 0.75, 0.98]), np.array([1.0, 0.88, 0.75])
u = np.clip(t, 0, 1)[..., None]
img = hor * (1 - np.minimum(u * 3.2, 1)) + mid * np.minimum(u * 3.2, 1)
img = img * (1 - np.clip((u - 0.3) / 0.7, 0, 1)) + top * np.clip((u - 0.3) / 0.7, 0, 1)
below = (t < 0)[..., None]
img = np.where(below, np.array([0.62, 0.8, 0.9]) * (1 + t[..., None] * 0.6), img)   # haze under horizon (map hides it)


def fbm(w, h, octs=6, seed=1):
    r = np.random.default_rng(seed)
    out = np.zeros((h, w))
    amp = 1.0
    for o in range(octs):
        gw, gh = 4 * 2 ** o, 2 * 2 ** o
        g = r.random((gh + 1, gw + 1))
        im = Image.fromarray((g * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC)
        out += np.asarray(im, dtype=float) / 255 * amp
        amp *= 0.5
    return out / out.max()


c = fbm(W, H, seed=5)
mask = np.clip((c - 0.58) * 4.0, 0, 1) * np.clip((t + 0.05) * 6, 0, 1) * np.clip(1.2 - t, 0, 1)
mask = np.asarray(Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(3)), dtype=float)[..., None] / 255
shade = np.array([0.82, 0.88, 0.98])
cloud = np.clip(1.0 - (c[..., None] - 0.55) * 0.9, 0.78, 1.0) * np.array([1, 1, 1]) * 0.55 + shade * 0.45
img = img * (1 - mask) + cloud * mask
# sun glow
sun_la, sun_lo = 0.55, 2.2
d = np.arccos(np.clip(np.sin(LA) * np.sin(sun_la) + np.cos(LA) * np.cos(sun_la) * np.cos(LO - sun_lo), -1, 1))
img += np.array([1.0, 0.85, 0.55]) * (np.exp(-(d / 0.12) ** 2) * 0.9 + np.exp(-(d / 0.5) ** 2) * 0.25)[..., None]
# layered far mountains on the horizon
for k, (amp, col, ph) in enumerate(((0.16, (0.55, 0.68, 0.85), 0.0), (0.11, (0.42, 0.58, 0.78), 1.7), (0.07, (0.32, 0.5, 0.7), 3.1))):
    ridge = amp * (0.5 + 0.5 * np.sin(LO * 7 + ph) * np.sin(LO * 3.3 + ph * 2) + 0.25 * np.sin(LO * 19 + ph))
    m = (LA < ridge * 0.5)[..., None] & (LA > -0.02)[..., None]
    img = np.where(m, np.array(col), img)
Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8)).save(os.path.join(OUT, "sky.png"))
print("sky.png: 2048x1024")
