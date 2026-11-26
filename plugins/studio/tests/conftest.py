import copy
import json
import shutil
from pathlib import Path

import pytest

SKILL = Path(__file__).resolve().parents[1] / "skills" / "produce"
EXAMPLE = SKILL / "examples" / "what-is-a-skill.json"

needs_ffmpeg = pytest.mark.skipif(not (shutil.which("ffmpeg") and shutil.which("ffprobe")),
                                  reason="ffmpeg/ffprobe not installed")


@pytest.fixture
def example() -> dict:
    return json.loads(EXAMPLE.read_text(encoding="utf-8"))


@pytest.fixture
def board():
    """Factory: a valid storyboard dict with the given scenes."""
    def make(*scenes, **top):
        data = {"title": "T", "scenes": [copy.deepcopy(s) for s in scenes]}
        data.update(top)
        return data
    return make


@pytest.fixture
def photo(tmp_path) -> Path:
    from PIL import Image
    p = tmp_path / "pic.png"
    im = Image.new("RGB", (800, 500), (30, 120, 200))
    for x in range(0, 800, 40):
        im.paste((250, 200, 40), (x, 0, x + 20, 500))
    im.save(p)
    return p


@pytest.fixture(autouse=True)
def studio_home(tmp_path, monkeypatch):
    monkeypatch.setenv("STUDIO_HOME", str(tmp_path / "home"))
    return tmp_path / "home"


def _can_symlink() -> bool:
    import os
    import tempfile
    with tempfile.TemporaryDirectory() as d:
        try:
            os.symlink(d, os.path.join(d, "l"))
            return True
        except OSError:  # Windows without Developer Mode
            return False


def pytest_collection_modifyitems(items):
    """Skip tests that create symlinks where the OS does not allow it; they still run in CI."""
    import inspect
    if _can_symlink():
        return
    skip = pytest.mark.skip(reason="cannot create symlinks on this machine")
    for item in items:
        fn = getattr(item, "function", None)
        if fn is not None and "symlink_to(" in inspect.getsource(fn):
            item.add_marker(skip)
