"""1.3.0: finalcheck compares the rendered file with what the storyboard draws, scene by scene."""
import json

import pytest

from conftest import needs_ffmpeg
from studiokit import cli
from studiokit import finalcheck as fc

SCENES = [{"type": "title", "text": "Hello there", "duration": 2}, {"type": "stat", "value": 40, "label": "percent", "duration": 2},
          {"type": "cta", "text": "Bye", "duration": 2}]


def test_difference_finds_one_changed_tile():
    size = (16, 16)
    a = bytes(256)
    b = bytearray(256)
    assert fc.difference(a, bytes(b), size) == 0
    for y in range(8, 16):
        for x in range(8, 16):
            b[y * 16 + x] = 200
    assert fc.difference(a, bytes(b), size) == 200          # one tile of four changed: not averaged down to 50


@needs_ffmpeg
def test_finalcheck_on_a_real_render(tmp_path, board, capsys):
    path = tmp_path / "storyboard.json"
    path.write_text(json.dumps(board(*SCENES)), encoding="utf-8")
    assert cli.main(["finalcheck", str(path)]) == cli.EXIT_INVALID          # nothing rendered yet
    assert cli.main(["render", str(path), "--scale", "0.25", "--fps", "10"]) == 0
    capsys.readouterr()
    assert cli.main(["finalcheck", str(path)]) == 0
    out = capsys.readouterr().out
    assert out.startswith("PASS: 6s, 270x480, 3 of 3 scenes match the storyboard") and "no sound" in out

    edited = tmp_path / "edited.json"                      # one word changed after the render
    edited.write_text(json.dumps(board(SCENES[0], {**SCENES[1], "label": "of all people"}, SCENES[2])), encoding="utf-8")
    assert cli.main(["finalcheck", str(edited), "--video", str(tmp_path / "video.mp4")]) == 1
    out = capsys.readouterr().out
    assert "scene 1 (stat)" in out and "scene 0" not in out and "scene 2" not in out

    longer = tmp_path / "longer.json"                      # the plan has a scene the file never reached
    longer.write_text(json.dumps(board(*SCENES, {"type": "title", "text": "Extra", "duration": 3})), encoding="utf-8")
    assert cli.main(["finalcheck", str(longer), "--video", str(tmp_path / "video.mp4")]) == 1
    out = capsys.readouterr().out
    assert "the file is 6.0s but the storyboard adds up to 9.0s" in out and "has no picture at" in out


@needs_ffmpeg
def test_finalcheck_shape_sound_and_bad_files(tmp_path, board, capsys):
    path = tmp_path / "storyboard.json"
    path.write_text(json.dumps(board(*SCENES[:2])), encoding="utf-8")
    assert cli.main(["render", str(path), "--scale", "0.25", "--fps", "10"]) == 0
    video = tmp_path / "video.mp4"
    wide = tmp_path / "wide.json"
    wide.write_text(json.dumps(board(*SCENES[:2], format="wide")), encoding="utf-8")
    assert cli.main(["finalcheck", str(wide), "--video", str(video)]) == 1
    assert "not the 'wide' format" in capsys.readouterr().out
    info = fc.probe(video)
    assert info["size"] == (270, 480) and info["fps"] == 10 and not info["audio"] and abs(info["seconds"] - 4) < 0.2
    assert fc.grab(video, 99.0, (8, 8)) is None
    (tmp_path / "junk.mp4").write_text("not a video", encoding="utf-8")
    with pytest.raises(fc.FfmpegError):
        fc.probe(tmp_path / "junk.mp4")
    assert cli.main(["finalcheck", str(path), "--video", str(tmp_path / "junk.mp4")]) == cli.EXIT_ERROR


@needs_ffmpeg
def test_finalcheck_with_narration_and_fit_audio(tmp_path, board, monkeypatch, capsys):
    import subprocess

    from studiokit import voice
    from test_voice_audio import FakeTTS
    monkeypatch.setattr(voice, "engine", lambda: FakeTTS())
    path = tmp_path / "storyboard.json"
    path.write_text(json.dumps(board({"type": "title", "text": "Hi", "say": "Hello, world."},
                                     {"type": "cta", "text": "Bye", "say": "See you soon."})), encoding="utf-8")
    assert cli.main(["voice", str(path)]) == 0
    assert cli.main(["render", str(path), "--scale", "0.25", "--fps", "10"]) == 0
    capsys.readouterr()
    cli.main(["finalcheck", str(path)])
    out = capsys.readouterr().out
    assert "scenes match the storyboard" in out or "sound:" in out          # the line-by-line sound check ran
    assert "no voice.lines.json" not in out and "does not show" not in out
    assert fc.probe(tmp_path / "video.mp4")["audio"]

    fit = tmp_path / "fit"
    fit.mkdir()
    sb = fit / "storyboard.json"
    sb.write_text(json.dumps(board(*SCENES)), encoding="utf-8")                # 6 s of scenes
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=300:duration=8",
                    str(fit / "music.wav")], check=True)
    assert cli.main(["render", str(sb), "--scale", "0.25", "--fps", "10", "--audio", str(fit / "music.wav"), "--fit-audio"]) == 0
    capsys.readouterr()
    assert cli.main(["finalcheck", str(sb)]) == 1                              # 8 s file against a 6 s plan
    assert "adds up to 6.0s" in capsys.readouterr().out
    assert cli.main(["finalcheck", str(sb), "--fit-audio"]) == 0
    assert "3 of 3 scenes match" in capsys.readouterr().out
