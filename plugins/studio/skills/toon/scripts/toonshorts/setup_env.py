"""Explicit, consent-first setup: a private venv with pinned packages + hash-verified model files.

Nothing here runs implicitly; `toon.py setup [--voice]` is the only entry point.
"""
import hashlib
import os
import subprocess
import sys
import urllib.request
from pathlib import Path

from .paths import models_dir, requirements, venv_dir, venv_python

RELEASE = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/"
MODELS = {   # name: (sha256, size) - verified 2026-11-19; a mismatch aborts and deletes the download
    "kokoro-v1.0.int8.onnx": ("6e742170d309016e5891a994e1ce1559c702a2ccd0075e67ef7157974f6406cb", 92361271),
    "voices-v1.0.bin": ("bca610b8308e8d99f32e6fe4197e7ec01679264efed0cac9140fe9c29f1fbf7d", 28214398),
}


class SetupError(RuntimeError):
    pass


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def make_venv(log=print) -> Path:
    v = venv_dir()
    py = venv_python(v)
    if not py.exists():
        log(f"creating venv at {v}")
        v.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run([sys.executable, "-m", "venv", str(v)], check=True)
    return py


def pip_install(kind: str, log=print) -> None:
    py = make_venv(log)
    req = requirements(kind)
    log(f"installing pinned packages from {req.name} into the Studio venv")
    locked = ["--require-hashes", "--only-binary=:all:"] if kind == "render" else []   # render pins are hash-locked
    r = subprocess.run([str(py), "-m", "pip", "install", "--disable-pip-version-check", "-q", *locked, "-r", str(req)],
                       capture_output=True, text=True)
    if r.returncode != 0:
        raise SetupError(f"pip failed:\n{r.stderr[-2000:]}")


def model_ok(name: str, folder: Path | None = None) -> bool:
    path = (folder or models_dir()) / name
    want, size = MODELS[name]
    return path.exists() and path.stat().st_size == size and sha256(path) == want


def fetch_model(name: str, folder: Path | None = None, log=print, opener=urllib.request.urlopen) -> Path:
    folder = folder or models_dir()
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / name
    if model_ok(name, folder):
        return path
    want, size = MODELS[name]
    tmp = path.with_suffix(path.suffix + ".part")
    log(f"downloading {name} ({size >> 20} MB) from github.com/thewh1teagle/kokoro-onnx")
    req = urllib.request.Request(RELEASE + name, headers={"User-Agent": "studio-plugin"})
    try:
        with opener(req, timeout=120) as r, open(tmp, "wb") as f:
            got = 0
            for block in iter(lambda: r.read(1 << 20), b""):
                got += len(block)
                if got > size:
                    raise OSError(f"server sent more than the expected {size} bytes")
                f.write(block)
    except OSError as e:
        tmp.unlink(missing_ok=True)
        raise SetupError(f"download failed ({e}). Check network access to github.com, or use your own voice.") from e
    got = sha256(tmp)
    if got != want:
        tmp.unlink(missing_ok=True)
        raise SetupError(f"{name}: sha256 mismatch (got {got[:16]}…, want {want[:16]}…). File deleted; "
                         "the release may have been tampered with. Not using it.")
    os.replace(tmp, path)
    return path


def setup(voice: bool, log=print) -> None:
    pip_install("render", log)
    if voice:
        pip_install("voice", log)
        for name in MODELS:
            fetch_model(name, log=log)
    log(f"ready. venv: {venv_dir()}" + (f"  models: {models_dir()}" if voice else ""))
