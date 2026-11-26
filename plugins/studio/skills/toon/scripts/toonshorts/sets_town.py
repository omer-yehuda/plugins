"""Town sets: city, suburb, farm."""
from . import WW
from .colors import shade
from .scenery import OL, building, crowd_hint, fence, house, lamp, tree
from .stage import HZ, Stage, ground, sky

BUILDING_COLS = [(230, 124, 92), (242, 212, 160), (132, 164, 206), (204, 204, 210), (176, 124, 168),
                 (238, 238, 226), (120, 186, 160)]


def road(st: Stage, top: float, bottom: float) -> None:
    p = st.near
    p.rect((0, top, WW, bottom), (78, 80, 88))
    mid = (top + bottom) / 2
    for x in range(-40, WW, 160):
        p.rect((x, mid - 6, x + 90, mid + 6), (250, 214, 72))
    p.rect((0, bottom, WW, bottom + 18), (196, 196, 190), 3)


def set_city(st: Stage) -> None:
    sky(st, clouds=4)
    r = st.rnd
    x = -40
    while x < WW + 40:   # distant skyline (mid layer, hazed)
        w, h = r.uniform(110, 200), r.uniform(380, 820)
        building(st, "mid", x + w / 2, HZ + 60, w, h, st.haze(r.choice(BUILDING_COLS), 0.45), 0)
        x += w + r.uniform(-10, 20)
    ground(st, (196, 196, 192))
    base = HZ + 190
    x = -60
    while x < WW + 60:   # front row of buildings, shoulder to shoulder
        w = r.uniform(240, 340)
        building(st, "near", x + w / 2, base, w, r.uniform(520, 900), r.choice(BUILDING_COLS))
        x += w
    crowd_hint(st.near, r.uniform(60, 300), base, r.randint(3, 6), r)
    road(st, base, base + 170)
    for lx in (120, WW - 140):
        lamp(st, lx, base + 214)
    tree(st.near, WW * 0.5 + r.uniform(-200, 200), base + 214, 0.9, (84, 166, 86))


def set_suburb(st: Stage) -> None:
    sky(st, clouds=5)
    r = st.rnd
    for i in range(9):
        st.mid.circle(i * 170 + r.uniform(-30, 30), HZ + 20, r.uniform(90, 150), st.haze((88, 160, 92), 0.45))
    ground(st, (116, 184, 92))
    base = HZ + 170
    walls = [(244, 232, 210), (196, 220, 240), (248, 212, 172), (220, 236, 204), (244, 204, 204)]
    roofs = [(178, 74, 62), (84, 94, 118), (126, 84, 62)]
    for i, x in enumerate(range(150, WW + 150, 420)):
        house(st, x + r.uniform(-30, 30), base, 1.0, r.choice(walls), r.choice(roofs))
        tree(st.near, x + 210, base + 10, 0.8, (78 + i * 6, 162, 80))
    fence(st.near, -20, WW + 20, base + 60)
    road(st, base + 90, base + 230)
    lamp(st, WW - 160, base + 270)


def set_farm(st: Stage) -> None:
    sky(st, clouds=6)
    r, p = st.rnd, st.near
    for i in range(5):
        cx = i * 340 + r.uniform(-60, 60)
        st.mid.ellipse((cx - 320, HZ - 150, cx + 320, HZ + 200), st.haze((104, 176, 84), 0.4 + 0.05 * i))
    ground(st, (124, 190, 88))
    base = HZ + 200
    bx = 330
    p.rect((bx - 200, base - 300, bx + 200, base), (196, 56, 46), OL)
    p.poly([(bx - 230, base - 300), (bx + 230, base - 300), (bx, base - 470)], (120, 58, 50), OL)
    p.rect((bx - 80, base - 190, bx + 80, base), (250, 246, 236), OL)
    p.line([(bx - 80, base - 190), (bx + 80, base)], (196, 56, 46), 10)
    p.line([(bx + 80, base - 190), (bx - 80, base)], (196, 56, 46), 10)
    p.rect((bx - 40, base - 400, bx + 40, base - 340), (250, 246, 236), OL, 30)
    for x in (WW * 0.62, WW * 0.85):
        tree(p, x + r.uniform(-40, 40), base - 30, 1.0, (86, 164, 76))
    fence(p, -20, WW + 20, base + 160, (238, 226, 200))
    for _ in range(3):
        hx = r.uniform(WW * 0.45, WW - 80)
        p.ellipse((hx - 70, base + 40, hx + 70, base + 130), (236, 200, 92), OL)
        p.line([(hx - 50, base + 70), (hx + 50, base + 70)], shade((236, 200, 92), 0.8), 4)


TOWN = {"city": set_city, "suburb": set_suburb, "farm": set_farm}
