"""More props: vehicles, tools and treasure (same contract as props.draw_item)."""
from .colors import INK
from .pen import Pen

GOLD = (244, 192, 56)
STEEL = (156, 160, 172)


def draw_more(p: Pen, kind: str, cx: float, cy: float, s: float, o: float, label: str = "") -> None:
    h = s / 2
    if kind == "handcuffs":
        for dx in (-0.22, 0.22):
            p.ellipse((cx + dx * s - s * 0.2, cy - s * 0.2, cx + dx * s + s * 0.2, cy + s * 0.2), None, o * 2.4, STEEL)
        p.line([(cx - s * 0.04, cy), (cx + s * 0.04, cy)], (96, 96, 106), o * 2)
    elif kind == "ship":
        p.poly([(cx - h, cy + s * 0.1), (cx + h, cy + s * 0.1), (cx + s * 0.36, cy + s * 0.34),
                (cx - s * 0.36, cy + s * 0.34)], (126, 74, 42), o)
        p.rect((cx - s * 0.02, cy - h, cx + s * 0.02, cy + s * 0.1), (96, 62, 40), o * 0.5)
        p.poly([(cx + s * 0.04, cy - s * 0.44), (cx + s * 0.38, cy + s * 0.04), (cx + s * 0.04, cy + s * 0.04)],
               (250, 246, 232), o)
        p.poly([(cx - s * 0.04, cy - s * 0.34), (cx - s * 0.3, cy + s * 0.04), (cx - s * 0.04, cy + s * 0.04)],
               (250, 246, 232), o)
    elif kind == "car":
        p.rect((cx - h, cy - s * 0.04, cx + h, cy + s * 0.2), (214, 52, 52), o, s * 0.06)
        p.rect((cx - s * 0.24, cy - s * 0.27, cx + s * 0.22, cy), (214, 52, 52), o, s * 0.06)
        p.rect((cx - s * 0.17, cy - s * 0.21, cx + s * 0.15, cy - s * 0.04), (190, 224, 244), o * 0.6, s * 0.02)
        for dx in (-0.3, 0.3):
            p.circle(cx + dx * s, cy + s * 0.22, s * 0.12, (34, 34, 38), o)
            p.circle(cx + dx * s, cy + s * 0.22, s * 0.05, STEEL)
    elif kind == "plane":
        p.ellipse((cx - h, cy - s * 0.09, cx + h, cy + s * 0.09), (236, 240, 246), o)
        p.poly([(cx - s * 0.06, cy), (cx + s * 0.14, cy), (cx - s * 0.02, cy + s * 0.42), (cx - s * 0.16, cy + s * 0.42)],
               (52, 112, 230), o)
        p.poly([(cx - s * 0.06, cy), (cx + s * 0.14, cy), (cx - s * 0.02, cy - s * 0.42), (cx - s * 0.16, cy - s * 0.42)],
               (52, 112, 230), o)
        p.poly([(cx - h + s * 0.04, cy), (cx - h - s * 0.04, cy - s * 0.2), (cx - h + s * 0.12, cy - s * 0.02)],
               (52, 112, 230), o)
    elif kind == "rocket":
        p.ellipse((cx - s * 0.16, cy - h, cx + s * 0.16, cy + s * 0.3), (240, 240, 244), o)
        p.circle(cx, cy - s * 0.12, s * 0.07, (120, 196, 255), o * 0.6)
        for sx in (-1, 1):
            p.poly([(cx + sx * s * 0.14, cy + s * 0.05), (cx + sx * s * 0.3, cy + s * 0.32),
                    (cx + sx * s * 0.12, cy + s * 0.26)], (214, 52, 52), o)
        p.poly([(cx - s * 0.1, cy + s * 0.3), (cx + s * 0.1, cy + s * 0.3), (cx, cy + h)], (255, 160, 40), o * 0.6)
    elif kind == "key":
        p.ellipse((cx - h, cy - s * 0.2, cx - s * 0.1, cy + s * 0.2), None, o * 2.6, GOLD)
        p.line([(cx - s * 0.1, cy), (cx + h, cy)], GOLD, o * 2.6)
        for dx, dh in ((0.3, 0.14), (0.44, 0.12)):
            p.line([(cx + s * dx, cy), (cx + s * dx, cy + s * dh)], GOLD, o * 2.6)
    elif kind == "chest":
        p.rect((cx - h, cy - s * 0.1, cx + h, cy + s * 0.32), (136, 84, 42), o)
        p.chord((cx - h, cy - s * 0.4, cx + h, cy + s * 0.2), 180, 360, (156, 98, 52), o)
        for dx in (-0.32, 0.32):
            p.rect((cx + dx * s - s * 0.04, cy - s * 0.1, cx + dx * s + s * 0.04, cy + s * 0.32), GOLD)
        p.rect((cx - s * 0.06, cy - s * 0.08, cx + s * 0.06, cy + s * 0.06), GOLD, o * 0.5)
    elif kind == "torch":
        p.line([(cx, cy - s * 0.08), (cx, cy + h * 1.3)], (116, 72, 36), o * 2.6)
        p.ellipse((cx - s * 0.18, cy - h, cx + s * 0.18, cy + s * 0.02), (252, 150, 40), o * 0.6)
        p.ellipse((cx - s * 0.09, cy - s * 0.32, cx + s * 0.09, cy - s * 0.04), (255, 228, 96))
    elif kind == "diamond":
        p.poly([(cx - h, cy - s * 0.1), (cx - s * 0.25, cy - s * 0.35), (cx + s * 0.25, cy - s * 0.35),
                (cx + h, cy - s * 0.1), (cx, cy + h)], (124, 204, 255), o)
        p.line([(cx - h, cy - s * 0.1), (cx + h, cy - s * 0.1)], INK, o * 0.6)
        p.line([(cx - s * 0.12, cy - s * 0.1), (cx, cy + h * 0.9), (cx + s * 0.12, cy - s * 0.1)], INK, o * 0.5)
    elif kind == "phone":
        p.rect((cx - s * 0.2, cy - h, cx + s * 0.2, cy + h), (34, 34, 40), o, s * 0.06)
        p.rect((cx - s * 0.15, cy - h + s * 0.08, cx + s * 0.15, cy + h - s * 0.1), (96, 176, 255), 0, s * 0.03)
        if label:
            p.text((cx, cy), label.upper()[:6], s * 0.08, (255, 255, 255), 900)
    elif kind == "trophy":
        p.chord((cx - s * 0.3, cy - h, cx + s * 0.3, cy + s * 0.1), 0, 180, GOLD, o)
        p.rect((cx - s * 0.3, cy - h, cx + s * 0.3, cy - s * 0.18), GOLD, o)
        for sx in (-1, 1):
            p.ellipse((cx + sx * s * 0.3 - s * 0.12, cy - s * 0.4, cx + sx * s * 0.3 + s * 0.12, cy - s * 0.12),
                      None, o * 1.4, GOLD)
        p.rect((cx - s * 0.05, cy + s * 0.05, cx + s * 0.05, cy + s * 0.3), GOLD, o * 0.6)
        p.rect((cx - s * 0.22, cy + s * 0.3, cx + s * 0.22, cy + h), (120, 78, 44), o, s * 0.03)
