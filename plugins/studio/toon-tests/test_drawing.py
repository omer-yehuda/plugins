import json

import pytest
from PIL import Image

from toonshorts import camera, spec
from toonshorts.character import CH, CW, draw_character, extent, sprite
from toonshorts.crowd import crowd
from toonshorts.pen import Pen, font
from toonshorts.props import prop_image
from toonshorts.sets import build, front


def _visible(img: Image.Image) -> bool:
    return img.getbbox() is not None


@pytest.mark.parametrize("mood", spec.MOODS)
def test_every_mood_renders(mood):
    img = draw_character({"pose": "stand", "facial_hair": "beard"}, mood, mood == "scared", False, 0.5)
    assert img.size == (CW, CH) and _visible(img)


@pytest.mark.parametrize("pose", spec.POSES)
def test_every_pose_renders(pose):
    look = {"pose": pose, "holding": "newspaper" if pose == "hold" else "none", "label": "NEWS"}
    assert _visible(draw_character(look, "neutral", False, True, 1.0))


@pytest.mark.parametrize("i", range(max(len(spec.HATS), len(spec.OUTFITS), len(spec.HAIR))))
def test_looks_render(i):
    look = {"hat": spec.HATS[i % len(spec.HATS)], "outfit": spec.OUTFITS[i % len(spec.OUTFITS)],
            "hair_style": spec.HAIR[i % len(spec.HAIR)], "facial_hair": spec.FACIAL[i % len(spec.FACIAL)],
            "glasses": i % 2 == 0, "skin": "brown", "facing": "left" if i % 2 else "right"}
    assert _visible(draw_character(look, "happy", True, False, 0.0))


def test_facing_left_mirrors():
    right = draw_character({"pose": "point"}, "neutral", False, False, 0)
    left = draw_character({"pose": "point", "facing": "left"}, "neutral", False, False, 0)
    assert left.transpose(Image.Transpose.FLIP_LEFT_RIGHT).tobytes() == right.tobytes()


def test_sprite_cache_and_extent():
    js = json.dumps({"pose": "wave"}, sort_keys=True)
    small = sprite(js, "happy", False, False, 2, 50)
    assert small.size == (CW // 2, CH // 2)
    x0, y0, x1, y1 = extent(js, "happy", 100)
    assert 0 <= x0 < x1 <= CW and 0 <= y0 < y1 <= CH


@pytest.mark.parametrize("item", [i for i in spec.ITEMS if i != "none"])
def test_every_prop_renders(item):
    assert _visible(prop_image(item, 120, "LABEL"))


@pytest.mark.parametrize("place", spec.PLACES)
def test_every_set_builds(place):
    layers = build({"place": place, "time": "night", "landmark": "castle"}, 3)
    assert set(layers) == {"far", "mid", "near"}
    assert all(img.size == layers["far"].size for img in layers.values())


@pytest.mark.parametrize("lm", spec.LANDMARKS)
def test_landmarks_and_times(lm):
    t = spec.TIMES[spec.LANDMARKS.index(lm) % len(spec.TIMES)]
    assert _visible(build({"place": "desert", "time": t, "landmark": lm}, 1)["mid"])


def test_unknown_place_falls_back():
    assert build({"place": "atlantis", "time": "noon"}, 1)["near"]


@pytest.mark.parametrize("kind", spec.FRONTS)
def test_fronts(kind):
    img = front(kind, 2, crowd)
    assert (img is None) == (kind == "none")


def test_pen_and_font():
    img = Image.new("RGBA", (50, 50))
    p = Pen(img, 1)
    p.arc((0, 0, 40, 40), 0, 90, (0, 0, 0), 2)
    p.text((25, 25), "x", 12, (0, 0, 0))
    assert font(12) is font(12)


@pytest.mark.parametrize("kind", spec.CAMERAS + ["unknown"])
def test_camera_moves_stay_in_world(kind):
    for p in (0.0, 0.5, 1.0):
        cx, cy, z = camera.shot(kind, p, p * 2, 0.4)
        box = camera.fit(cx, cy, z, [(200, 900, 500, 1900)])
        assert box[0] >= 0 and box[1] >= 0 and box[2] <= camera.WW + 1e-6 and box[3] <= camera.WH + 1e-6
        far = camera.parallax(box, 0.25)
        assert far[0] >= 0 and far[2] <= camera.WW + 1e-6


def test_fit_zooms_out_to_keep_everything():
    box = camera.fit(camera.WW / 2, camera.WH / 2, 1.3, [(100, 300, 1300, 2100)])
    assert box[2] - box[0] >= 1000
