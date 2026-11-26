"""Props: every item is drawn centred at (cx, cy), about s units wide, thick outline, flat shading."""
import math
from functools import lru_cache

from PIL import Image

from .colors import INK
from .pen import Pen, canvas
from .props_more import draw_more

GOLD, GOLD_HI = (244, 192, 56), (255, 222, 110)
CASH, CASH_HI = (98, 178, 98), (156, 216, 146)
PAPER = (248, 242, 224)
RED = (214, 52, 52)
BLUE = (52, 112, 230)


def _paper(p: Pen, cx, cy, s, o, label, kind):
    h = s / 2
    p.rect((cx - s * 0.38, cy - h, cx + s * 0.38, cy + h), PAPER if kind != "map" else (234, 212, 160), o, s * 0.03)
    if kind == "map":
        p.line([(cx - s * 0.26, cy + s * 0.3), (cx - s * 0.08, cy - s * 0.02), (cx + s * 0.08, cy + s * 0.12),
                (cx + s * 0.22, cy - s * 0.22)], RED, o * 0.8)
        p.text((cx + s * 0.22, cy - s * 0.27), "X", s * 0.2, RED, 900)
        return
    if kind == "newspaper":
        p.text((cx, cy - s * 0.4), "NEWS", s * 0.08, INK, 900)
        words, lines, cur = (label or "BREAKING").split(), [], ""
        for w in words:
            if cur and len(cur) + len(w) > 10:
                lines.append(cur)
                cur = w
            else:
                cur = f"{cur} {w}".strip()
        lines.append(cur)
        for i, ln in enumerate(lines[:3]):
            p.text((cx, cy - s * 0.25 + i * s * 0.13), ln.upper(), s * 0.11, INK, 900)
        start = cy - s * 0.25 + len(lines[:3]) * s * 0.13
    else:
        if label:
            p.text((cx, cy - s * 0.36), label.upper()[:12], s * 0.08, INK, 900)
        start = cy - s * 0.22
        p.circle(cx + s * 0.2, cy + s * 0.36, s * 0.08, RED, o * 0.6)
    y = start
    while y < cy + h - s * 0.16:
        p.line([(cx - s * 0.28, y), (cx + s * 0.28, y)], (168, 160, 140), o * 0.5)
        y += s * 0.08


