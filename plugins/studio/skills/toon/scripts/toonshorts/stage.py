"""A Stage is a set split into parallax layers: far (sky), mid (distance) and near (ground, props).

Each layer is drawn at 2x on a world-sized canvas and graded for the time of day. The camera
crops every layer with its own parallax factor, so camera moves reveal depth.
"""
import random
from dataclasses import dataclass, field

import numpy as np
from PIL import Image

from . import WH, WW
from .colors import Color, mix
from .pen import Pen

K = 2                         # supersampling while drawing
HZ = int(WH * 0.6)            # outdoor horizon line (world px)
PARALLAX = {"far": 0.25, "mid": 0.6, "near": 1.0}

# time: sky top, sky bottom, sun/moon colour, grade multiply, grade add, lights on
TIME = {
    "day": ((86, 160, 240), (196, 228, 252), (255, 246, 200), (1.0, 1.0, 1.0), (0, 0, 0), False),
    "sunset": ((92, 82, 168), (255, 168, 116), (255, 214, 140), (1.04, 0.9, 0.84), (14, 0, 0), True),
    "dawn": ((126, 160, 226), (255, 206, 182), (255, 236, 200), (1.0, 0.96, 0.95), (8, 4, 6), False),
    "night": ((12, 18, 52), (44, 60, 116), (244, 244, 226), (0.5, 0.56, 0.78), (0, 4, 18), True),
    "storm": ((70, 76, 92), (138, 146, 158), (200, 204, 214), (0.74, 0.78, 0.84), (6, 8, 14), False),
}


@dataclass
class Stage:
    time: str = "day"
    seed: int = 1
    indoor: bool = False
    layers: dict = field(default_factory=dict)
    pens: dict = field(default_factory=dict)
    windows: list = field(default_factory=list)   # glowing rects drawn after grading (night lights)

    def __post_init__(self):
        if self.time not in TIME:
            self.time = "day"
        self.rnd = random.Random(self.seed)
        for name in PARALLAX:
            img = Image.new("RGBA", (WW * K, WH * K), (0, 0, 0, 0))
            self.layers[name] = img
            self.pens[name] = Pen(img, K)

    @property
    def far(self) -> Pen:
        return self.pens["far"]

    @property
    def mid(self) -> Pen:
        return self.pens["mid"]

    @property
    def near(self) -> Pen:
        return self.pens["near"]

    @property
    def lights_on(self) -> bool:
        return TIME[self.time][5]

    def haze(self, c: Color, amount: float) -> Color:
        """atmospheric perspective: push a colour toward the horizon sky"""
        return mix(c, TIME[self.time][1], amount)

    def glow(self, layer: str, box, color: Color = (255, 214, 120)) -> None:
        """a window/lamp that stays bright at night (skips the darkening grade)"""
        self.windows.append((layer, box, color))

    def finish(self) -> dict[str, Image.Image]:
        _, _, _, mul, add, lights = TIME[self.time]
        luts = [[max(0, min(255, int(v * mul[c] + add[c]))) for v in range(256)] for c in range(3)]
        out = {}
        for name, img in self.layers.items():
            small = img.resize((WW, WH), Image.Resampling.LANCZOS)
            r, g, b, a = small.split()
            graded = Image.merge("RGBA", (r.point(luts[0]), g.point(luts[1]), b.point(luts[2]), a))
            pen = Pen(graded, 1)
            for layer, box, color in self.windows:
                if layer == name and lights:
                    pen.rect(box, color)
            out[name] = graded
        self.layers.clear()
        return out


def gradient(w: int, h: int, top: Color, bottom: Color) -> Image.Image:
    t = np.linspace(0, 1, h, dtype=np.float32)[:, None, None]
    arr = np.array(top, np.float32) * (1 - t) + np.array(bottom, np.float32) * t
    rgb = np.repeat(arr, w, axis=1).astype(np.uint8)
    return Image.fromarray(np.dstack([rgb, np.full((h, w), 255, np.uint8)]), "RGBA")


def sky(st: Stage, stars: bool = False, clouds: int = 5, sun: bool = True) -> None:
    top, bottom, body = TIME[st.time][:3]
    st.layers["far"].paste(gradient(WW * K, WH * K, top, bottom), (0, 0))
    p, r = st.far, st.rnd
    if st.time in ("night",) or stars:
        for _ in range(140):
            x, y = r.uniform(0, WW), r.uniform(0, HZ * 0.9)
            p.circle(x, y, r.choice((1.5, 2, 3)), (255, 255, 240))
    if sun and st.time != "storm":
        x, y = (WW * 0.74, HZ * 0.3) if st.time != "sunset" else (WW * 0.3, HZ * 0.82)
        rad = 70 if st.time == "night" else 96
        p.circle(x, y, rad * 1.6, mix(body, bottom, 0.7))
        p.circle(x, y, rad, body)
        if st.time == "night":
            p.circle(x + 30, y - 18, rad * 0.86, mix(top, bottom, 0.25))
    cloud_col = {"storm": (110, 116, 128), "night": (60, 72, 112)}.get(st.time, (255, 255, 255))
    for _ in range(clouds + (6 if st.time == "storm" else 0)):
        cloud(p, r.uniform(-60, WW + 60), r.uniform(120, HZ * 0.7), r.uniform(0.6, 1.4), cloud_col)


def cloud(p: Pen, x: float, y: float, s: float, col: Color) -> None:
    for dx, dy, rr in ((-90, 10, 60), (-30, -30, 80), (50, -10, 70), (110, 15, 50), (10, 20, 70)):
        p.circle(x + dx * s, y + dy * s, rr * s, col)


def ground(st: Stage, color: Color, top: int = HZ) -> None:
    """near-layer ground from the horizon to the bottom, darker toward the viewer"""
    st.layers["near"].paste(gradient(WW * K, (WH - top) * K, st.haze(color, 0.35), color), (0, top * K))
