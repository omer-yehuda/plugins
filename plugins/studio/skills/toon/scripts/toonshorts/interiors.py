"""Indoor shell + room, office, palace, court, prison. Wall = far+mid layers, floor = near."""
from . import WH, WW
from .colors import Color, shade
from .props import draw_item
from .scenery import OL, building
from .stage import TIME, K, Stage, gradient

FLOOR = int(WH * 0.66)


def shell(st: Stage, wall: Color, floor: Color, planks: bool = True, tiles: bool = False) -> None:
    st.indoor = True
    st.layers["far"].paste(gradient(WW * K, WH * K, shade(wall, 1.06), shade(wall, 0.88)), (0, 0))
    st.layers["near"].paste(gradient(WW * K, (WH - FLOOR) * K, shade(floor, 0.86), floor), (0, FLOOR * K))
    p = st.near
    if planks:
        for i in range(1, 10):
            y = FLOOR + (WH - FLOOR) * (i / 10) ** 1.4
            p.line([(0, y), (WW, y)], shade(floor, 0.78), 3, round_caps=False)
    if tiles:
        for x in range(-WW, 2 * WW, 160):
            p.line([(WW / 2 + (x - WW / 2) * 0.35, FLOOR), (x, WH)], shade(floor, 0.84), 3, round_caps=False)
    p.rect((0, FLOOR - 14, WW, FLOOR + 10), shade(wall, 0.6), 3)


def window(st: Stage, x: float, y: float, w: float, h: float, city: bool = False) -> None:
    top, bottom = TIME[st.time][:2]
    p = st.mid
    p.rect((x - w / 2 - 16, y - h / 2 - 16, x + w / 2 + 16, y + h / 2 + 16), (246, 246, 246), OL, 6)
    st.layers["mid"].paste(gradient(int(w * K), int(h * K), top, bottom), (int((x - w / 2) * K), int((y - h / 2) * K)))
    if city:
        for i in range(5):
            bx = x - w / 2 + 40 + i * (w - 80) / 4
            building(st, "mid", bx, y + h / 2, 90, 120 + (i * 53) % 160, st.haze((120, 140, 170), 0.3), 0)
    p.rect((x - 6, y - h / 2, x + 6, y + h / 2), (246, 246, 246))
    p.rect((x - w / 2, y - 6, x + w / 2, y + 6), (246, 246, 246))


def picture(st: Stage, x: float, y: float, w: float, h: float, col: Color) -> None:
    st.mid.rect((x - w / 2 - 14, y - h / 2 - 14, x + w / 2 + 14, y + h / 2 + 14), (156, 112, 62), OL)
    st.mid.rect((x - w / 2, y - h / 2, x + w / 2, y + h / 2), col)
    st.mid.poly([(x - w / 2, y + h / 2), (x - w / 8, y), (x + w / 6, y + h / 3), (x + w / 2, y - h / 6),
                 (x + w / 2, y + h / 2)], shade(col, 0.7))


def set_room(st: Stage) -> None:
    shell(st, (240, 218, 186), (184, 132, 86))
    for x in range(0, WW, 120):
        st.far.rect((x, 0, x + 50, FLOOR), (234, 208, 174))
    window(st, WW * 0.3, FLOOR - 520, 340, 300)
    picture(st, WW * 0.74, FLOOR - 560, 220, 160, (124, 176, 216))
    p = st.near
    p.ellipse((WW * 0.2, FLOOR + 140, WW * 0.8, FLOOR + 320), (196, 84, 74), OL)
    sx = WW * 0.72
    p.rect((sx - 220, FLOOR - 120, sx + 220, FLOOR + 40), (124, 92, 164), OL, 30)
    p.rect((sx - 250, FLOOR - 60, sx + 250, FLOOR + 60), (136, 102, 178), OL, 30)
    p.rect((60, FLOOR - 260, 180, FLOOR + 20), (150, 106, 66), OL, 8)
    p.circle(120, FLOOR - 300, 60, (255, 222, 150), OL)
    st.glow("near", (90, FLOOR - 320, 150, FLOOR - 280), (255, 236, 170))


