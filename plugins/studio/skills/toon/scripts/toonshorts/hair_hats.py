"""Hair (behind / on top of the head) and hats. Design units, facing right."""
import math

from .colors import INK, Color, parse, shade
from .face import HR, HX, HY
from .pen import Pen

HEAD_BOX = (HX - HR, HY - HR, HX + HR, HY + HR)


def hair_back(p: Pen, style: str, hair: Color) -> None:
    """parts of the hair drawn before the head"""
    if style == "long":
        p.rect((HX - HR - 22, HY - 60, HX + HR + 22, HY + 260), hair, 9, 110)
    elif style == "ponytail":
        p.ellipse((HX - HR - 70, HY - 40, HX - HR + 50, HY + 190), hair, 9)
    elif style == "curly":
        for i in range(12):
            a = math.pi * (0.98 + i / 11 * 1.04)
            x, y = HX + math.cos(a) * HR * 0.96, HY + math.sin(a) * HR * 0.96
            p.circle(x, y, 56, hair, 8)


def hair_front(p: Pen, style: str, hair: Color) -> None:
    """hair drawn over the head (fringe, cap of hair)"""
    if style in ("short", "long", "ponytail", "bun"):
        p.chord(HEAD_BOX, 192, 348, hair, 9)
        p.poly([(HX + 40, HY - HR + 30), (HX + 150, HY - 92), (HX + 70, HY - 120)], hair)
    elif style == "slick":
        p.chord(HEAD_BOX, 186, 344, hair, 9)
        p.line([(250, HY - 156), (196, HY - 86)], shade(hair, 1.6), 8)
    elif style == "curly":
        p.chord((HX - HR + 10, HY - HR + 10, HX + HR - 10, HY + HR - 10), 198, 342, hair)
    elif style == "spiky":
        pts = []
        for i in range(11):
            a = math.pi * (1.06 + i / 10 * 0.88)
            r = HR * (1.22 if i % 2 else 0.88)
            pts.append((HX + math.cos(a) * r, HY - 24 + math.sin(a) * r))
        p.poly(pts + [(HX + HR * 0.82, HY - 80), (HX - HR * 0.82, HY - 80)], hair, 9)
    if style == "bun":
        p.circle(HX - 10, HY - HR - 30, 52, hair, 9)


def _brim(p: Pen, y: float, half: float, col: Color, depth: float = 26) -> None:
    p.ellipse((HX - half, y - depth, HX + half, y + depth), col, 8)


def draw_hat(p: Pen, look: dict) -> None:
    hat = look.get("hat", "none")
    hc = parse(look.get("hat_color"), (40, 40, 50))
    acc = parse(look.get("accent"), (210, 60, 60))
    top = HY - HR
    if hat == "top_hat":
        p.rect((HX - 92, top - 190, HX + 92, top + 6), hc, 8, 10)
        p.rect((HX - 92, top - 46, HX + 92, top - 12), acc)
        _brim(p, top + 6, 166, hc)
    elif hat == "bowler":
        p.chord((HX - 120, top - 100, HX + 120, top + 130), 180, 360, hc, 8)
        _brim(p, top + 14, 166, hc, 22)
    elif hat == "cap":
        p.chord((HX - HR + 4, top - 30, HX + HR - 4, top + 230), 180, 360, hc, 8)
        p.poly([(HX + 100, top + 74), (HX + 262, top + 74), (HX + 252, top + 106), (HX + 100, top + 106)], hc, 7)
    elif hat == "police":
        p.rect((HX - 162, top - 84, HX + 162, top + 40), hc, 8, 24)
        p.poly([(HX - 170, top + 36), (HX + 170, top + 36), (HX + 226, top + 76), (HX - 176, top + 76)], INK)
        p.circle(HX, top - 22, 20, (248, 208, 72), 4)
    elif hat == "military":
        p.chord((HX - HR - 6, top - 50, HX + HR + 6, top + 210), 180, 360, hc, 8)
        p.rect((HX - HR - 10, top + 64, HX + HR + 10, top + 92), shade(hc, 0.75), 6, 8)
        p.poly([(HX - 14, top - 10), (HX + 14, top - 10), (HX, top + 16)], (248, 208, 72))
    elif hat == "crown":
        pts = [(HX - 120, top + 40), (HX - 120, top - 60), (HX - 60, top - 10), (HX, top - 90),
               (HX + 60, top - 10), (HX + 120, top - 60), (HX + 120, top + 40)]
        p.poly(pts, (244, 194, 56), 8)
        for dx in (-60, 0, 60):
            p.circle(HX + dx, top + 14, 12, (214, 40, 64))
    elif hat == "beret":
        p.ellipse((HX - 180, top - 50, HX + 150, top + 66), hc, 8)
        p.circle(HX - 10, top - 58, 12, hc, 5)
    elif hat == "helmet":
        col = parse(look.get("hat_color"), (96, 116, 74))
        p.chord((HX - HR - 12, top - 40, HX + HR + 12, top + 240), 180, 360, col, 8)
        p.rect((HX - HR - 24, top + 92, HX + HR + 24, top + 118), shade(col, 0.8), 7, 8)
    elif hat == "chef":
        for dx in (-90, 0, 90):
            p.circle(HX + dx, top - 90, 72, (250, 250, 250), 8)
        p.rect((HX - 104, top - 90, HX + 104, top + 30), (250, 250, 250), 8, 10)
    elif hat == "cowboy":
        p.chord((HX - 110, top - 120, HX + 110, top + 120), 180, 360, hc, 8)
        p.rect((HX - 108, top - 26, HX + 108, top), acc)
        _brim(p, top + 10, 228, hc, 34)
    elif hat == "headscarf":
        p.chord((HX - HR - 28, HY - HR - 28, HX + HR + 28, HY + HR + 28), 196, 344, hc, 9)


def headscarf_back(p: Pen, look: dict) -> None:
    """the scarf that frames the face and drapes over the shoulders (drawn before the head)"""
    hc = parse(look.get("hat_color"), (40, 40, 50))
    p.poly([(HX - HR - 10, HY), (HX + HR + 10, HY), (HX + HR + 40, HY + 290), (HX - HR - 40, HY + 290)], hc, 9)
    p.ellipse((HX - HR - 30, HY - HR - 30, HX + HR + 30, HY + HR + 50), hc, 9)