def draw_item(p: Pen, kind: str, cx: float, cy: float, s: float, label: str = "") -> None:
    o = max(3.0, s * 0.035)
    h = s / 2
    if kind == "money":
        for i in range(3):
            dx, dy = -i * s * 0.06, -i * s * 0.07
            p.rect((cx - h + dx, cy - s * 0.25 + dy, cx + h + dx, cy + s * 0.25 + dy), CASH, o, s * 0.04)
            p.ellipse((cx - s * 0.13 + dx, cy - s * 0.13 + dy, cx + s * 0.13 + dx, cy + s * 0.13 + dy), CASH_HI)
        p.text((cx - s * 0.12, cy - s * 0.14), "$", s * 0.28, (34, 96, 46), 900)
    elif kind == "bag":
        p.ellipse((cx - h, cy - s * 0.22, cx + h, cy + s * 0.62), (212, 170, 108), o)
        p.rect((cx - s * 0.2, cy - s * 0.36, cx + s * 0.2, cy - s * 0.16), (130, 86, 44), o * 0.7, s * 0.05)
        p.text((cx, cy + s * 0.22), "$", s * 0.4, (112, 72, 30), 900)
    elif kind == "letter":
        p.rect((cx - h, cy - s * 0.32, cx + h, cy + s * 0.32), PAPER, o)
        p.line([(cx - h, cy - s * 0.32), (cx, cy + s * 0.06), (cx + h, cy - s * 0.32)], INK, o, False)
        p.circle(cx, cy + s * 0.05, s * 0.09, RED, o * 0.6)
    elif kind in ("document", "newspaper", "map"):
        _paper(p, cx, cy, s, o, label, kind)
    elif kind == "sign":
        p.rect((cx - s * 0.04, cy, cx + s * 0.04, cy + s * 0.8), (124, 82, 46), o)
        p.rect((cx - h, cy - s * 0.3, cx + h, cy + s * 0.16), (204, 152, 96), o, s * 0.03)
        p.text((cx, cy - s * 0.07), (label or "SIGN").upper()[:14], s * 0.12, INK, 900)
    elif kind == "book":
        p.rect((cx - s * 0.36, cy - h, cx + s * 0.36, cy + h), (156, 44, 56), o, s * 0.04)
        p.rect((cx - s * 0.24, cy - h + s * 0.12, cx + s * 0.24, cy - h + s * 0.26), GOLD)
    elif kind == "gold":
        for dx, dy in ((-0.22, 0.12), (0.22, 0.12), (0, -0.1)):
            x, y = cx + dx * s, cy + dy * s
            p.poly([(x - s * 0.2, y + s * 0.1), (x + s * 0.2, y + s * 0.1), (x + s * 0.14, y - s * 0.1),
                    (x - s * 0.14, y - s * 0.1)], GOLD, o)
            p.line([(x - s * 0.08, y - s * 0.04), (x + s * 0.06, y - s * 0.04)], GOLD_HI, o * 0.8)
    elif kind == "crown":
        p.poly([(cx - h, cy + s * 0.25), (cx - h, cy - s * 0.2), (cx - s * 0.25, cy), (cx, cy - s * 0.32),
                (cx + s * 0.25, cy), (cx + h, cy - s * 0.2), (cx + h, cy + s * 0.25)], GOLD, o)
        for dx in (-0.25, 0, 0.25):
            p.circle(cx + dx * s, cy + s * 0.12, s * 0.05, (214, 40, 64))
    elif kind == "coin":
        p.circle(cx, cy, h, GOLD, o)
        p.circle(cx, cy, h * 0.72, GOLD_HI, o * 0.5)
        p.text((cx, cy), "$", s * 0.5, (176, 124, 30), 900)
    elif kind == "clock":
        p.circle(cx, cy, h, (252, 250, 242), o * 1.4)
        for i in range(12):
            a = i / 12 * math.tau
            p.line([(cx + math.cos(a) * h * 0.76, cy + math.sin(a) * h * 0.76),
                    (cx + math.cos(a) * h * 0.88, cy + math.sin(a) * h * 0.88)], INK, o * 0.7)
        p.line([(cx, cy), (cx, cy - h * 0.6)], INK, o * 1.2)
        p.line([(cx, cy), (cx + h * 0.45, cy + h * 0.1)], INK, o * 1.2)
    elif kind == "lightbulb":
        p.circle(cx, cy - s * 0.12, s * 0.34, (255, 224, 84), o)
        p.rect((cx - s * 0.15, cy + s * 0.16, cx + s * 0.15, cy + s * 0.4), (164, 164, 174), o, s * 0.03)
        for a in (-150, -110, -70, -30):
            ca, sa = math.cos(math.radians(a)), math.sin(math.radians(a))
            p.line([(cx + ca * s * 0.44, cy - s * 0.12 + sa * s * 0.44),
                    (cx + ca * s * 0.56, cy - s * 0.12 + sa * s * 0.56)], (255, 200, 40), o)
    elif kind in ("question", "exclamation"):
        p.text((cx, cy), "?" if kind == "question" else "!", s * 1.2, (255, 206, 0), 900, stroke=s * 0.06)
    elif kind in ("heart", "star"):
        _shape(p, kind, cx, cy, s, o)
    else:
        draw_more(p, kind, cx, cy, s, o, label)


def _shape(p: Pen, kind: str, cx, cy, s, o) -> None:
    if kind == "heart":
        pts = [(cx + s * 0.5 * 16 * math.sin(t) ** 3 / 17,
                cy - s * 0.5 * (13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)) / 17)
               for t in (i / 40 * math.tau for i in range(40))]
        p.poly(pts, (236, 64, 96), o)
    else:
        pts = []
        for i in range(10):
            r = s * (0.5 if i % 2 == 0 else 0.22)
            a = -math.pi / 2 + i * math.pi / 5
            pts.append((cx + math.cos(a) * r, cy + math.sin(a) * r))
        p.poly(pts, (255, 210, 50), o)


@lru_cache(128)
def prop_image(kind: str, size: int, label: str) -> Image.Image:
    img, p = canvas(400, 400, 2)
    draw_item(p, kind, 200, 200, 320, label)
    return img.resize((size, size), Image.Resampling.LANCZOS)

