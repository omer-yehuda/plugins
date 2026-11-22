"""Camera moves in world px, plus per-layer parallax crop boxes."""
import math

from . import GY, H, M, W, WH, WW
from .colors import ease_in_out, ease_out

Box = tuple[float, float, float, float]


def shot(kind: str, p: float, lt: float, focus_x: float) -> tuple[float, float, float]:
    """-> (centre x, centre y, zoom) for the near layer. p = scene progress 0..1, lt = seconds in."""
    e = ease_in_out(p)
    cx, cy, z = WW / 2, WH / 2, 1.0
    fx, fy = M + focus_x * W, GY - 640
    if kind == "push_in":
        z = 1.0 + 0.16 * e
        cx += (fx - cx) * 0.55 * e
        cy += (fy - cy) * 0.35 * e
    elif kind == "pull_out":
        z = 1.18 - 0.18 * e
        cx += (fx - cx) * 0.55 * (1 - e)
        cy += (fy - cy) * 0.35 * (1 - e)
    elif kind == "pan_right":
        z, cx = 1.1, cx - 110 + 220 * e
    elif kind == "pan_left":
        z, cx = 1.1, cx + 110 - 220 * e
    elif kind == "tilt_up":
        z, cy = 1.1, cy + 120 - 240 * e
    elif kind == "punch_in":
        q = ease_out(min(1.0, lt / 0.3))
        z = 1.32 - 0.2 * q + 0.03 * e
        cx += (fx - cx) * 0.5
        cy += (fy - cy) * 0.3
    elif kind == "shake":
        z = 1.08
        cx += math.sin(lt * 47) * 10 + math.sin(lt * 23) * 6
        cy += math.cos(lt * 41) * 10
    elif kind == "drift":
        z, cx = 1.12, cx - 90 + 180 * e
    else:
        z = 1.0 + 0.04 * e
    return cx, cy, z


def clamp_box(cx: float, cy: float, vw: float, vh: float) -> Box:
    vw, vh = min(vw, WW), min(vh, WH)
    cx = min(max(cx, vw / 2), WW - vw / 2)
    cy = min(max(cy, vh / 2), WH - vh / 2)
    return (cx - vw / 2, cy - vh / 2, cx + vw / 2, cy + vh / 2)


def fit(cx: float, cy: float, z: float, keep: list[Box], margin: float = 40) -> Box:
    """near-layer view box that still contains every box in `keep` (zooming out if needed)"""
    vw, vh = W / z, H / z
    if keep:
        lo_x = min(b[0] for b in keep) - margin
        lo_y = min(b[1] for b in keep) - margin
        hi_x = max(b[2] for b in keep) + margin
        hi_y = max(b[3] for b in keep) + margin
        k = max(1.0, (hi_x - lo_x) / vw, (hi_y - lo_y) / vh)
        vw, vh = min(W, vw * k), min(H, vh * k)
        cx = (lo_x + hi_x) / 2 if hi_x - lo_x > vw else min(max(cx, hi_x - vw / 2), lo_x + vw / 2)
        cy = (lo_y + hi_y) / 2 if hi_y - lo_y > vh else min(max(cy, hi_y - vh / 2), lo_y + vh / 2)
    return clamp_box(cx, cy, vw, vh)


def parallax(box: Box, factor: float) -> Box:
    """the crop box for a layer that moves `factor` times as much as the near layer"""
    cx, cy = (box[0] + box[2]) / 2, (box[1] + box[3]) / 2
    z = W / (box[2] - box[0])
    zf = 1 + (z - 1) * factor
    pcx = WW / 2 + (cx - WW / 2) * factor
    pcy = WH / 2 + (cy - WH / 2) * factor
    return clamp_box(pcx, pcy, W / zf, H / zf)


def segment(sc: dict, lt: float, dur: float) -> tuple[str, float, float, float, int]:
    """active shot inside a scene -> (camera, focus, seconds into the shot, shot length, shot index).

    `cuts` splits one scene (one line) into several shots: [{"at": 0.5, "camera": "punch_in", "focus": 0.7}]."""
    cast = sc.get("cast", [])
    cam = sc.get("camera", "push_in")
    focus = float(sc.get("focus", cast[0].get("x", 0.5) if cast else 0.5))
    start, k = 0.0, 0
    marks = sorted((c for c in sc.get("cuts", []) if isinstance(c, dict)), key=lambda c: float(c.get("at", 0)))
    ends = [min(max(float(c.get("at", 0)), 0.0), 1.0) * dur for c in marks] + [dur]
    for j, c in enumerate(marks):
        if lt >= ends[j]:
            start, k = ends[j], j + 1
            cam = c.get("camera", cam)
            focus = float(c.get("focus", focus))
    end = next((e for e in ends if e > start), dur)
    return cam, focus, lt - start, max(0.1, end - start), k
