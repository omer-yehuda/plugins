import json
from pathlib import Path

import pytest

SKILL = Path(__file__).resolve().parents[1] / "skills" / "toon"
EXAMPLES = SKILL / "examples"


@pytest.fixture
def onoda() -> dict:
    return json.loads((EXAMPLES / "onoda.json").read_text(encoding="utf-8"))


@pytest.fixture
def tiny() -> dict:
    """two short scenes that touch most engine paths but render fast"""
    return {
        "title": "Tiny",
        "characters": {
            "a": {"skin": "medium", "hair_style": "curly", "outfit": "suit", "outfit_color": "teal"},
            "b": {"skin": "deep", "hat": "headscarf", "outfit": "dress", "outfit_color": "yellow"},
        },
        "scenes": [
            {"say": "A man sold a tower.", "set": {"place": "city", "time": "night", "landmark": "lattice_tower",
                                                   "front": "crowd"},
             "cast": [{"id": "a", "x": 0.3, "mood": "sly", "pose": "point", "enter": "slide_left", "talking": True},
                      {"id": "b", "x": 0.7, "mood": "shocked", "pose": "walk", "facing": "left", "enter": "pop"}],
             "props": [{"type": "money", "x": 0.5, "y": 0.3, "anim": "float", "at": 0.0},
                       {"type": "coin", "x": 0.2, "y": 0.2, "anim": "spin", "behind": True}],
             "camera": "punch_in"},
            {"say": "Twice!", "set": {"place": "prison", "front": "bars"},
             "cast": [{"id": "a", "x": 0.5, "mood": "laughing", "pose": "run"}],
             "props": [{"type": "star", "anim": "pulse"}], "camera": "shake"},
        ],
    }


@pytest.fixture
def home(tmp_path, monkeypatch) -> Path:
    monkeypatch.setenv("TOON_SHORTS_HOME", str(tmp_path / "home"))
    return tmp_path / "home"
