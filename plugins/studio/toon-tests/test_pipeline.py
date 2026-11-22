import hashlib
import io
import json
import os
import subprocess
import sys

import numpy as np
import pytest
from PIL import Image

from toonshorts import cli, compose, paths, render, setup_env, voice
from toonshorts.timing import build as build_timing

TOON = paths.SKILL_DIR / "scripts" / "toon.py"


def _write(tmp_path, sb) -> str:
    p = tmp_path / "sb.json"
    p.write_text(json.dumps(sb, ensure_ascii=False), encoding="utf-8")
    return str(p)


def test_check_command(tmp_path, tiny, capsys):
    assert cli.main(["check", _write(tmp_path, tiny)]) == 0
    tiny["scenes"][0]["camera"] = "zoomies"
    assert cli.main(["check", _write(tmp_path, tiny)]) == 1
    assert "ERROR" in capsys.readouterr().out


def test_preview_and_render(tmp_path, tiny):
    sb = _write(tmp_path, tiny)
    png, mp4 = str(tmp_path / "p.png"), str(tmp_path / "v" / "s.mp4")
    assert cli.main(["preview", sb, "--out", png, "--workers", "1"]) == 0
    assert Image.open(png).size[0] == 4 * 270
    assert cli.main(["render", sb, "--out", mp4, "--workers", "2", "--fps", "4", "--no-sfx"]) == 0
    assert (tmp_path / "v" / "s.mp4").stat().st_size > 1000


def test_render_refuses_invalid_storyboard(tmp_path, tiny):
    tiny["scenes"][0]["cast"][0]["id"] = "nobody"
    with pytest.raises(SystemExit):
        cli.main(["preview", _write(tmp_path, tiny)])


def test_movie_frames_cover_enters_and_fronts(tiny, tmp_path):
    tm, total = build_timing(tiny["scenes"])
    files = render.prerender(tiny, str(tmp_path), 1)
    m = compose.Movie(tiny, tm, total, 30, render._loader(files))
    for t in (0.0, 0.1, 0.5, tm[1][0] + 0.05, total - 0.1):
        assert m.frame(t).size == (1080, 1920)
    assert m.scene_at(999) == 1


def test_over_clips_negative_offsets():
    dst = Image.new("RGBA", (10, 10))
    src = Image.new("RGBA", (6, 6), (255, 0, 0, 255))
    compose.over(dst, src, -3, -3)
    compose.over(dst, src, 50, 50)
    compose.paste_scaled(dst, src, 5, 5, 0.0)
    assert dst.getpixel((0, 0))[0] == 255 and dst.getpixel((5, 5))[3] == 0


def test_voice_without_models_explains_setup(home):
    voice._ENGINE.clear()
    with pytest.raises(setup_env.SetupError, match="setup --voice"):
        voice.engine()
    with pytest.raises(ValueError):
        voice.synth("hi", "nope", 1.0)


def test_voice_make_and_samples_with_fake_engine(tmp_path, monkeypatch, onoda, capsys):
    monkeypatch.setattr(voice, "synth", lambda text, v, s: (np.ones(2400, np.float32) * 0.2, 24000))
    wav, lines = voice.make(onoda, "am_michael", str(tmp_path / "v.wav"))
    spans = json.loads(open(lines, encoding="utf-8").read())
    assert len(spans) == len(onoda["scenes"]) and spans[1]["start"] > spans[0]["end"]
    rows = voice.samples("hook", str(tmp_path / "s"), "es")
    assert [r[1] for r in rows] == ["em_alex", "ef_dora"]
    assert cli.main(["voices", "--lang", "fr"]) == 0 and "ff_siwis" in capsys.readouterr().out
    assert len(voice.trim(np.zeros(10, np.float32), 24000)) == 10


def test_fetch_model_verifies_hash(tmp_path, monkeypatch):
    blob = b"model-bytes" * 100
    monkeypatch.setattr(setup_env, "MODELS", {"m.bin": (hashlib.sha256(blob).hexdigest(), len(blob))})
    opener = lambda req, timeout: io.BytesIO(blob)   # noqa: E731
    path = setup_env.fetch_model("m.bin", tmp_path, log=lambda *_: None, opener=opener)
    assert path.read_bytes() == blob and setup_env.model_ok("m.bin", tmp_path)
    assert setup_env.fetch_model("m.bin", tmp_path, opener=None) == path   # cached, no download
    monkeypatch.setattr(setup_env, "MODELS", {"x.bin": ("0" * 64, len(blob))})
    with pytest.raises(setup_env.SetupError, match="sha256 mismatch"):
        setup_env.fetch_model("x.bin", tmp_path, log=lambda *_: None, opener=opener)
    assert not (tmp_path / "x.bin").exists() and not (tmp_path / "x.bin.part").exists()

    def broken(req, timeout):
        raise OSError("offline")
    with pytest.raises(setup_env.SetupError, match="download failed"):
        setup_env.fetch_model("x.bin", tmp_path, log=lambda *_: None, opener=broken)


def test_setup_runs_pinned_pip(home, monkeypatch):
    calls = []

    class R:
        returncode, stderr = 0, ""

    def fake_run(cmd, **kw):
        calls.append(cmd)
        if "venv" in cmd:
            paths.venv_python().parent.mkdir(parents=True, exist_ok=True)
            paths.venv_python().touch()
        return R()

    monkeypatch.setattr(setup_env.subprocess, "run", fake_run)
    monkeypatch.setattr(setup_env, "fetch_model", lambda name, log=print: None)
    assert cli.main(["setup", "--voice"]) == 0
    reqs = [c[-1] for c in calls if "pip" in c]
    assert reqs[0].endswith("requirements.txt") and reqs[1].endswith("requirements-voice.txt")
    R.returncode, R.stderr = 1, "boom"
    with pytest.raises(setup_env.SetupError, match="boom"):
        setup_env.pip_install("render", log=lambda *_: None)


def test_paths(home):
    assert paths.home() == home and paths.models_dir().parent == home
    assert not paths.in_venv() and paths.requirements("voice").name == "requirements-voice.txt"


def test_entry_point_check_needs_no_packages(onoda, tmp_path):
    sb = _write(tmp_path, onoda)
    env = {**os.environ, "TOON_SHORTS_HOME": str(tmp_path / "h")}   # no venv there: runs on this interpreter
    r = subprocess.run([sys.executable, str(TOON), "check", sb], capture_output=True, text=True, env=env,
                       cwd=tmp_path)
    assert r.returncode == 0 and "OK" in r.stdout


def test_cli_reports_runtime_errors(tmp_path, capsys):
    assert cli.main(["check", str(tmp_path / "missing.json")]) == 2
    assert "ERROR" in capsys.readouterr().err
