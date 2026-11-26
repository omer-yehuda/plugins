"""Generic landmarks drawn on the mid layer (outdoor sets only)."""
from .colors import shade
from .scenery import mountain
from .stage import HZ, Stage

OL = 4


def landmark(st: Stage, kind: str, x: float) -> None:
    p, base = st.mid, HZ + 40
    if kind == "lattice_tower":
        col = st.haze((132, 98, 66), 0.2)
        h = 980
        for side in (-1, 1):
            p.line([(x + side * 190, base), (x + side * 70, base - h * 0.45), (x + side * 18, base - h)], col, 22)
        for frac, half in ((0.18, 150), (0.45, 70), (0.7, 40)):
            y = base - h * frac
            p.rect((x - half - 20, y - 16, x + half + 20, y + 16), col, 0)
        for i in range(10):
            y0, y1 = base - h * i / 10, base - h * (i + 1) / 10
            w0, w1 = 190 * (1 - i / 10) ** 1.5 + 18, 190 * (1 - (i + 1) / 10) ** 1.5 + 18
            p.line([(x - w0, y0), (x + w1, y1)], col, 6)
            p.line([(x + w0, y0), (x - w1, y1)], col, 6)
        p.line([(x, base - h), (x, base - h - 80)], col, 8)
    elif kind == "pyramid":
        col = st.haze((228, 192, 126), 0.25)
        p.poly([(x - 420, base), (x, base - 520), (x + 420, base)], col)
        p.poly([(x, base - 520), (x + 420, base), (x + 80, base)], shade(col, 0.82))
        for i in range(1, 9):
            y = base - 520 * i / 9
            w = 420 * (1 - i / 9)
            p.line([(x - w, y), (x + w, y)], shade(col, 0.9), 3)
    elif kind == "castle":
        col = st.haze((176, 170, 166), 0.25)
        p.rect((x - 260, base - 340, x + 260, base), col, OL)
        for i in range(9):
            p.rect((x - 250 + i * 60, base - 380, x - 214 + i * 60, base - 340), col, OL)
        for side in (-1, 1):
            tx = x + side * 280
            p.rect((tx - 70, base - 560, tx + 70, base), shade(col, 0.95), OL)
            p.poly([(tx - 90, base - 560), (tx + 90, base - 560), (tx, base - 720)], st.haze((64, 76, 150), 0.2), OL)
            p.line([(tx, base - 720), (tx, base - 800)], (60, 60, 60), 5)
            p.poly([(tx, base - 800), (tx + 60, base - 780), (tx, base - 760)], (214, 52, 52))
        p.chord((x - 70, base - 200, x + 70, base + 60), 180, 360, (90, 60, 36), OL)
    elif kind == "lighthouse":
        h = 760
        for i in range(6):
            y0, y1 = base - h * i / 6, base - h * (i + 1) / 6
            w0, w1 = 90 - i * 8, 90 - (i + 1) * 8
            col = (226, 56, 56) if i % 2 == 0 else (246, 246, 246)
            p.poly([(x - w0, y0), (x + w0, y0), (x + w1, y1), (x - w1, y1)], st.haze(col, 0.15))
        p.rect((x - 54, base - h - 110, x + 54, base - h), (255, 232, 150), OL)
        p.chord((x - 70, base - h - 190, x + 70, base - h - 60), 180, 360, (50, 50, 56), OL)
        st.glow("mid", (x - 40, base - h - 100, x + 40, base - h - 10), (255, 240, 170))
    elif kind == "clock_tower":
        col = st.haze((196, 164, 122), 0.2)
        p.rect((x - 110, base - 860, x + 110, base), col, OL)
        p.poly([(x - 130, base - 860), (x + 130, base - 860), (x, base - 1060)], st.haze((72, 116, 96), 0.2), OL)
        p.circle(x, base - 700, 84, (250, 246, 228), OL)
        p.line([(x, base - 700), (x, base - 762)], (30, 30, 30), 8)
        p.line([(x, base - 700), (x + 44, base - 688)], (30, 30, 30), 8)
    elif kind == "volcano":
        col = st.haze((120, 92, 84), 0.25)
        mountain(p, x, base + 40, 900, 620, col, snow=False)
        p.poly([(x - 80, base - 560), (x + 80, base - 560), (x + 40, base - 600), (x - 40, base - 600)], (248, 112, 40))
        for i, r in enumerate((60, 80, 100)):
            p.circle(x + i * 40, base - 680 - i * 110, r, st.haze((120, 120, 126), 0.3))
