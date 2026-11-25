"""prep + input-file safety: only files inside a fresh prep folder are read or deleted."""
import os

import pytest

from studiokit import cli, inputfile


def run(*args):
    return cli.main([str(a) for a in args])


def test_prep_prints_a_fresh_private_path(tmp_path, capsys):
    assert run("prep", "--root", tmp_path) == 0
    p = capsys.readouterr().out.strip()
    assert run("prep", "--root", tmp_path) == 0
    q = capsys.readouterr().out.strip()
    assert p != q and os.path.isdir(os.path.dirname(p)) and not os.path.exists(p)
    if os.name == "posix":  # Windows has no POSIX mode bits; the temp folder ACL is per-user there
        assert (os.stat(os.path.dirname(p)).st_mode & 0o077) == 0


def test_prep_refuses_a_symlinked_studio(tmp_path, capsys):
    (tmp_path / "elsewhere").mkdir()
    (tmp_path / ".studio").symlink_to(tmp_path / "elsewhere")
    assert run("prep", "--root", tmp_path) == 1


def test_files_outside_a_prep_folder_are_refused_and_kept(tmp_path):
    f = tmp_path / "secret.txt"
    f.write_text("keep me", encoding="utf-8")
    assert run("init", "--title-file", f, "--root", tmp_path) != 0
    assert f.read_text(encoding="utf-8") == "keep me"


def test_symlink_input_is_refused(tmp_path):
    target = tmp_path / "secret.txt"
    target.write_text("keep me", encoding="utf-8")
    f = inputfile.prep()
    f.symlink_to(target)
    with pytest.raises(inputfile.InputFileError):
        inputfile.read_prep_file(f)
    assert target.read_text(encoding="utf-8") == "keep me"


def test_symlinked_prep_folder_is_refused(tmp_path):
    real = tmp_path / "real"
    real.mkdir()
    (real / "t.txt").write_text("x", encoding="utf-8")
    link = inputfile.tmp_root() / f"{inputfile.PREFIX}link-{os.getpid()}"
    link.symlink_to(real)
    try:
        with pytest.raises(inputfile.InputFileError):
            inputfile.read_prep_file(link / "t.txt")
    finally:
        link.unlink()


def test_missing_and_directory_inputs(tmp_path):
    f = inputfile.prep()
    with pytest.raises(inputfile.InputFileError):
        inputfile.read_prep_file(f)          # not written yet
    f.mkdir()
    with pytest.raises(inputfile.InputFileError):
        inputfile.read_prep_file(f)          # a directory, not a file
    f.rmdir()
    f.parent.rmdir()


def test_discard_keeps_a_non_empty_folder(tmp_path):
    f = inputfile.prep()
    f.write_text("x", encoding="utf-8")
    (f.parent / "other").write_text("y", encoding="utf-8")
    inputfile.discard(f)
    assert not f.exists() and (f.parent / "other").exists()
