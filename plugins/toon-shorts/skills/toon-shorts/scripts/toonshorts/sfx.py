"""Action sounds: one short sound for each thing that happens on screen, placed on the frame it happens.

Automatic: a character popping in (pop), sliding in (whoosh), a shock or scare (sting), anger (thud),
walking or running (soft steps). Extra ones come from a scene's "sfx" list. Every sound is synthesized,
faded at both edges (no clicks), and has no noise floor. Reactions and steps start on the line's first word,
so the pauses between lines stay quiet (the channel check wants them under -35 dBFS)."""
import math

import numpy as np

from . import SR
from .audio import _edges, pop, whoosh

KINDS = ["pop", "whoosh", "sting", "thud", "ding", "tap"]
GAIN = {"pop": 0.09, "whoosh": 0.035, "sting": 0.14, "thud": 0.22, "ding": 0.12, "tap": 0.07}
SHOCK = {"shocked", "scared"}
ANGER = {"angry", "furious"}


def _t(seconds: float) -> np.ndarray:
    return np.linspace(0, seconds, int(SR * seconds), endpoint=False, dtype=np.float32)


def sting(seconds: float = 0.32) -> np.ndarray:
    """two quick rising notes, the classic cartoon 'uh-oh'"""
    t = _t(seconds)
    f = np.where(t < seconds / 2, 660.0, 990.0)
    tone = np.sin(2 * math.pi * f * t) + 0.3 * np.sin(4 * math.pi * f * t)
    return _edges(tone * np.exp(-(t % (seconds / 2)) * 9) * 0.45, 4)


def thud(seconds: float = 0.25) -> np.ndarray:
    t = _t(seconds)
    f = 110 - 50 * t / seconds
    return _edges(np.sin(2 * math.pi * f * t) * np.exp(-t * 18) * 0.9, 3)


def ding(seconds: float = 0.6) -> np.ndarray:
    t = _t(seconds)
    tone = np.sin(2 * math.pi * 1320 * t) + 0.4 * np.sin(2 * math.pi * 2640 * t)
    return _edges(tone * np.exp(-t * 7) * 0.4, 4)


def tap(seconds: float = 0.05) -> np.ndarray:
    t = _t(seconds)
    return _edges(np.sin(2 * math.pi * 180 * t) * np.exp(-t * 90), 2)


def sound(kind: str, n: int = 0) -> np.ndarray:
    if kind == "whoosh":
        return whoosh(0.3, seed=n + 7)
    return {"pop": pop, "sting": sting, "thud": thud, "ding": ding, "tap": tap}[kind]()


def _steps(t0: float, t1: float, run: bool) -> list[tuple[float, str]]:
    gap = 0.26 if run else 0.42
    k = max(0, int((t1 - t0) / gap) + 1)
    return [(t0 + j * gap, "tap") for j in range(min(k, 24))]


def events(sb: dict, timing) -> list[tuple[float, str]]:
    """-> sorted (time, kind) for every on-screen action"""
    out: list[tuple[float, str]] = []
    prev: dict[str, str] = {}
    for sc, (t0, t1, wl) in zip(sb.get("scenes", []), timing):
        moods: dict[str, str] = {}
        say = max(t0, wl[0][1]) if wl else t0          # the line's first word
        for c in sc.get("cast", []):
            cid, mood, enter = c.get("id", ""), c.get("mood", "neutral"), c.get("enter", "none")
            moods[cid] = mood
            if enter == "pop":
                out.append((t0 + 0.02, "pop"))
            elif enter in ("slide_left", "slide_right"):
                out.append((t0, "whoosh"))
            if mood in SHOCK and prev.get(cid) not in SHOCK:
                out.append((say, "sting"))
            elif mood in ANGER and prev.get(cid) not in ANGER:
                out.append((say, "thud"))
            if c.get("pose") in ("walk", "run"):
                out += _steps(say, wl[-1][2] if wl else t1, c.get("pose") == "run")
        for s in sc.get("sfx", []):
            if isinstance(s, dict) and s.get("type") in KINDS:
                out.append((t0 + float(s.get("at", 0)) * (t1 - t0), s["type"]))
        prev = moods
    return sorted(out)


def lay(out: np.ndarray, evs: list[tuple[float, str]]) -> None:
    """add the action sounds into a mix buffer in place"""
    n = len(out)
    for j, (t, kind) in enumerate(evs):
        snd = sound(kind, j) * GAIN[kind]
        a = max(0, int(t * SR))
        if a < n:
            out[a:a + len(snd)] += snd[: n - a]
