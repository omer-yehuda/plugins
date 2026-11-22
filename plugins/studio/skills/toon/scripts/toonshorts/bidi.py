"""Minimal right-to-left reordering for Hebrew captions.

Pillow draws glyphs left to right in the order given unless it was built with libraqm,
which most Windows/mac wheels are not. Hebrew needs no glyph shaping, so reordering
the text into visual order is enough. Numbers and Latin words stay left-to-right.
(Arabic, Persian and Urdu also need contextual shaping, which this does not do.)
"""
import re

HEBREW = re.compile(r"[֐-׿יִ-ﭏ]")
LTR_RUN = re.compile(r"[0-9A-Za-z][0-9A-Za-z.,:%$€₪'/-]*[0-9A-Za-z%]|[0-9A-Za-z]")
MIRROR = str.maketrans("()[]{}<>«»", ")(][}{><»«")


def has_rtl(text: str) -> bool:
    return bool(HEBREW.search(text))


def _visual_word(word: str) -> str:
    """one space-free token -> visual order: reverse RTL segments, keep LTR runs intact"""
    if not has_rtl(word):
        return word
    parts: list[tuple[bool, str]] = []   # (is_ltr, text)
    pos = 0
    for m in LTR_RUN.finditer(word):
        if m.start() > pos:
            parts.append((False, word[pos:m.start()]))
        parts.append((True, m.group()))
        pos = m.end()
    if pos < len(word):
        parts.append((False, word[pos:]))
    out = []
    for is_ltr, seg in reversed(parts):
        out.append(seg if is_ltr else seg[::-1].translate(MIRROR))
    return "".join(out)


def visual_words(words: list[str], rtl: bool) -> list[tuple[int, str]]:
    """-> [(logical_index, visual_text)] in left-to-right drawing order"""
    if not rtl:
        return list(enumerate(words))
    return [(i, _visual_word(w)) for i, w in reversed(list(enumerate(words)))]


def visual(text: str, rtl: bool | None = None) -> str:
    """a whole line in visual order (rtl auto-detected when None)"""
    rtl = has_rtl(text) if rtl is None else rtl
    return " ".join(v for _, v in visual_words(text.split(), rtl))
