"""Chibi toon characters: big head, rounded body, outlined tube limbs, skin tones, 12 moods.

Design canvas CW x CH units, feet at FOOT, drawn facing right then mirrored for 'left'.
"""
import json
import math
from functools import lru_cache

from PIL import Image

from .colors import INK, SKIN, parse, shade
from .face import HX, HY, HR, draw_face, face_tint
from .hair_hats import draw_hat, hair_back, hair_front, headscarf_back
from .pen import Pen, canvas
from .props import draw_item

CW, CH, FOOT = 620, 1120, 1050
SB, SF = (226, 566), (374, 566)          # shoulders (back, front)
HIPS = ((268, 800), (332, 800))
ARM_W, LEG_W = 30, 36
# elbow, hand for back and front arm per pose (facing right)
ARMS = {
    "stand": ((206, 676), (200, 776), (394, 676), (400, 776)),
    "point": ((206, 676), (200, 776), (470, 540), (566, 500)),
    "arms_up": ((170, 470), (150, 368), (430, 470), (450, 368)),
    "think": ((206, 676), (200, 776), (446, 650), (380, 520)),
    "hands_hips": ((150, 660), (234, 770), (450, 660), (366, 770)),
    "wave": ((206, 676), (200, 776), (466, 520), (494, 396)),
    "hold": ((206, 676), (200, 776), (444, 690), (504, 640)),
    "shrug": ((162, 600), (136, 506), (438, 600), (464, 506)),
    "facepalm": ((206, 676), (200, 776), (446, 600), (372, 330)),
    "walk": ((206, 676), (200, 776), (394, 676), (400, 776)),
    "run": ((180, 640), (230, 560), (430, 640), (380, 720)),
}


def _arm(p: Pen, shoulder, elbow, hand, sleeve, skin) -> None:
    p.limb([shoulder, elbow, hand], sleeve, ARM_W, 6)
    p.circle(hand[0], hand[1], 24, skin, 6)


def _legs(p: Pen, look: dict, pose: str, wob: float) -> None:
    if look.get("outfit") == "robe":
        return
    pants = parse(look.get("pants"), (52, 58, 84))
    stride = 90 if pose == "run" else 64
    if pose in ("walk", "run"):
        feet = ((300 - wob * stride, 1020), (300 + wob * stride, 1020))
    else:
        feet = ((256, 1020), (344, 1020))
    for hip, ft in zip(HIPS, feet):
        p.limb([hip, ft], pants, LEG_W, 6)
    for ft in feet:
        p.ellipse((ft[0] - 26, ft[1] - 20, ft[0] + 52, ft[1] + 20), (36, 32, 40), 4)


def _body(p: Pen, look: dict) -> None:
    outfit = look.get("outfit", "shirt")
    oc = parse(look.get("outfit_color"), (250, 200, 60))
    acc = parse(look.get("accent"), (214, 60, 60))
    if outfit == "dress":
        p.poly([(236, 530), (364, 530), (428, 880), (172, 880)], oc, 9)
        p.rect((238, 660, 362, 686), acc)
        return
    if outfit == "robe":
        p.poly([(232, 530), (368, 530), (414, 1040), (186, 1040)], oc, 9)
        p.poly([(286, 532), (314, 532), (364, 1036), (332, 1038)], acc)
        return
    bottom = 870 if outfit == "coat" else 818
    p.rect((214, 520, 386, bottom), oc, 9, 56)
    if outfit in ("suit", "coat"):
        p.poly([(262, 528), (338, 528), (300, 624)], (250, 250, 250))
        p.poly([(292, 540), (308, 540), (316, 660), (300, 684), (284, 660)], acc, 3)
        p.line([(258, 528), (300, 660), (342, 528)], shade(oc, 0.55), 6)
        for i in range(3 if outfit == "coat" else 2):
            p.circle(328, 700 + i * 52, 9, shade(oc, 0.5))
    elif outfit == "uniform":
        for i in range(4):
            p.circle(300, 572 + i * 50, 10, (248, 208, 72), 3)
        p.rect((214, 740, 386, 766), shade(oc, 0.5))
        p.rect((284, 736, 316, 770), (248, 208, 72), 3)
        for x in (214, 330):
            p.rect((x, 520, x + 56, 540), (248, 208, 72), 3, 6)
    elif outfit == "hoodie":
        p.rect((248, 700, 352, 770), shade(oc, 0.85), 5, 18)
        for x in (284, 316):
            p.line([(x, 540), (x, 620)], (250, 250, 250), 6)
    else:
        p.poly([(266, 526), (300, 562), (334, 526)], shade(oc, 0.8), 5)


