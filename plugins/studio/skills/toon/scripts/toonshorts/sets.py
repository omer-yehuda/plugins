"""Build a set: background parallax layers + an optional foreground overlay drawn over the cast."""
from PIL import Image

from . import GY, WH, WW
from .colors import shade
from .interiors import SETS_A
from .interiors2 import set_bank, set_classroom, set_lab, set_shop
from .landmarks import landmark
from .pen import Pen
from .scenery import OL
from .sets_town import TOWN
from .sets_wild import WILD
from .spec import INDOOR
from .stage import K, Stage

SETS = {**TOWN, **WILD, **SETS_A, "lab": set_lab, "bank": set_bank, "shop": set_shop, "classroom": set_classroom}


def build(spec: dict, seed: int) -> dict[str, Image.Image]:
    """-> {'far', 'mid', 'near'} RGBA world-sized layers"""
    place = spec.get("place", "city")
    if place not in SETS:
        place = "city"
    st = Stage(time=spec.get("time", "day"), seed=seed)
    SETS[place](st)
    lm = spec.get("landmark", "none")
    if lm and lm != "none" and place not in INDOOR:
        landmark(st, lm, WW * float(spec.get("landmark_x", 0.72)))
    return st.finish()


def front(kind: str | None, seed: int, crowd_fn=None) -> Image.Image | None:
    """foreground overlay (bars, desk, crowd, bushes) in world px, drawn over the characters"""
    if not kind or kind == "none":
        return None
    if kind == "crowd" and crowd_fn:
        return crowd_fn(seed)
    img = Image.new("RGBA", (WW * K, WH * K), (0, 0, 0, 0))
    p = Pen(img, K)
    if kind == "bars":
        for x in range(60, WW, 150):
            p.rect((x, 0, x + 34, WH), (58, 60, 68), OL)
            p.rect((x + 7, 0, x + 13, WH), (140, 142, 152))
        for y in (WH * 0.2, WH * 0.88):
            p.rect((0, y, WW, y + 36), (58, 60, 68), OL)
    elif kind == "desk":
        top = GY - 260
        p.rect((-20, top, WW + 20, top + 50), (148, 98, 58), OL, 10)
        p.rect((40, top + 50, WW - 40, WH + 20), shade((148, 98, 58), 0.82), OL)
        for x in (WW * 0.3, WW * 0.7):
            p.rect((x - 120, top + 110, x + 120, top + 200), shade((148, 98, 58), 0.7), OL, 8)
            p.circle(x, top + 155, 12, (226, 194, 86))
    elif kind == "bushes":
        for i in range(12):
            x = i * 130 - 20
            p.circle(x, WH - 120 + (i % 3) * 30, 150, (60 + (i % 3) * 14, 150, 70), OL)
    return img.resize((WW, WH), Image.Resampling.LANCZOS)
