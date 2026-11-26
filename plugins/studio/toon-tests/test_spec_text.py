import pytest

from toonshorts import bidi, colors, numbers, spec
from toonshorts.captions import caption_image, chunk, clean, current


def test_examples_are_valid(onoda):
    errors, _ = spec.check(onoda)
    assert errors == []


def test_bad_values_get_suggestions(tiny):
    tiny["scenes"][0]["camera"] = "push-in"
    tiny["scenes"][0]["cast"][0]["mood"] = "happpy"
    tiny["characters"]["a"]["hat"] = "tophat"
    tiny["scenes"][1]["same_set_as"] = 5
    tiny["scenes"][1]["cast"].append({"id": "ghost"})
    tiny["scenes"][1]["props"].append({"type": "laser", "anim": "wiggle"})
    errors, _ = spec.check(tiny)
    text = "\n".join(errors)
    assert "Did you mean 'push_in'" in text and "Did you mean 'happy'" in text
    assert "'top_hat'" in text and "EARLIER scene" in text and "ghost" in text
    assert "laser" in text and "wiggle" in text


def test_quality_notes():
    sb = {"characters": {"a": {"outfit_color": "red"}, "b": {"outfit_color": "red"}},
          "scenes": [{"say": " ".join(["word"] * 20), "camera": "static",
                      "cast": [{"id": "a", "x": 0.05}, {"id": "b"}, {"id": "a"}, {"id": "b"}, {"id": "a"}]}] +
                    [{"say": "w " * 60, "camera": "static"}] * 3}
    errors, notes = spec.check(sb)
    joined = "\n".join(notes)
    for needle in ("split it", "near the edge", "share an outfit", "more than 4", "three times", "punch_in",
                   "under 60s"):
        assert needle in joined


@pytest.mark.parametrize("sb", [{}, {"scenes": []}, {"scenes": [{"say": ""}], "characters": []}])
def test_structural_errors(sb):
    assert spec.check(sb)[0]


def test_rtl_detection():
    assert spec.is_rtl({"lang": "he", "scenes": []})
    assert spec.is_rtl({"scenes": [{"say": "שלום"}]})
    assert not spec.is_rtl({"scenes": [{"say": "hello"}]})


def test_colors():
    assert colors.parse("#fff") == (255, 255, 255)
    assert colors.parse("#102030") == (16, 32, 48)
    assert colors.parse([300, -5, 7]) == (255, 0, 7)
    assert colors.parse("teal") == colors.NAMED["teal"]
    assert colors.parse("deep") == colors.SKIN["deep"]
    assert colors.parse("#zzzzzz", (1, 2, 3)) == (1, 2, 3)
    assert colors.parse(["a", "b", "c"], (1, 2, 3)) == (1, 2, 3)
    assert colors.parse(None, (9, 9, 9)) == (9, 9, 9)
    assert colors.mix((0, 0, 0), (100, 100, 100), 0.5) == (50, 50, 50)
    assert colors.overshoot(1.0) == pytest.approx(1.0)
    assert colors.ease_in_out(2) == 1 and colors.ease_out(-1) == 0
    assert colors.seed("a", 1) == colors.seed("a", 1) != colors.seed("a", 2)


@pytest.mark.parametrize("text,want", [
    ("In 1925, he sold it.", "In nineteen twenty-five, he sold it."),
    ("the 1920s", "the nineteen twenties"),
    ("in 2005", "in two thousand and five"),
    ("in 1900", "in nineteen hundred"),
    ("in 1907", "in nineteen oh seven"),
    ("$5 million", "five million dollars"),
    ("3.5 tons", "three point five tons"),
    ("1,000,000 fans", "one million fans"),
    ("50% & more", "fifty percent and more"),
    ("101 dogs", "one hundred and one dogs"),
    ("1,234", "one thousand two hundred and thirty-four"),
])
def test_speakable(text, want):
    assert numbers.speakable(text) == want


def test_cardinal_negative():
    assert numbers.cardinal(-3) == "minus three"


def test_bidi():
    assert bidi.visual("שלום עולם") == "םלוע םולש"
    assert bidi.visual("ב-1944 הוא") == "אוה 1944-ב"
    assert bidi.visual("(שלום)") == "(םולש)"
    assert bidi.visual("hello world") == "hello world"
    assert bidi.visual_words(["a", "b"], False) == [(0, "a"), (1, "b")]
    assert bidi.visual_words(["אב", "OK"], True) == [(1, "OK"), (0, "בא")]


def test_chunk_and_current():
    words = [(w, i * 0.5, i * 0.5 + 0.4) for i, w in enumerate("He sold the Eiffel Tower. Twice, really.".split())]
    chunks = chunk(words)
    assert [len(c) for c in chunks] and all(len(c) <= 3 for c in chunks)
    assert chunks[1][-1][0].endswith(".") or any(c[-1][0].endswith(".") for c in chunks)
    assert current(chunks, -1, 10) is None
    hit = current(chunks, 0.6, 10)
    assert hit and hit[1] == 1
    assert current(chunks, 99, 100) is None
    assert clean('"Hi”') == "Hi"


def test_caption_image_shrinks_long_text():
    short = caption_image(("Hi",), 0, False)
    long = caption_image(("Supercalifragilistic", "expialidocious", "wonderful"), 1, False)
    assert long.width <= 1000 and short.height > 0
    rtl = caption_image(("שלום", "עולם"), 0, True, highlight=False)
    assert rtl.mode == "RGBA"