def draw_character(look: dict, mood: str, mouth_open: bool, blink: bool, phase: float) -> Image.Image:
    img, p = canvas(CW, CH, 2)
    skin = face_tint(parse(look.get("skin"), SKIN["light"]), mood)
    hair = parse(look.get("hair"), (72, 46, 30))
    oc = parse(look.get("outfit_color"), (250, 200, 60))
    style = "bald" if look.get("hat") == "headscarf" else look.get("hair_style", "short")
    pose = look.get("pose", "stand")
    be, bh, fe, fh = ARMS.get(pose, ARMS["stand"])
    wob = math.sin(phase)
    if pose == "wave":
        fh = (fh[0] + wob * 28, fh[1] - abs(wob) * 8)
    elif pose in ("walk", "run"):
        swing = 80 if pose == "run" else 60
        bh = (bh[0] - wob * swing, bh[1])
        fh = (fh[0] + wob * swing, fh[1])
    if look.get("outfit") == "hoodie":
        p.circle(HX, HY + 60, HR + 18, shade(oc, 0.85), 9)
    if look.get("hat") == "headscarf":
        headscarf_back(p, look)
    hair_back(p, style, hair)
    _arm(p, SB, be, bh, shade(oc, 0.9), skin)
    _legs(p, look, pose, wob)
    _body(p, look)
    if pose != "facepalm":
        _arm(p, SF, fe, fh, oc, skin)
    held = look.get("holding", "none")
    if held and held != "none" and pose != "facepalm":
        big = held in ("newspaper", "document", "sign", "map")
        draw_item(p, held, fh[0] + (72 if big else 36), fh[1] - (72 if big else 28), 240 if big else 170,
                  str(look.get("label", "")))
        p.circle(fh[0], fh[1], 24, skin, 6)
    p.circle(HX - HR + 20, HY + 16, 34, skin, 8)          # ear (back side)
    p.circle(HX, HY, HR, skin, 10)
    hair_front(p, style, hair)
    draw_face(p, look, mood, mouth_open, blink, phase, skin, hair)
    draw_hat(p, look)
    if pose == "facepalm":
        _arm(p, SF, fe, fh, oc, skin)
    if look.get("facing", "right") == "left":
        img = img.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    return img.resize((CW, CH), Image.Resampling.LANCZOS)


@lru_cache(512)
def sprite(look_json: str, mood: str, mouth_open: bool, blink: bool, phase_q: int, scale_pct: int) -> Image.Image:
    img = draw_character(json.loads(look_json), mood, mouth_open, blink, phase_q / 8 * math.tau)
    if scale_pct != 100:
        s = scale_pct / 100
        img = img.resize((max(1, int(CW * s)), max(1, int(CH * s))), Image.Resampling.LANCZOS)
    return img


@lru_cache(256)
def extent(look_json: str, mood: str, scale_pct: int) -> tuple[int, int, int, int]:
    """visible bbox across animation phases, so edge-clamping never jitters"""
    boxes = [b for ph in (0, 2, 4, 6) if (b := sprite(look_json, mood, False, False, ph, scale_pct).getbbox())]
    if not boxes:
        return (0, 0, int(CW * scale_pct / 100), int(CH * scale_pct / 100))
    return (min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes))


__all__ = ["CW", "CH", "FOOT", "INK", "draw_character", "sprite", "extent"]
