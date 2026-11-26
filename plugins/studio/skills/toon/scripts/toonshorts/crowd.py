"""The 'crowd' foreground: two rows of people seen from behind, filling the bottom of the frame."""
import random

from PIL import Image

from . import M, W, WH, WW
from .colors import SKIN, parse
from .pen import Pen

SHIRTS = ["red", "blue", "green", "yellow", "orange", "purple", "teal", "pink", "white", "brown", "navy"]
HAIRS = ["#2a1d16", "#6b4426", "#c87a3a", "#141414", "#d8b060", "#8a8a8a"]


def _person(p: Pen, x: float, base: float, s: float, rnd: random.Random) -> None:
    shirt = parse(rnd.choice(SHIRTS))
    skin = rnd.choice(list(SKIN.values()))
    hair = parse(rnd.choice(HAIRS))
    p.rect((x - 150 * s, base - 260 * s, x + 150 * s, base + 200 * s), shirt, 6, 80 * s)
    hy, hr = base - 330 * s, 130 * s
    p.circle(x - hr * 0.95, hy + 10 * s, 26 * s, skin, 5)
    p.circle(x + hr * 0.95, hy + 10 * s, 26 * s, skin, 5)
    p.circle(x, hy, hr, skin, 7)
    style = rnd.random()
    if style < 0.15:
        return                                   # bald
    if style < 0.4:
        for i in range(9):                       # curly
            p.circle(x - hr + i * hr / 4, hy - hr * 0.35 - (i % 2) * 18 * s, hr * 0.4, hair, 5)
    p.chord((x - hr, hy - hr, x + hr, hy + hr), 160, 380, hair, 7)


def crowd(seed: int) -> Image.Image:
    rnd = random.Random(seed)
    k = 2
    img = Image.new("RGBA", (WW * k, WH * k), (0, 0, 0, 0))
    p = Pen(img, k)
    for row in (1, 0):   # back row first
        n = 6 - row
        s = 0.95 - row * 0.12
        base = WH - M + 120 - row * 120
        for i in range(n):
            x = M - 60 + (i + 0.5 * (1 - row)) * (W + 120) / (n - 0.5) + rnd.uniform(-24, 24)
            _person(p, x, base, s, rnd)
    return img.resize((WW, WH), Image.Resampling.LANCZOS)
