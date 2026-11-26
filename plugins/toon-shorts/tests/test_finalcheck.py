"""1.2.0: finalcheck compares the rendered short with what the storyboard and voice say it should be."""
import copy
import json
import subprocess

import numpy as np
import pytest

from toonshorts import cli
from toonshorts import finalcheck as fc
from toonshorts.audio import SR, find_ffmpeg, write_wav


def _write(tmp_path, sb, name="sb.json") -> str:
    p = tmp_path / name
    p.write_text(json.dumps(sb), encoding="utf-8")
    return str(p)


def test_difference_finds_one_changed_tile():
    a = np.zeros((16, 16), np.int16)
    b = a.copy()
    assert fc.difference(a, b) == 0
    b[8:, 8:] = 200
    assert fc.difference(a, b) == 200                      # one tile of four changed: not averaged down to 50
    assert fc.difference(np.zeros((4, 4), np.int16), np.ones((4, 4), np.int16)) == 0     # smaller than a tile


def test_finalcheck_on_a_real_render(tmp_path, tiny, capsys):
    sb = _write(tmp_path, tiny)
    assert cli.main(["finalcheck", sb]) == 2                                 # nothing rendered yet
    out = str(tmp_path / "short.mp4")
    assert cli.main(["render", sb, "--out", out, "--draft", "--workers", "1"]) == 0
    capsys.readouterr()
    assert cli.main(["finalcheck", sb, "--workers", "1"]) == 0
    text = capsys.readouterr().out
    assert "PASS:" in text and "540x960, 2 shots match the storyboard" in text and "no voice given" in text
    assert "scene  0" not in text                                            # the quiet path prints no timing table

    edited = copy.deepcopy(tiny)                                             # one expression changed after the render
    edited["scenes"][1]["cast"][0]["mood"] = "crying"
    assert cli.main(["finalcheck", _write(tmp_path, edited, "edited.json"), "--video", out, "--workers", "1"]) == 1
    text = capsys.readouterr().out
    assert "scene 1: at" in text and "does not show what the storyboard draws" in text and "scene 0:" not in text

    longer = copy.deepcopy(tiny)                                             # the plan has scenes the file never reached
    longer["scenes"] = tiny["scenes"] * 3
    assert cli.main(["finalcheck", _write(tmp_path, longer, "longer.json"), "--video", out, "--workers", "1"]) == 1
    text = capsys.readouterr().out
    assert "the render stopped early" in text and "has no picture at" in text
    (tmp_path / "junk.mp4").write_text("not a video", encoding="utf-8")
    with pytest.raises(ValueError):
        fc.probe(find_ffmpeg(), str(tmp_path / "junk.mp4"))


def test_finalcheck_hears_every_line(tmp_path, tiny, capsys):
    t = np.arange(int(1.2 * SR)) / SR
    tone = (0.3 * np.sin(2 * np.pi * 220 * t)).astype(np.float32)
    gap = np.zeros(int(0.5 * SR), np.float32)
    voice = str(tmp_path / "voice.wav")
    write_wav(voice, np.concatenate([tone, gap, tone, gap]))                 # two "lines" with a pause between them
    sb, out = _write(tmp_path, tiny), str(tmp_path / "short.mp4")
    assert cli.main(["render", sb, "--audio", voice, "--out", out, "--draft", "--workers", "1"]) == 0
    capsys.readouterr()
    assert cli.main(["finalcheck", sb, "--audio", voice, "--workers", "1"]) == 0
    text = capsys.readouterr().out
    assert "shots match the storyboard" in text and "no voice given" not in text
    ff = find_ffmpeg()
    muted = str(tmp_path / "muted.mp4")
    subprocess.run([ff, "-y", "-v", "error", "-i", out, "-c:v", "copy", "-af", "volume=0", muted], check=True)
    assert cli.main(["finalcheck", sb, "--audio", voice, "--video", muted, "--workers", "1"]) == 1
    assert 'the line "A man sold a tower." is silent in the file' in capsys.readouterr().out
    silent = str(tmp_path / "nosound.mp4")
    subprocess.run([ff, "-y", "-v", "error", "-i", out, "-c:v", "copy", "-an", silent], check=True)
    assert cli.main(["finalcheck", sb, "--audio", voice, "--video", silent, "--workers", "1"]) == 1
    assert "no sound track" in capsys.readouterr().out
