"""Where things live: skill assets (read-only) and the user's data dir (venv, models)."""
import os
import sys
from pathlib import Path

SKILL_DIR = Path(__file__).resolve().parents[2]
PLUGIN_DIR = SKILL_DIR.parents[1]
FONT = SKILL_DIR / "assets" / "fonts" / "Rubik.ttf"


def home() -> Path:
    """Data dir for the venv and models, shared with every Studio format (one venv, one voice model download).
    Override with STUDIO_HOME (TOON_SHORTS_HOME still works, for setups made before toon-shorts joined Studio)."""
    env = os.environ.get("TOON_SHORTS_HOME") or os.environ.get("STUDIO_HOME")
    return Path(env) if env else Path.home() / ".cache" / "studio-plugin"


def venv_dir() -> Path:
    return home() / "venv"


def venv_python(venv: Path | None = None) -> Path:
    v = venv or venv_dir()
    return v / ("Scripts/python.exe" if os.name == "nt" else "bin/python")


def models_dir() -> Path:
    return home() / "models"


def in_venv(venv: Path | None = None) -> bool:
    v = (venv or venv_dir()).resolve()
    try:
        return Path(sys.prefix).resolve() == v
    except OSError:
        return False


def requirements(kind: str) -> Path:
    name = {"render": "requirements.txt", "voice": "requirements-voice.txt"}[kind]
    return PLUGIN_DIR / name
