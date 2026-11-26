"""Supersampled drawing helper: draw in design units, every coordinate is scaled by k."""
from functools import lru_cache

from PIL import Image, ImageDraw, ImageFont

from .colors import INK, Color
from .paths import FONT


@lru_cache(64)
def font(px: float, weight: int = 800) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    px = max(8, int(px))
    try:
        # BASIC layout: bidi.py already puts Hebrew in visual order; libraqm would reverse it again
        f = ImageFont.truetype(str(FONT), px, layout_engine=ImageFont.Layout.BASIC)
        try:
            f.set_variation_by_axes([weight])
        except (OSError, AttributeError):
            pass
        return f
    except OSError:
        return ImageFont.load_default(size=px)


class Pen:
    def __init__(self, img: Image.Image, k: float = 1.0):
        self.d = ImageDraw.Draw(img)
        self.k = k

    def _b(self, box):
        x0, y0, x1, y1 = (v * self.k for v in box)
        return [min(x0, x1), min(y0, y1), max(x0, x1), max(y0, y1)]

    def _w(self, w: float) -> int:
        return max(1, int(round(w * self.k)))

    def ellipse(self, box, fill, outline: float = 0, oc: Color = INK):
        self.d.ellipse(self._b(box), fill=fill, outline=oc if outline else None,
                       width=self._w(outline) if outline else 0)

    def circle(self, cx, cy, r, fill, outline: float = 0, oc: Color = INK):
        self.ellipse((cx - r, cy - r, cx + r, cy + r), fill, outline, oc)

    def rect(self, box, fill, outline: float = 0, radius: float = 0, oc: Color = INK):
        w = self._w(outline) if outline else 0
        if radius:
            self.d.rounded_rectangle(self._b(box), self._w(radius), fill=fill,
                                     outline=oc if outline else None, width=w)
        else:
            self.d.rectangle(self._b(box), fill=fill, outline=oc if outline else None, width=w)

    def poly(self, pts, fill, outline: float = 0, oc: Color = INK):
        pts = [(x * self.k, y * self.k) for x, y in pts]
        self.d.polygon(pts, fill=fill)
        if outline:
            self.d.line(pts + [pts[0]], fill=oc, width=self._w(outline), joint="curve")
            r = outline * self.k / 2
            for x, y in pts:
                self.d.ellipse((x - r, y - r, x + r, y + r), fill=oc)

    def line(self, pts, fill, width: float, round_caps: bool = True):
        pts = [(x * self.k, y * self.k) for x, y in pts]
        self.d.line(pts, fill=fill, width=self._w(width), joint="curve")
        if round_caps:
            r = width * self.k / 2
            for x, y in (pts[0], pts[-1]):
                self.d.ellipse((x - r, y - r, x + r, y + r), fill=fill)

    def arc(self, box, a0, a1, fill, width: float):
        self.d.arc(self._b(box), a0, a1, fill=fill, width=self._w(width))

    def chord(self, box, a0, a1, fill, outline: float = 0, oc: Color = INK):
        self.d.chord(self._b(box), a0, a1, fill=fill, outline=oc if outline else None,
                     width=self._w(outline) if outline else 0)

    def limb(self, pts, fill, width: float, outline: float = 6):
        """thick outlined tube through pts (arms, legs)"""
        self.line(pts, INK, width + 2 * outline)
        self.line(pts, fill, width)

    def text(self, xy, s: str, px: float, fill, weight: int = 800, anchor: str = "mm",
             stroke: float = 0, sc: Color = INK):
        self.d.text((xy[0] * self.k, xy[1] * self.k), s, font=font(px * self.k, weight), fill=fill,
                    anchor=anchor, stroke_width=int(stroke * self.k), stroke_fill=sc)


def canvas(w: int, h: int, k: float = 2.0) -> tuple[Image.Image, Pen]:
    img = Image.new("RGBA", (int(w * k), int(h * k)), (0, 0, 0, 0))
    return img, Pen(img, k)
