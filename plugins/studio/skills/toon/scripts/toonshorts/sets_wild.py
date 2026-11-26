"""Wild sets: mountains, forest, desert, beach, sea, deck, moon, sky."""
from . import WH, WW
from .colors import shade
from .props import draw_item
from .scenery import OL, cactus, mountain, palm, pine, tree
from .stage import HZ, K, Stage, cloud, gradient, ground, sky


def set_mountains(st: Stage) -> None:
    sky(st, clouds=4)
    r = st.rnd
    for i in range(6):
        mountain(st.mid, i * 260 + r.uniform(-60, 60), HZ + 80, r.uniform(480, 700), r.uniform(520, 820),
                 st.haze((128, 120, 132), 0.3 + 0.04 * i))
    ground(st, (108, 172, 92))
    for _ in range(9):
        pine(st.near, r.uniform(-40, WW + 40), HZ + r.uniform(120, 300), r.uniform(0.7, 1.2), (52, 124, 72))
    st.near.poly([(WW * 0.47, HZ), (WW * 0.53, HZ), (WW * 0.7, WH), (WW * 0.3, WH)], (196, 172, 128))


def set_forest(st: Stage) -> None:
    sky(st, clouds=3)
    r = st.rnd
    for _ in range(16):
        pine(st.mid, r.uniform(-60, WW + 60), HZ + 60, r.uniform(1.4, 2.2), st.haze((50, 120, 70), 0.45), 0)
    ground(st, (86, 150, 70))
    for _ in range(10):
        x = r.choice([r.uniform(-60, WW * 0.3), r.uniform(WW * 0.7, WW + 60)])
        fn = r.choice([tree, pine])
        fn(st.near, x, HZ + r.uniform(160, 380), r.uniform(1.1, 1.7), (52 + r.randint(0, 40), 132, 66))
    st.near.poly([(WW * 0.42, HZ), (WW * 0.58, HZ), (WW * 0.8, WH), (WW * 0.2, WH)], (176, 146, 104))


def set_desert(st: Stage) -> None:
    sky(st, clouds=1)
    r = st.rnd
    for s in (-1, 1):
        x = WW / 2 + s * r.uniform(330, 460)
        st.mid.rect((x - 220, HZ - r.uniform(240, 360), x + 220, HZ + 80), st.haze((206, 108, 66), 0.3), 0, 30)
    for i in range(4):
        cx = i * 420 + r.uniform(-80, 80)
        st.mid.ellipse((cx - 360, HZ - 80, cx + 360, HZ + 140), st.haze((240, 198, 136), 0.2))
    ground(st, (236, 194, 134))
    for _ in range(3):
        cactus(st.near, r.choice([r.uniform(60, 300), r.uniform(WW - 300, WW - 60)]), HZ + r.uniform(200, 420),
               r.uniform(0.8, 1.3))
    for _ in range(8):
        x, y = r.uniform(0, WW), r.uniform(HZ + 100, WH)
        st.near.ellipse((x - 28, y - 14, x + 28, y + 14), (176, 124, 92), 3)


def _water(st: Stage, top: int) -> None:
    st.layers["near"].paste(gradient(WW * K, (WH - top) * K, st.haze((52, 132, 200), 0.3), (34, 98, 170)),
                            (0, top * K))
    r = st.rnd
    for _ in range(40):
        x, y = r.uniform(0, WW), r.uniform(top + 20, WH)
        w = 20 + (y - top) / 12
        st.near.line([(x - w, y), (x + w, y)], (196, 232, 255), 4)


def set_beach(st: Stage) -> None:
    sky(st, clouds=3)
    st.mid.rect((0, HZ - 4, WW, HZ + 120), st.haze((52, 132, 200), 0.2))
    ground(st, (244, 214, 158), top=HZ + 90)
    st.near.rect((0, HZ + 80, WW, HZ + 110), (250, 250, 250))
    palm(st.near, 180, HZ + 340, 1.2)
    ux, uy = WW - 220, HZ + 330
    st.near.line([(ux, uy), (ux - 30, uy - 330)], (120, 84, 54), 12)
    st.near.chord((ux - 250, uy - 450, ux + 190, uy - 220), 180, 360, (236, 72, 72), OL)
    st.near.ellipse((ux - 200, uy - 10, ux - 40, uy + 30), (64, 152, 226), 3)


def set_sea(st: Stage) -> None:
    sky(st, clouds=5)
    st.mid.ellipse((-200, HZ - 160, 400, HZ + 120), st.haze((90, 160, 90), 0.35))
    draw_item(st.mid, "ship", WW * 0.68, HZ - 90, 420)
    _water(st, HZ)


def set_deck(st: Stage) -> None:
    sky(st, clouds=4)
    st.mid.rect((0, HZ - 40, WW, HZ + 400), st.haze((52, 132, 200), 0.25))
    deck_top = HZ + 120
    ground(st, (176, 120, 72), top=deck_top)
    p = st.near
    for y in range(deck_top, WH, 46):
        p.line([(0, y), (WW, y)], shade((176, 120, 72), 0.75), 4, round_caps=False)
    p.rect((WW * 0.62, 100, WW * 0.62 + 46, deck_top + 20), (126, 82, 48), OL)
    p.poly([(WW * 0.62 + 46, 180), (WW * 0.62 + 46, deck_top - 120), (WW - 40, deck_top - 140)],
           (250, 244, 228), OL)
    p.rect((0, deck_top - 80, WW, deck_top - 60), (120, 76, 44), OL)
    for x in range(0, WW, 90):
        p.rect((x, deck_top - 70, x + 18, deck_top), (120, 76, 44), 3)
    for i in range(2):
        bx = 180 + i * 150
        p.ellipse((bx - 60, deck_top + 30, bx + 60, deck_top + 180), (150, 98, 56), OL)


def set_moon(st: Stage) -> None:
    st.time = "night"   # space is always dark
    sky(st, stars=True, clouds=0, sun=False)
    st.far.circle(WW * 0.72, HZ * 0.35, 150, (64, 132, 230), 0)
    st.far.ellipse((WW * 0.72 - 90, HZ * 0.35 - 60, WW * 0.72 + 30, HZ * 0.35 + 40), (90, 176, 104))
    for i in range(4):
        st.mid.ellipse((i * 400 - 120, HZ - 120, i * 400 + 300, HZ + 160), (150, 150, 156))
    ground(st, (176, 176, 182))
    r = st.rnd
    for _ in range(10):
        x, y = r.uniform(0, WW), r.uniform(HZ + 80, WH)
        w = 30 + (y - HZ) / 8
        st.near.ellipse((x - w, y - w * 0.3, x + w, y + w * 0.3), (140, 140, 146), 3)
    draw_item(st.near, "rocket", WW * 0.82, HZ + 140, 360)


def set_sky(st: Stage) -> None:
    sky(st, clouds=8)
    for i in range(7):
        cloud(st.mid, i * 220, HZ + 40, 1.6, (246, 248, 255))
    ground(st, (250, 252, 255))
    r = st.rnd
    for _ in range(9):
        cloud(st.near, r.uniform(-40, WW + 40), r.uniform(HZ + 140, WH - 120), r.uniform(1.4, 2.2), (255, 255, 255))


WILD = {"mountains": set_mountains, "forest": set_forest, "desert": set_desert, "beach": set_beach, "sea": set_sea,
        "deck": set_deck, "moon": set_moon, "sky": set_sky}
