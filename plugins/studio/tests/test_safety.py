"""Hostile inputs: free text never reaches a shell, outputs and images stay inside the production folder."""
import json
import os
import subprocess
from pathlib import Path

import pytest

from conftest import EXAMPLE, needs_ffmpeg
from studiokit import cli, inputfile, safety, spec
from studiokit.model import SpecError

HOSTILE = ["$(touch /tmp/pwn-studio)", "`touch /tmp/pwn-studio`", "x; rm -rf /tmp/pwn-studio-dir", "../../etc/passwd",
           "--help", "-rf", "line1\nline2$(id)", "a" * 5000, "", "???", "../../../.bashrc\n"]


def run(*args):
    return cli.main([str(a) for a in args])


@pytest.mark.parametrize("text", HOSTILE, ids=range(len(HOSTILE)))
def test_slugify_is_safe(text):
    s = safety.slugify(text)
    assert s and len(s) <= safety.MAX_SLUG
    assert all(c in "abcdefghijklmnopqrstuvwxyz0123456789-" for c in s) and not s.startswith("-")


@pytest.mark.parametrize("text", HOSTILE, ids=range(len(HOSTILE)))
def test_init_title_file_makes_safe_folder(tmp_path, capsys, text):
    f = inputfile.prep()
    f.write_text(text, encoding="utf-8")
    assert run("init", "--title-file", f, "--root", tmp_path) == 0
    prod = Path(capsys.readouterr().out.strip())
    assert prod.parent == (tmp_path / ".studio" / "productions").resolve()
    assert len(prod.name) <= 11 + safety.MAX_SLUG and not f.exists() and not f.parent.exists()
    assert (prod / "topic.txt").read_text(encoding="utf-8") == text[:2000]
    assert not os.path.exists("/tmp/pwn-studio")


def test_init_never_reuses_a_folder(tmp_path, capsys):
    run("init", "same", "--root", tmp_path)
    run("init", "same", "--root", tmp_path)
    a, b = capsys.readouterr().out.split()
    assert a != b and b.endswith("-same-2")


def test_init_refuses_symlinked_and_tracked_studio(tmp_path, capsys):
    outside = tmp_path / "outside"
    outside.mkdir()
    root = tmp_path / "p"
    root.mkdir()
    (root / ".studio").symlink_to(outside)
    assert run("init", "x", "--root", root) == 1
    assert list(outside.iterdir()) == []
    root2 = tmp_path / "q"
    (root2 / ".studio").mkdir(parents=True)
    subprocess.run(["git", "init", "-q"], cwd=root2, check=True)
    (root2 / ".studio" / "x").write_text("planted")
    subprocess.run(["git", "add", "-f", ".studio"], cwd=root2, check=True)
    assert run("init", "x", "--root", root2) == 1
    assert "tracked" in capsys.readouterr().err


def sb_in(tmp_path, scenes, **top):
    d = tmp_path / "prod"
    d.mkdir(exist_ok=True)
    (d / "sb.json").write_text(json.dumps({"title": "T", "scenes": scenes, **top}))
    return d / "sb.json"


@pytest.mark.parametrize("img", ["../secret.png", "/etc/hostname.png", "sub/../../x.png"])
def test_image_paths_cannot_leave_the_folder(tmp_path, img):
    (tmp_path / "secret.png").write_bytes(b"x")
    p = sb_in(tmp_path, [{"type": "image", "image": img}])
    with pytest.raises(SpecError, match="inside the storyboard folder"):
        spec.load(p)


def test_image_symlink_out_is_rejected(tmp_path, photo):
    p = sb_in(tmp_path, [{"type": "image", "image": "link.png"}])
    (p.parent / "link.png").symlink_to(photo)             # photo lives outside prod/
    with pytest.raises(SpecError, match="inside the storyboard folder"):
        spec.load(p)


def test_audio_cannot_leave_the_folder(tmp_path):
    (tmp_path / "v.wav").write_bytes(b"x")
    p = sb_in(tmp_path, [{"type": "title", "text": "Hi"}], audio="../v.wav")
    with pytest.raises(SpecError, match="inside the storyboard folder"):
        spec.load(p)


def test_out_dir_must_stay_inside(tmp_path, capsys):
    p = sb_in(tmp_path, [{"type": "title", "text": "Hi there"}])
    assert run("render", p, "--out", tmp_path / "elsewhere") == 1
    assert run("render", p, "--out", p.parent / ".." / "x") == 1
    assert run("preview", p, "--out", tmp_path / "x.png") == 1
    assert not (tmp_path / "elsewhere").exists()
    assert "must stay inside" in capsys.readouterr().err


def test_preview_and_render_refuse_symlink_outputs(tmp_path, capsys):
    p = sb_in(tmp_path, [{"type": "title", "text": "Hi there"}])
    target = tmp_path / "victim.txt"
    target.write_text("keep")
    (p.parent / "preview.png").symlink_to(target)
    assert run("preview", p) == 1
    assert target.read_text() == "keep"
    (p.parent / "video.mp4").symlink_to(target)
    assert run("render", p, "--scale", "0.1", "--fps", "5") == 1
    assert target.read_text() == "keep" and "symlink" in capsys.readouterr().err


def test_audio_path_file_is_read(tmp_path):
    p = sb_in(tmp_path, [{"type": "title", "text": "Hi there"}])
    f = tmp_path / "ap.txt"
    f.write_text(str(tmp_path / "nope.wav") + "\n")
    assert run("render", p, "--audio-path-file", f) == 1     # file not found, handled cleanly


def test_git_tracked_without_git(monkeypatch, tmp_path):
    monkeypatch.setattr(safety.subprocess, "run", lambda *a, **k: (_ for _ in ()).throw(OSError("no git")))
    assert safety.git_tracked(tmp_path, ".studio") is False


def test_new_dir_gives_up(tmp_path, monkeypatch):
    monkeypatch.setattr(Path, "mkdir", lambda *a, **k: (_ for _ in ()).throw(FileExistsError()))
    with pytest.raises(SpecError):
        safety.new_dir(tmp_path, "x")


def test_requirements_are_hash_locked():
    text = (Path(__file__).resolve().parents[1] / "requirements.txt").read_text()
    for pin in ("pillow==13.0.0", "numpy==2.5.4", "imageio-ffmpeg==0.8.1"):   # one venv for explainer, toon and film
        assert pin in text
    assert text.count("--hash=sha256:") >= 30
    assert all(line.startswith(("#", "    --hash=sha256:")) or line.endswith(" \\") or "==" in line for line in text.splitlines() if line)
    assert "pytest" not in text


def test_example_still_valid():
    assert run("check", EXAMPLE) == 0
