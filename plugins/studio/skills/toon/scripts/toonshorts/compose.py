"""Compose one video frame: parallax set layers, props, cast, foreground, captions."""
import json
import math

from PIL import Image, ImageDraw, ImageFilter

from . import GY, H, M, SAFE, W
from .camera import fit, parallax, segment, shot
from .captions import caption_image, chunk, current
from .character import CH, FOOT, extent, sprite
from .colors import ease_out, overshoot, seed
from .props import prop_image
from .spec import ITEMS, is_rtl
from .stage import PARALLAX

CHAR_SCALE = 0.95


def set_key(scenes: list[dict], i: int) -> str:
    """key of the scene whose set is shown; follows chains of same_set_as back to the root"""
    seen = set()
    while i not in seen:
        seen.add(i)
        same = scenes[i].get("same_set_as")
        if not isinstance(same, int) or not 0 <= same < i:
            break
        i = same
    return f"set{i}"


class Movie:
    def __init__(self, sb: dict, timing, total: float, fps: int, layers_for):
        """layers_for(key) -> {'far','mid','near','front'} images (front may be None)"""
        self.sb, self.timing, self.total, self.fps = sb, timing, total, fps
        self.scenes, self.chars = sb["scenes"], sb.get("characters", {})
        self.rtl = is_rtl(sb)
        self.captions = sb.get("captions", True)
        self.highlight = sb.get("highlight", True)
        self.layers_for = layers_for
        self.chunks = [chunk(wl) for _, _, wl in timing]
        self._shadow: dict[int, Image.Image] = {}

    def scene_at(self, t: float) -> int:
        for i, (_, t1, _) in enumerate(self.timing):
            if t < t1:
                return i
        return len(self.timing) - 1

    def shadow(self, w: int) -> Image.Image:
        if w not in self._shadow:
            h = max(4, int(w * 0.2))
            mask = Image.new("L", (w, h), 0)
            ImageDraw.Draw(mask).ellipse((w * 0.08, h * 0.15, w * 0.92, h * 0.85), fill=110)
            sh = Image.new("RGBA", (w, h), (12, 10, 24, 0))
            sh.putalpha(mask.filter(ImageFilter.GaussianBlur(max(2, w / 28))))
            self._shadow[w] = sh
        return self._shadow[w]

    def prop_pos(self, pr: dict) -> tuple[float, float, float]:
        half = int(pr.get("size", 260)) * 0.45 + 16
        x = min(max(M + float(pr.get("x", 0.75)) * W, M + SAFE + half), M + W - SAFE - half)
        y = min(max(M + float(pr.get("y", 0.35)) * H, M + 180 + half), M + H * 0.62 - half)
        return x, y, half

    def draw_prop(self, world: Image.Image, pr: dict, lt: float, dur: float) -> None:
        kind = pr.get("type", "none")
        at = float(pr.get("at", 0)) * dur
        if kind not in ITEMS or kind == "none" or lt < at:
            return
        im = prop_image(kind, int(pr.get("size", 260)), str(pr.get("label", "")))
        x, y, _ = self.prop_pos(pr)
        anim, q = pr.get("anim", "pop"), lt - at
        s = overshoot(min(1.0, q / 0.3)) if anim != "none" else 1.0
        if anim == "float":
            y += math.sin(q * 2.6) * 14
        elif anim == "pulse":
            s *= 1 + 0.06 * math.sin(q * 8)
        elif anim == "spin":
            im = im.rotate(math.sin(q * 3) * 14, resample=Image.Resampling.BICUBIC)
        paste_scaled(world, im, x, y, s)

    def draw_cast(self, world: Image.Image, sc: dict, i: int, t: float, lt: float, dur: float, speaking: bool):
        keep = []
        for c in sorted(sc.get("cast", []), key=lambda c: c.get("scale", 1.0)):
            look = dict(self.chars.get(c.get("id", ""), {}))
            skip = ("id", "x", "scale", "talking", "mood", "enter", "costume")
            look.update({k: v for k, v in c.items() if k not in skip})
            mood = c.get("mood", look.pop("mood", "neutral"))
            sid = seed(c.get("id", ""), i)
            blink = ((t + (sid % 300) / 100) % 3.6) < 0.12
            mouth = bool(c.get("talking")) and speaking and int(t * 9) % 2 == 0
            phase_q = int((t * 1.7 + sid % 8) * 8) % 8
            s = float(c.get("scale", 1.0)) * CHAR_SCALE
            js, pct = json.dumps(look, sort_keys=True), int(round(s * 100))
            img = sprite(js, mood, mouth, blink, phase_q, pct)
            bb = extent(js, mood, pct)
            x = M + float(c.get("x", 0.5)) * W
            vl, vr = x - img.width / 2 + bb[0], x - img.width / 2 + bb[2]
            lo, hi = M + SAFE, M + W - SAFE
            if vr - vl <= hi - lo:
                x += (lo - vl) if vl < lo else (hi - vr) if vr > hi else 0
            top = GY + (CH - FOOT) * s - img.height
            keep.append((x - img.width / 2 + bb[0], top + bb[1], x - img.width / 2 + bb[2], top + bb[3]))
            bob = math.sin(t * 2.4 + sid) * 5 * s
            if look.get("pose") in ("walk", "run"):
                speed = 140 if look["pose"] == "run" else 70
                x += (lt - dur / 2) * speed * (-1 if look.get("facing") == "left" else 1)
                bob = -abs(math.sin(t * (10 if look["pose"] == "run" else 7))) * 12 * s
            enter, dx = c.get("enter", "none"), 0.0
            if enter == "pop":
                q = overshoot(min(1.0, lt / 0.35))
                if q < 0.999:
                    img = img.resize((max(1, int(img.width * q)), max(1, int(img.height * q))))
            elif enter in ("slide_left", "slide_right"):
                dx = (1 - ease_out(min(1.0, lt / 0.45))) * (720 if enter == "slide_left" else -720)
            sw = int(240 * s)
            sh = self.shadow(sw)
            over(world, sh, x + dx - sw / 2, GY - sh.height / 2)
            over(world, img, x + dx - img.width / 2, top + (CH * s - img.height) + bob)
        return keep

    def frame(self, t: float) -> Image.Image:
        i = self.scene_at(t)
        sc = self.scenes[i]
        t0, t1, wl = self.timing[i]
        lt, dur = t - t0, max(0.1, t1 - t0)
        layers = self.layers_for(set_key(self.scenes, i))
        world = layers["near"].copy()
        speaking = any(ws <= t < we for _, ws, we in wl)
        props = sc.get("props", [])
        for pr in props:
            if pr.get("behind"):
                self.draw_prop(world, pr, lt, dur)
        keep = self.draw_cast(world, sc, i, t, lt, dur, speaking)
        for pr in props:
            if not pr.get("behind"):
                self.draw_prop(world, pr, lt, dur)
                if lt >= float(pr.get("at", 0)) * dur and pr.get("type") in ITEMS:
                    x, y, half = self.prop_pos(pr)
                    keep.append((x - half, y - half, x + half, y + half))
        if layers.get("front") is not None:
            world.alpha_composite(layers["front"])
        cam, focus, slt, sdur, k = segment(sc, lt, dur)
        cx, cy, z = shot(cam, slt / sdur, slt, focus)
        if (i > 0 or k > 0) and slt < 0.15:   # cut punch: a tiny zoom kick on every cut
            z *= 1 + 0.05 * (1 - slt / 0.15)
        box = fit(cx, cy, z, keep)
        out = layers["far"].resize((W, H), Image.Resampling.BILINEAR, box=parallax(box, PARALLAX["far"]))
        out.alpha_composite(layers["mid"].resize((W, H), Image.Resampling.BILINEAR,
                                                 box=parallax(box, PARALLAX["mid"])))
        out.alpha_composite(world.resize((W, H), Image.Resampling.BILINEAR, box=box))
        if self.captions:
            hit = current(self.chunks[i], t, t1)
            if hit:
                words, active = hit
                img = caption_image(tuple(w for w, _, _ in words), active, self.rtl, self.highlight)
                q = overshoot(min(1.0, (t - words[0][1] + 0.04) / 0.1))
                paste_scaled(out, img, W / 2, H * 0.71, 0.86 + 0.14 * q)
        return out.convert("RGB")


def over(dst: Image.Image, im: Image.Image, x: float, y: float) -> None:
    """alpha-composite im onto dst at (x, y), clipped to dst (negative offsets allowed)"""
    x, y = int(x), int(y)
    l, t = max(0, -x), max(0, -y)
    r, b = min(im.width, dst.width - x), min(im.height, dst.height - y)
    if r <= l or b <= t:
        return
    dst.alpha_composite(im.crop((l, t, r, b)) if (l, t, r, b) != (0, 0, im.width, im.height) else im,
                        (x + l, y + t))


def paste_scaled(dst: Image.Image, im: Image.Image, cx: float, cy: float, s: float = 1.0) -> None:
    if s <= 0.01:
        return
    if abs(s - 1) > 0.01:
        im = im.resize((max(1, int(im.width * s)), max(1, int(im.height * s))), Image.Resampling.BILINEAR)
    over(dst, im, cx - im.width / 2, cy - im.height / 2)
