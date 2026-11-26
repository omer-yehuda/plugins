"""Faces: eyes with pupils, brows, mouths, facial hair, glasses and cartoon mood effects.

Design units, character facing right; head centre (HX, HY), radius HR.
"""
import math

from .colors import INK, WHITE, Color, mix
from .pen import Pen

HX, HY, HR = 300, 330, 200
EYES = (292, 384)            # eye centres x (back eye, front eye)
EY, MX, MY = 318, 344, 424   # eye y, mouth centre
MOUTH = (110, 30, 44)
TONGUE = (236, 110, 122)

# (inner, outer) vertical offsets of each brow end; negative = up
BROWS = {
    "neutral": (0, 0), "happy": (-6, -4), "laughing": (-10, -6), "proud": (-4, -10), "sad": (-16, 10),
    "crying": (-18, 10), "shocked": (-26, -22), "scared": (-22, -2), "angry": (16, -10),
    "furious": (22, -14), "sly": (6, -12), "thinking": (-14, 4),
}


def face_tint(skin: Color, mood: str) -> Color:
    return mix(skin, (214, 40, 52), 0.45) if mood == "furious" else skin


def _eye(p: Pen, ex: float, mood: str, blink: bool, skin: Color) -> None:
    if blink and mood not in ("laughing", "happy", "proud"):
        p.line([(ex - 20, EY), (ex + 20, EY)], INK, 8)
        return
    if mood in ("happy", "laughing", "proud"):
        p.arc((ex - 24, EY - 14, ex + 24, EY + 26), 200, 340, INK, 9)
        return
    big = mood in ("shocked", "scared")
    rx, ry = (34, 40) if big else (27, 33)
    p.ellipse((ex - rx, EY - ry, ex + rx, EY + ry), WHITE, 6)
    pr = 9 if big else 14
    dx, dy = (6, -12) if mood == "thinking" else ((0, 0) if big else (7, 2))
    p.circle(ex + dx, EY + dy, pr, INK)
    p.circle(ex + dx + pr * 0.35, EY + dy - pr * 0.4, max(3, pr * 0.3), WHITE)
    if mood in ("sly", "angry", "furious", "sad", "crying"):
        lid_top = EY - ry - 6
        lid_bot = EY - (4 if mood in ("sly", "angry", "furious") else 12)
        p.rect((ex - rx - 4, lid_top, ex + rx + 4, lid_bot), skin)
        p.line([(ex - rx, lid_bot), (ex + rx, lid_bot)], INK, 6)


def _brow(p: Pen, ex: float, back: bool, mood: str) -> None:
    inner, outer = BROWS.get(mood, BROWS["neutral"])
    by = EY - 56
    if back:   # inner end is on the right
        p.line([(ex - 26, by + outer), (ex + 20, by + inner)], INK, 11)
    else:
        p.line([(ex - 20, by + inner), (ex + 26, by + outer)], INK, 11)


