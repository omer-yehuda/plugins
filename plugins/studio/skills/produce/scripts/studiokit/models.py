"""Kokoro voice model files: hash-verified download into the Studio data folder. Only `setup --voice` calls fetch."""
import hashlib
import os
import urllib.request
from pathlib import Path

from .paths import home

RELEASE = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/"
MODELS = {   # name: (sha256, size), same files and hashes as toon-shorts; a mismatch deletes the download
    "kokoro-v1.0.int8.onnx": ("6e742170d309016e5891a994e1ce1559c702a2ccd0075e67ef7157974f6406cb", 92361271),
    "voices-v1.0.bin": ("bca610b8308e8d99f32e6fe4197e7ec01679264efed0cac9140fe9c29f1fbf7d", 28214398),
}


class ModelError(RuntimeError):
    pass


def models_dir() -> Path:
    return home() / "models"


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def model_ok(name: str, folder: Path | None = None) -> bool:
    path = (folder or models_dir()) / name
    want, size = MODELS[name]
    return path.is_file() and not path.is_symlink() and path.stat().st_size == size and sha256(path) == want


def emotion_model(folder: Path | None = None) -> Path:
    """The emotion copy of the verified Kokoro model, made locally on first use (no download)."""
    from .emotion import build_model
    folder = folder or models_dir()
    base, out = folder / "kokoro-v1.0.int8.onnx", folder / "kokoro-v1.0.int8.emo.onnx"
    if not model_ok(base.name, folder):
        raise ModelError("voice model missing or unverified. Ask the user, then run `studio.py setup --voice --yes`.")
    if out.is_symlink():
        out.unlink()
    if not out.is_file() or out.stat().st_mtime < base.stat().st_mtime:
        build_model(base, out)
    return out


def voice_ready() -> bool:
    return all(model_ok(n) for n in MODELS)


def fetch(name: str, folder: Path | None = None, log=print, opener=urllib.request.urlopen) -> Path:
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
        raise ModelError(f"download failed ({e}). Check network access to github.com.") from e
    got = sha256(tmp)
    if got != want:
        tmp.unlink(missing_ok=True)
        raise ModelError(f"{name}: sha256 mismatch (got {got[:16]}, want {want[:16]}). File deleted, not used.")
    os.replace(tmp, path)
    return path