def set_office(st: Stage) -> None:
    shell(st, (218, 228, 226), (196, 198, 204), planks=False, tiles=True)
    window(st, WW * 0.45, FLOOR - 520, 620, 420, city=True)
    p = st.near
    p.rect((WW - 230, FLOOR - 340, WW - 70, FLOOR + 30), (154, 112, 72), OL, 8)
    for i in range(4):
        p.rect((WW - 210, FLOOR - 320 + i * 86, WW - 90, FLOOR - 250 + i * 86), (178, 136, 92), 3, 6)
    p.rect((50, FLOOR - 70, 150, FLOOR + 40), (230, 230, 226), OL, 10)
    for dx, dy, r in ((0, -150, 70), (-50, -110, 50), (50, -110, 54)):
        p.circle(100 + dx, FLOOR + dy, r, (72, 154, 76), OL)
    draw_item(st.mid, "clock", WW * 0.85, FLOOR - 640, 130)


def set_palace(st: Stage) -> None:
    shell(st, (184, 48, 58), (236, 226, 210), planks=False, tiles=True)
    gold = (240, 190, 60)
    for x in (WW * 0.12, WW * 0.88):
        st.mid.rect((x - 50, 120, x + 50, FLOOR), (246, 238, 222), OL)
        st.mid.rect((x - 70, 100, x + 70, 150), gold, OL)
        st.mid.rect((x - 70, FLOOR - 50, x + 70, FLOOR), gold, OL)
    for x in (WW * 0.32, WW * 0.68):
        st.mid.rect((x - 80, 160, x + 80, FLOOR - 200), gold, 0, 20)
    p = st.near
    p.poly([(WW * 0.42, FLOOR), (WW * 0.58, FLOOR), (WW * 0.72, WH), (WW * 0.28, WH)], (190, 32, 44))
    tx = WW * 0.5
    p.rect((tx - 120, FLOOR - 420, tx + 120, FLOOR - 40), gold, OL, 40)
    p.rect((tx - 80, FLOOR - 360, tx + 80, FLOOR - 140), (150, 30, 44), OL, 20)
    p.rect((tx - 160, FLOOR - 160, tx + 160, FLOOR + 10), gold, OL, 16)
    draw_item(p, "crown", tx, FLOOR - 470, 120)


def set_court(st: Stage) -> None:
    shell(st, (156, 104, 64), (132, 88, 52))
    for x in range(0, WW, 180):
        st.far.rect((x + 14, 80, x + 166, FLOOR - 30), (166, 112, 70), 3, 10)
    draw_item(st.mid, "star", WW * 0.5, FLOOR - 700, 180)
    for x, col in ((WW * 0.15, (46, 78, 170)), (WW * 0.85, (190, 46, 46))):
        st.mid.line([(x, FLOOR), (x, FLOOR - 560)], (226, 194, 86), 10)
        st.mid.rect((x + 6, FLOOR - 560, x + 120, FLOOR - 400), col, 3)
    p = st.near
    p.rect((WW * 0.2, FLOOR - 300, WW * 0.8, FLOOR + 60), (112, 72, 42), OL, 10)
    p.rect((WW * 0.18, FLOOR - 320, WW * 0.82, FLOOR - 280), (92, 56, 30), OL, 6)
    p.rect((WW * 0.44, FLOOR - 200, WW * 0.56, FLOOR - 100), (226, 194, 86), OL, 50)


def set_prison(st: Stage) -> None:
    shell(st, (152, 176, 182), (176, 180, 184), planks=False, tiles=True)
    for row in range(0, FLOOR, 50):
        off = 0 if (row // 50) % 2 else 50
        for x in range(-off, WW, 100):
            st.far.rect((x + 3, row + 3, x + 97, row + 47), (146, 170, 176))
    window(st, WW * 0.65, FLOOR - 640, 200, 160)
    for i in range(5):
        st.mid.rect((WW * 0.65 - 80 + i * 40, FLOOR - 720, WW * 0.65 - 72 + i * 40, FLOOR - 560), (50, 50, 56))
    p = st.near
    p.rect((40, FLOOR - 120, 420, FLOOR - 70), (122, 126, 132), OL, 6)
    p.rect((50, FLOOR - 150, 410, FLOOR - 110), (236, 236, 232), OL, 14)
    for x in (60, 400):
        p.rect((x - 8, FLOOR - 70, x + 8, FLOOR + 40), (90, 92, 98), 3)
    p.rect((WW - 200, FLOOR - 60, WW - 80, FLOOR + 40), (214, 218, 218), OL, 20)


SETS_A = {"room": set_room, "office": set_office, "palace": set_palace, "court": set_court, "prison": set_prison}
