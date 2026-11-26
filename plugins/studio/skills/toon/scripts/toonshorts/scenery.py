"""Reusable scenery pieces. (x, base) is the bottom-centre in world px; s scales the piece."""
import math

from .colors import INK, Color, shade
from .pen import Pen
from .stage import Stage

OL = 5   # near-layer outline width


def tree(p: Pen, x: float, base: float, s: float, leaf: Color, ol: float = OL) -> None:
    p.rect((x - 16 * s, base - 170 * s, x + 16 * s, base), (122, 82, 48), ol, 6 * s)
    for dx, dy, r in ((0, -260, 110), (-70, -200, 80), (70, -200, 84), (0, -170, 80)):
        p.circle(x + dx * s, base + dy * s, r * s, leaf, ol)
    p.circle(x - 30 * s, base - 290 * s, 34 * s, shade(leaf, 1.18))


def pine(p: Pen, x: float, base: float, s: float, leaf: Color, ol: float = OL) -> None:
    p.rect((x - 12 * s, base - 70 * s, x + 12 * s, base), (110, 72, 42), ol)
    for i in range(3):
        w, y = (120 - i * 30) * s, base - (60 + i * 90) * s
        p.poly([(x - w, y), (x + w, y), (x, y - 150 * s)], shade(leaf, 1 + i * 0.07), ol)


def lamp(st: Stage, x: float, base: float, s: float = 1.0) -> None:
    p = st.near
    p.rect((x - 7 * s, base - 380 * s, x + 7 * s, base), (60, 64, 74), OL)
    p.rect((x - 34 * s, base - 410 * s, x + 34 * s, base - 372 * s), (60, 64, 74), OL, 10)
    st.glow("near", (x - 24 * s, base - 372 * s, x + 24 * s, base - 356 * s), (255, 226, 140))


def building(st: Stage, layer: str, x: float, base: float, w: float, h: float, col: Color,
             ol: float = OL) -> None:
    p = st.pens[layer]
    p.rect((x - w / 2, base - h, x + w / 2, base), col, ol)
    p.rect((x - w / 2 - 8, base - h - 18, x + w / 2 + 8, base - h + 4), shade(col, 0.72), ol)
    cols = max(2, int(w // 70))
    rows = max(2, int((h - 60) // 90))
    gw = w / cols
    for i in range(cols):
        for j in range(rows):
            cx, cy = x - w / 2 + gw * (i + 0.5), base - h + 60 + j * 90
            box = (cx - gw * 0.28, cy - 24, cx + gw * 0.28, cy + 24)
            p.rect(box, (168, 206, 236) if layer == "near" else st.haze((150, 190, 226), 0.3), ol * 0.6, 4)
            if st.rnd.random() < 0.55:
                st.glow(layer, box)
    if layer == "near":
        p.rect((x - 34, base - 110, x + 34, base), shade(col, 0.55), ol, 6)


def house(st: Stage, x: float, base: float, s: float, wall: Color, roof: Color) -> None:
    p = st.near
    w, h = 300 * s, 220 * s
    p.rect((x - w / 2, base - h, x + w / 2, base), wall, OL)
    p.poly([(x - w / 2 - 30 * s, base - h), (x + w / 2 + 30 * s, base - h), (x, base - h - 170 * s)], roof, OL)
    p.rect((x - 30 * s, base - 120 * s, x + 30 * s, base), (138, 92, 54), OL, 6)
    for dx in (-90, 90):
        box = (x + dx * s - 36 * s, base - 170 * s, x + dx * s + 36 * s, base - 100 * s)
        p.rect(box, (176, 214, 240), OL * 0.7, 4)
        st.glow("near", box)


def fence(p: Pen, x0: float, x1: float, base: float, col: Color = (248, 246, 240)) -> None:
    for x in range(int(x0), int(x1), 44):
        p.poly([(x, base), (x + 26, base), (x + 26, base - 90), (x + 13, base - 104), (x, base - 90)], col, 3)
    for y in (base - 70, base - 30):
        p.rect((x0, y - 8, x1, y + 8), col, 3)


def mountain(p: Pen, x: float, base: float, w: float, h: float, col: Color, snow: bool = True) -> None:
    p.poly([(x - w / 2, base), (x, base - h), (x + w / 2, base)], col)
    p.poly([(x, base - h), (x + w / 2, base), (x + w * 0.1, base)], shade(col, 0.85))
    if snow:
        sw = w * 0.16
        p.poly([(x - sw, base - h + h * 0.32), (x, base - h), (x + sw, base - h + h * 0.32),
                (x + sw * 0.3, base - h + h * 0.24), (x - sw * 0.3, base - h + h * 0.3)], (248, 250, 255))


def cactus(p: Pen, x: float, base: float, s: float) -> None:
    g = (86, 160, 86)
    p.rect((x - 26 * s, base - 260 * s, x + 26 * s, base), g, OL, 26 * s)
    p.rect((x - 90 * s, base - 200 * s, x - 50 * s, base - 120 * s), g, OL, 20 * s)
    p.rect((x - 90 * s, base - 140 * s, x - 20 * s, base - 110 * s), g, OL, 14 * s)
    p.rect((x + 50 * s, base - 230 * s, x + 90 * s, base - 150 * s), g, OL, 20 * s)
    p.rect((x + 20 * s, base - 170 * s, x + 90 * s, base - 140 * s), g, OL, 14 * s)


def palm(p: Pen, x: float, base: float, s: float) -> None:
    pts = [(x + math.sin(t / 6) * 40 * s, base - t / 6 * 420 * s) for t in range(7)]
    p.limb(pts, (150, 108, 66), 34 * s, OL)
    tx, ty = pts[-1]
    for a in (-160, -120, -60, -20, 200):
        ca, sa = math.cos(math.radians(a)), math.sin(math.radians(a))
        p.poly([(tx, ty), (tx + ca * 200 * s, ty + sa * 90 * s + 60 * s), (tx + ca * 120 * s, ty + sa * 40 * s)],
               (64, 156, 84), OL)


def crowd_hint(p: Pen, x: float, base: float, n: int, rnd) -> None:
    """tiny background people (silhouette dots) for busy streets"""
    for i in range(n):
        cx = x + i * 46 + rnd.uniform(-8, 8)
        col = rnd.choice([(214, 58, 58), (52, 104, 214), (64, 158, 92), (250, 210, 64)])
        p.rect((cx - 12, base - 54, cx + 12, base), col, 2, 8)
        p.circle(cx, base - 66, 13, (236, 200, 170), 2, INK)
