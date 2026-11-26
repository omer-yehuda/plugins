"""Regression tests for issues found in the pre-commit review."""
import hashlib
import io

import pytest

from toonshorts import cli, render, setup_env, spec
from toonshorts.compose import set_key
from toonshorts.timing import build as build_timing


def test_same_set_as_chains_resolve_to_the_root():
    scenes = [{"say": "a"}, {"say": "b", "same_set_as": 0}, {"say": "c", "same_set_as": 1},
              {"say": "d", "same_set_as": 9}, {"say": "e", "same_set_as": 4}]
    assert [set_key(scenes, i) for i in range(5)] == ["set0", "set0", "set0", "set3", "set4"]


@pytest.mark.parametrize("scene,needle", [
    ("oops", "must be an object"),
    ({"say": "x", "set": "city"}, "'set' must be an object"),
    ({"say": "x", "cast": {"id": "a"}}, "'cast' must be a list"),
    ({"say": "x", "props": ["money"]}, "every 'props' entry"),
    ({"say": "x", "cast": [{"id": "a", "x": "left"}]}, "x must be a number"),
])
def test_malformed_scenes_are_errors_not_tracebacks(scene, needle):
    errors, _ = spec.check({"characters": {"a": {}}, "scenes": [scene]})
    assert any(needle in e for e in errors)


def test_cli_turns_bad_line_timings_into_an_error(tmp_path, tiny, capsys, monkeypatch):
    monkeypatch.setattr(cli, "_load", lambda p: tiny)
    monkeypatch.setattr("toonshorts.timing.build", lambda *a: (_ for _ in ()).throw(KeyError("start")))
    assert cli.main(["preview", "x.json", "--out", str(tmp_path / "p.png")]) == 2
    assert "ERROR" in capsys.readouterr().err


def test_oversized_download_is_rejected(tmp_path, monkeypatch):
    blob = b"x" * 100
    monkeypatch.setattr(setup_env, "MODELS", {"m.bin": (hashlib.sha256(blob).hexdigest(), 50)})
    with pytest.raises(setup_env.SetupError, match="more than the expected"):
        setup_env.fetch_model("m.bin", tmp_path, log=lambda *_: None, opener=lambda req, timeout: io.BytesIO(blob))
    assert not list(tmp_path.iterdir())


def test_ffmpeg_dying_early_reports_ffmpeg_error(tiny, tmp_path):
    tm, total = build_timing(tiny["scenes"])
    files = render.prerender(tiny, str(tmp_path), 1)
    fake = tmp_path / "fake_ffmpeg.py"
    fake.write_text("import sys; sys.stderr.write('Unknown encoder libx264'); sys.exit(1)\n")
    import sys
    ff_cmd = str(tmp_path / ("ff.bat" if sys.platform == "win32" else "ff.sh"))
    with open(ff_cmd, "w") as f:
        f.write(f'@"{sys.executable}" "{fake}" %*\n' if sys.platform == "win32"
                else f'#!/bin/sh\nexec "{sys.executable}" "{fake}" "$@"\n')
    if sys.platform != "win32":
        import os
        os.chmod(ff_cmd, 0o755)
    with pytest.raises(RuntimeError, match="Unknown encoder"):
        render.video(tiny, tm, total, files, ff_cmd, str(tmp_path / "o.mp4"), fps=4, workers=1, tmp=str(tmp_path))


def test_caption_font_uses_basic_layout_so_hebrew_is_not_reversed_twice():
    # bidi.py already reorders Hebrew into visual order; with libraqm Pillow would reverse it again
    from PIL import ImageFont
    from toonshorts.pen import font
    font.cache_clear()
    f = font(40)
    if isinstance(f, ImageFont.FreeTypeFont):
        assert f.layout_engine == ImageFont.Layout.BASIC