def _mouth(p: Pen, mood: str, open_: bool) -> None:
    x, y = MX, MY
    if mood == "shocked" or (mood == "scared" and open_):
        p.ellipse((x - 22, y - 18, x + 22, y + 34), MOUTH, 6)
    elif mood == "laughing" or (mood == "happy" and open_):
        p.chord((x - 54, y - 40, x + 54, y + 52), 0, 180, MOUTH, 7)
        p.chord((x - 30, y + 14, x + 30, y + 50), 200, 340, TONGUE)
    elif mood in ("angry", "furious"):
        w = 50 if open_ else 42
        p.rect((x - w, y - 18, x + w, y + 18), WHITE, 6, 10)
        for j in range(-2, 3):
            p.line([(x + j * w / 3, y - 15), (x + j * w / 3, y + 15)], INK, 3, round_caps=False)
        p.line([(x - w + 4, y), (x + w - 4, y)], INK, 3, round_caps=False)
    elif open_:
        p.ellipse((x - 24, y - 14, x + 24, y + 24), MOUTH, 6)
        p.ellipse((x - 11, y + 6, x + 11, y + 20), TONGUE)
    elif mood in ("happy", "proud"):
        p.chord((x - 40, y - 30, x + 40, y + 32), 0, 180, MOUTH, 6)
        p.rect((x - 28, y - 1, x + 28, y + 7), WHITE)
    elif mood in ("sad", "crying"):
        p.arc((x - 28, y + 2, x + 28, y + 38), 205, 335, INK, 8)
    elif mood == "sly":
        p.line([(x - 26, y + 8), (x + 4, y + 8), (x + 30, y - 10)], INK, 8)
    elif mood == "scared":
        p.line([(x - 28, y + 4), (x - 14, y - 6), (x, y + 4), (x + 14, y - 6), (x + 28, y + 4)], INK, 6)
    elif mood == "thinking":
        p.line([(x - 4, y + 8), (x + 28, y)], INK, 8)
    else:
        p.line([(x - 20, y + 4), (x + 20, y + 4)], INK, 8)


def _facial_hair(p: Pen, kind: str, hair: Color) -> None:
    if kind == "mustache":
        p.poly([(MX - 48, 404), (MX, 388), (MX + 48, 404), (MX + 40, 420), (MX, 406), (MX - 40, 420)], hair, 4)
    elif kind == "goatee":
        p.rect((MX - 18, 468, MX + 18, 516), hair, 5, 14)
    elif kind == "beard":
        p.chord((HX - HR + 8, HY - 110, HX + HR - 8, HY + HR - 2), 18, 162, hair, 8)


def _effects(p: Pen, mood: str, phase: float) -> None:
    if mood in ("angry", "furious"):
        for sx in (-1, 1):
            for j in range(3):
                r = 22 + j * 8 + 6 * math.sin(phase * 2 + j + sx)
                x, y = HX + sx * (HR + 14 + j * 22), HY - HR + 36 - j * 34
                p.circle(x, y, r, (248, 248, 248), 6)
    elif mood == "scared":
        x, y = HX + HR * 0.88, HY - 80 + 10 * math.sin(phase)
        p.poly([(x, y - 48), (x + 22, y), (x + 16, y + 20), (x - 16, y + 20), (x - 22, y)], (120, 196, 255), 5)
    elif mood == "shocked":
        for a in (-55, -90, -125):
            ca, sa = math.cos(math.radians(a)), math.sin(math.radians(a))
            p.line([(HX + ca * (HR + 24), HY + sa * (HR + 24)), (HX + ca * (HR + 74), HY + sa * (HR + 74))], INK, 10)
    elif mood == "crying":
        for ex in EYES:
            p.rect((ex - 11, EY + 22, ex + 11, EY + 150 + 12 * math.sin(phase + ex)), (110, 186, 255), 4, 9)


def draw_face(p: Pen, look: dict, mood: str, mouth_open: bool, blink: bool, phase: float,
              skin: Color, hair: Color) -> None:
    if look.get("facial_hair") == "beard":
        _facial_hair(p, "beard", hair)
    if mood in ("happy", "laughing", "proud"):
        blush = mix(skin, (255, 120, 140), 0.45)
        for ex in EYES:
            p.ellipse((ex - 26, EY + 44, ex + 26, EY + 70), blush)
    for i, ex in enumerate(EYES):
        _eye(p, ex, mood, blink, skin)
        _brow(p, ex, i == 0, mood)
    _mouth(p, mood, mouth_open)
    if look.get("facial_hair") in ("mustache", "goatee"):
        _facial_hair(p, look["facial_hair"], hair)
    if look.get("glasses"):
        for ex in EYES:
            p.ellipse((ex - 40, EY - 40, ex + 40, EY + 40), None, 7)
        p.line([(EYES[0] + 40, EY), (EYES[1] - 40, EY)], INK, 7)
    _effects(p, mood, phase)
