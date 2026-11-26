import json
import subprocess
import sys
from pathlib import Path

import pytest

from conftest import EXAMPLE, SKILL, needs_ffmpeg
from studiokit import cli, paths, setup_env

ENTRY = SKILL / "scripts" / "studio.py"


def run(*args):
    return cli.main([str(a) for a in args])


def test_init_creates_protected_folder(tmp_path, capsys):
    assert run("init", "My Cool Video!!", "--root", tmp_path) == 0
    prod = Path(capsys.readouterr().out.strip())
    assert prod.is_dir() and prod.name.endswith("-my-cool-video") and prod.parent.name == "productions"
    assert (tmp_path / ".studio" / ".gitignore").read_text() == "*\n"
    (tmp_path / ".studio" / ".gitignore").write_text("x")
    run("init", "!!!", "--root", tmp_path)
    assert (tmp_path / ".studio" / ".gitignore").read_text() == "*\n"          # re-protected
    assert "-video" in capsys.readouterr().out


def test_check_ok_invalid_and_strict(tmp_path, capsys):
    assert run("check", EXAMPLE) == 0
    assert "OK: 8 scenes" in capsys.readouterr().out
    bad = tmp_path / "bad.json"
    bad.write_text(json.dumps({"title": "x", "scenes": [{"type": "stat", "value": "n", "label": "l"}]}))
    assert run("check", bad) == 1
    assert "scene 0 (stat)" in capsys.readouterr().out
    warn = tmp_path / "w.json"
    warn.write_text(json.dumps({"title": "x", "scenes": [{"type": "title", "text": "Hi", "duration": 5}]}))
    assert run("check", warn) == 0 and run("check", warn, "--strict") == 1


@pytest.fixture
def sb_copy(tmp_path):
    """The example storyboard copied into a production-like folder (outputs must stay inside it)."""
    import shutil
    d = tmp_path / "prod"
    d.mkdir()
    return shutil.copy(EXAMPLE, d / "storyboard.json")


def test_preview_writes_png(sb_copy, capsys):
    from PIL import Image
    out = Path(sb_copy).parent / "sheet.png"
    assert run("preview", sb_copy, "--out", out) == 0
    w, h = Image.open(out).size
    assert w > 1000 and h > 1000 and "contact sheet" in capsys.readouterr().out
    assert run("preview", sb_copy, "--out", out, "--no-guides") == 0


def test_bad_inputs_exit_cleanly(tmp_path, capsys):
    assert run("render", EXAMPLE, "--scale", "2") == 2
    assert run("preview", tmp_path / "missing.json") == 1
    assert "cannot read" in capsys.readouterr().err
    assert run("render", EXAMPLE, "--audio", tmp_path / "nope.wav") == 1


@needs_ffmpeg
def test_cli_render_small(sb_copy, capsys):
    out = Path(sb_copy).parent
    assert run("render", sb_copy, "--scale", "0.1", "--fps", "5") == 0
    assert (out / "video.mp4").exists() and "video:" in capsys.readouterr().out


def test_doctor(capsys, monkeypatch):
    assert run("doctor") in (0, 4)
    assert "Pillow" in capsys.readouterr().out
    monkeypatch.setattr(setup_env, "ffmpeg_status", lambda: (False, "no ffmpeg"))
    assert run("doctor") == 4


def test_ffmpeg_missing_exit_code(monkeypatch, capsys):
    monkeypatch.setattr(paths.shutil, "which", lambda n: None)
    assert run("render", EXAMPLE, "--scale", "0.1") == 4
    assert "brew install ffmpeg" in capsys.readouterr().err


def test_ffmpeg_status_variants(monkeypatch):
    monkeypatch.setattr(setup_env, "find_tool", lambda n: None)
    ok, msg = setup_env.ffmpeg_status()
    assert not ok and "never installs system packages" in msg
    monkeypatch.setattr(setup_env, "find_tool", lambda n: "/bin/true")
    monkeypatch.setattr(setup_env.subprocess, "run", lambda *a, **k: subprocess.CompletedProcess(a, 0, "none", ""))
    assert "libx264" in setup_env.ffmpeg_status()[1]
    monkeypatch.setattr(setup_env.subprocess, "run", lambda *a, **k: subprocess.CompletedProcess(a, 0, " libx264 ", ""))
    assert setup_env.ffmpeg_status()[0]


class FakeTTY:
    def __init__(self, tty):
        self._tty = tty

    def isatty(self):
        return self._tty


def test_confirmation_rules():
    assert setup_env.confirmed(True, FakeTTY(False))
    assert not setup_env.confirmed(False, FakeTTY(False))            # no terminal, no --yes: refuse
    assert setup_env.confirmed(False, FakeTTY(True), lambda _: "Y")
    assert not setup_env.confirmed(False, FakeTTY(True), lambda _: "")


def test_setup_refuses_without_consent(studio_home):
    logs = []
    with pytest.raises(setup_env.SetupError, match="nothing was installed"):
        setup_env.setup(False, log=logs.append, stdin=FakeTTY(False))
    assert not studio_home.exists()                                    # nothing created
    assert "pillow==13.0.0" in logs[0] and "system packages" in logs[0]


def test_setup_with_consent_uses_private_venv(studio_home, monkeypatch):
    calls = []

    def fake_run(cmd, **kw):
        calls.append(cmd)
        return subprocess.CompletedProcess(cmd, 0, "", "")

    monkeypatch.setattr(setup_env.subprocess, "run", fake_run)
    monkeypatch.setattr(setup_env, "ffmpeg_status", lambda: (True, "ffmpeg ok"))
    assert setup_env.setup(True, log=lambda m: None) == 0
    assert calls[0][:3] == [sys.executable, "-m", "venv"] and str(studio_home) in calls[0][3]
    assert calls[1][1:4] == ["-m", "pip", "install"] and str(paths.REQUIREMENTS) in calls[1]
    monkeypatch.setattr(setup_env, "ffmpeg_status", lambda: (False, "missing"))
    assert setup_env.setup(True, log=lambda m: None) == 4


def test_setup_pip_failure(studio_home, monkeypatch):
    monkeypatch.setattr(setup_env.subprocess, "run", lambda c, **k: subprocess.CompletedProcess(c, 1, "", "boom"))
    with pytest.raises(setup_env.SetupError, match="pip failed"):
        setup_env.setup(True, log=lambda m: None)


def test_cli_maps_setup_error(monkeypatch, capsys):
    monkeypatch.setattr(sys, "stdin", FakeTTY(False))
    assert run("setup") == 2
    assert "nothing was installed" in capsys.readouterr().err


def test_entrypoint_check_and_not_set_up(tmp_path):
    env = {"PATH": "/usr/bin:/bin", "STUDIO_HOME": str(tmp_path / "h"), "STUDIO_NO_VENV": "1"}
    ok = subprocess.run([sys.executable, str(ENTRY), "check", str(EXAMPLE)], capture_output=True, text=True, env=env)
    assert ok.returncode == 0 and "OK: 8 scenes" in ok.stdout
    probe = subprocess.run([sys.executable, "-I", "-c", "import PIL"], capture_output=True)
    if probe.returncode != 0:      # system python without Pillow: preview must say "not set up", exit 3
        r = subprocess.run([sys.executable, str(ENTRY), "preview", str(EXAMPLE)], capture_output=True, text=True, env=env)
        assert r.returncode == 3 and "setup --yes" in r.stderr
