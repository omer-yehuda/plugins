"""More interiors: lab, bank, shop, classroom."""
import math

from . import WW
from .colors import shade
from .interiors import FLOOR, shell
from .props import draw_item
from .scenery import OL
from .stage import Stage


def set_lab(st: Stage) -> None:
    shell(st, (226, 238, 242), (232, 238, 240), planks=False, tiles=True)
    for x in range(0, WW, 90):
        for y in range(0, FLOOR, 90):
            st.far.rect((x + 2, y + 2, x + 88, y + 88), (222, 234, 238))
    p = st.mid
    p.rect((WW * 0.55, FLOOR - 700, WW * 0.92, FLOOR - 420), (34, 52, 60), OL, 10)
    pts = [(WW * 0.58 + i * 42, FLOOR - 470 - (i * 37 % 150) - i * 12) for i in range(8)]
    p.line(pts, (90, 230, 170), 8)
    st.glow("mid", (WW * 0.9, FLOOR - 690, WW * 0.91, FLOOR - 680), (90, 230, 170))
    n = st.near
    n.rect((40, FLOOR - 170, WW * 0.62, FLOOR - 130), (70, 80, 90), OL, 6)
    n.rect((60, FLOOR - 130, WW * 0.6, FLOOR + 40), (240, 242, 246), OL, 6)
    cols = [(64, 206, 124), (64, 146, 246), (232, 94, 204), (250, 204, 64)]
    for i in range(5):
        x = 110 + i * 110
        n.ellipse((x - 34, FLOOR - 250, x + 34, FLOOR - 172), cols[i % 4], OL)
        n.rect((x - 12, FLOOR - 300, x + 12, FLOOR - 236), (214, 234, 244), 4)
    n.circle(WW * 0.5, 120, 70, (220, 240, 255), OL)
    st.glow("near", (WW * 0.5 - 40, 110, WW * 0.5 + 40, 130), (230, 246, 255))


def set_bank(st: Stage) -> None:
    shell(st, (122, 154, 134), (208, 196, 180), planks=False, tiles=True)
    for x in (WW * 0.1, WW * 0.9):
        st.mid.rect((x - 46, 80, x + 46, FLOOR), (246, 240, 230), OL)
    vx, vy = WW * 0.72, FLOOR - 420
    st.mid.circle(vx, vy, 220, (176, 176, 182), OL)
    st.mid.circle(vx, vy, 150, (150, 150, 158), OL)
    st.mid.circle(vx, vy, 40, (226, 194, 86), OL)
    for a in range(0, 360, 60):
        st.mid.line([(vx, vy), (vx + 130 * math.cos(math.radians(a)), vy + 130 * math.sin(math.radians(a)))],
                    (226, 194, 86), 12)
    p = st.near
    p.rect((30, FLOOR - 200, WW * 0.55, FLOOR + 30), (114, 72, 42), OL, 6)
    p.rect((20, FLOOR - 220, WW * 0.56, FLOOR - 180), (60, 60, 66), OL, 6)
    for i in range(5):
        x = 60 + i * 110
        p.rect((x - 4, FLOOR - 420, x + 4, FLOOR - 220), (214, 184, 76))
    for i in range(3):
        draw_item(p, "gold", WW * 0.8 + (i % 2) * 70, FLOOR + 10 - (i // 2) * 60, 140)


def set_shop(st: Stage) -> None:
    shell(st, (244, 224, 194), (230, 226, 216), planks=False, tiles=True)
    cols = [(224, 64, 64), (64, 124, 214), (248, 204, 64), (84, 174, 104), (244, 144, 64)]
    r = st.rnd
    for row in range(4):
        y = FLOOR - 200 - row * 150
        st.mid.rect((40, y, WW - 40, y + 14), (152, 112, 72), 3)
        for x in range(60, WW - 80, 64):
            h = r.uniform(70, 120)
            st.mid.rect((x, y - h, x + 52, y), r.choice(cols), 3, 6)
    p = st.near
    p.rect((WW * 0.05, FLOOR - 40, WW * 0.55, FLOOR + 180), (176, 124, 78), OL, 10)
    p.rect((WW * 0.1, FLOOR - 140, WW * 0.3, FLOOR - 40), (64, 64, 70), OL, 10)
    p.rect((WW * 0.12, FLOOR - 190, WW * 0.26, FLOOR - 140), (96, 226, 146), OL, 6)


def set_classroom(st: Stage) -> None:
    shell(st, (236, 226, 196), (190, 140, 92))
    b = st.mid
    b.rect((WW * 0.12, FLOOR - 760, WW * 0.88, FLOOR - 330), (44, 84, 64), OL * 2, 8)
    b.rect((WW * 0.12, FLOOR - 340, WW * 0.88, FLOOR - 318), (150, 108, 64), OL)
    r = st.rnd
    for i in range(4):
        y = FLOOR - 690 + i * 90
        x = WW * 0.18 + r.uniform(0, 80)
        b.line([(x, y), (x + r.uniform(200, 520), y + r.uniform(-10, 10))], (236, 240, 232), 8)
    draw_item(b, "clock", WW * 0.5, FLOOR - 860, 120)
    p = st.near
    for x in (WW * 0.18, WW * 0.82):
        p.rect((x - 150, FLOOR + 40, x + 150, FLOOR + 76), (196, 150, 98), OL, 6)
        for dx in (-130, 130):
            p.rect((x + dx - 8, FLOOR + 76, x + dx + 8, FLOOR + 220), (90, 90, 96), 3)
    p.circle(WW * 0.86, FLOOR - 120, 70, (90, 160, 230), OL)
    p.ellipse((WW * 0.86 - 50, FLOOR - 160, WW * 0.86 + 20, FLOOR - 100), (100, 186, 110))
    p.rect((WW * 0.86 - 10, FLOOR - 50, WW * 0.86 + 10, FLOOR + 30), shade((150, 108, 64), 0.8), 3)
