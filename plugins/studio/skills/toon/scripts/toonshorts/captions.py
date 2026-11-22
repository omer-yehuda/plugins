"""Word-by-word captions: 1-3 words at a time, the word being spoken lights up (karaoke style)."""
import re
from functools import lru_cache

from PIL import Image, ImageDraw

from .bidi import visual_words
from .colors import ACCENT, INK, WHITE
from .pen import font

Word = tuple[str, float, float]   # (text, start, end)
MAX_W = 940
PUNCT_END = ".?!,;:…"


def clean(word: str) -> str:
    return re.sub(r"[\"“”„]", "", word)


def chunk(words: list[Word], max_chars: int = 14, max_words: int = 3) -> list[list[Word]]:
    """group words into caption chunks; punctuation always ends a chunk, tiny words ride along"""
    chunks: list[list[Word]] = []
    cur: list[Word] = []
    for w in words:
        if cur and (len(" ".join(x[0] for x in cur + [w])) > max_chars and len(cur[-1][0]) > 3):
            chunks.append(cur)
            cur = []
        cur.append(w)
        if len(cur) >= max_words or w[0][-1:] in PUNCT_END:
            chunks.append(cur)
            cur = []
    if cur:
        chunks.append(cur)
    return chunks


@lru_cache(512)
def caption_image(words: tuple[str, ...], active: int, rtl: bool, highlight: bool = True) -> Image.Image:
    """render a chunk; `active` is the logical index of the word being spoken (-1 = none)"""
    order = visual_words([clean(w) for w in words], rtl)
    px = 92
    while px > 50:
        f = font(px, 900)
        space = f.getlength(" ")
        total = sum(f.getlength(t) for _, t in order) + space * (len(order) - 1)
        if total <= MAX_W:
            break
        px -= 4
    f = font(px, 900)
    space = f.getlength(" ")
    stroke = max(8, px // 8)
    widths = [f.getlength(t) for _, t in order]
    w = int(sum(widths) + space * (len(order) - 1) + 4 * stroke + 24)
    h = int(px * 1.7)
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    x, cy = 2 * stroke + 12, h / 2
    for (idx, text), tw in zip(order, widths):
        fill = ACCENT if highlight and idx == active else WHITE
        d.text((x + 4, cy + 7), text, font=f, fill=(0, 0, 0, 140), anchor="lm", stroke_width=stroke,
               stroke_fill=(0, 0, 0, 140))
        d.text((x, cy), text, font=f, fill=fill, anchor="lm", stroke_width=stroke, stroke_fill=INK)
        x += tw + space
    limit = MAX_W + 60
    if img.width > limit:   # very long words: shrink rather than spill off the frame
        img = img.resize((limit, max(1, int(img.height * limit / img.width))), Image.Resampling.LANCZOS)
    return img


def current(chunks: list[list[Word]], t: float, scene_end: float) -> tuple[list[Word], int] | None:
    """the chunk on screen at time t and the index of the active word inside it"""
    cur = None
    for ch in chunks:
        if t >= ch[0][1] - 0.04:
            cur = ch
    if cur is None:
        return None
    hold = cur[-1][2] + 0.6 if cur is chunks[-1] else scene_end
    if t >= hold:
        return None
    active = -1
    for j, (_, ws, _) in enumerate(cur):
        if ws - 0.04 <= t:
            active = j
    return cur, active
