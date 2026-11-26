"""Scene + word timing. Three sources, best first:
1. spans  - exact line start/end written by voice.py (AI voice)
2. audio  - the user's own recording: cuts snap to the pauses between lines
3. none   - captions only: natural reading pace
"""
import re

import numpy as np

from . import SR

Word = tuple[str, float, float]
Timing = list[tuple[float, float, list[Word]]]
FPS_A = 100   # analysis frames per second


def _weights(words: list[str]) -> list[float]:
    return [max(2, len(re.sub(r"\W", "", w))) + 1.5 for w in words]


def _words(scenes: list[dict]) -> list[list[str]]:
    return [str(s.get("say", "")).split() for s in scenes]


def reading_pace(scenes: list[dict], wps: float = 2.6) -> tuple[Timing, float]:
    out: Timing = []
    t = 0.25
    for ws in _words(scenes):
        t0, wl = t, []
        wts = _weights(ws)
        dur = max(1.4, len(ws) / wps)
        per = dur / (sum(wts) or 1)
        for w, k in zip(ws, wts):
            wl.append((w, t, t + k * per))
            t += k * per
        t += 0.35
        out.append((t0 if out else 0.0, t, wl))
    return out, t + 0.4


def voiced_frames(audio: np.ndarray) -> np.ndarray:
    hop = SR // FPS_A
    n = len(audio) // hop
    if n == 0:
        return np.zeros(0, bool)
    rms = np.sqrt(np.mean(audio[: n * hop].reshape(n, hop) ** 2, axis=1) + 1e-12)
    return rms > max(rms.max() * 0.08, 1e-4)


def silences(voiced: np.ndarray, min_len: float = 0.12) -> list[tuple[float, float]]:
    idx = np.nonzero(voiced)[0]
    if len(idx) == 0:
        return []
    out, i, last = [], int(idx[0]), int(idx[-1])
    while i < last:
        if voiced[i]:
            i += 1
            continue
        j = i
        while j < last and not voiced[j]:
            j += 1
        if (j - i) / FPS_A >= min_len:
            out.append((i / FPS_A, j / FPS_A))
        i = j
    return out


def _snap_cuts(scenes: list[dict], voiced: np.ndarray) -> list[tuple[float, float]]:
    """-> per scene (speech start, speech end) by matching expected cuts to real pauses"""
    idx = np.nonzero(voiced)[0]
    s0, s1 = idx[0] / FPS_A, (idx[-1] + 1) / FPS_A
    wts = [sum(_weights(ws)) for ws in _words(scenes)]
    tot, acc = sum(wts) or 1, 0.0
    gaps = silences(voiced)
    cuts: list[tuple[float, float]] = []
    prev = s0
    for b in range(len(scenes) - 1):
        acc += wts[b]
        exp = s0 + (s1 - s0) * acc / tot
        best, score = None, -1e9
        for a, z in gaps:
            mid = (a + z) / 2
            if mid <= prev + 0.3 or abs(mid - exp) > 2.5:
                continue
            sc = 2.0 * min(z - a, 1.0) - abs(mid - exp)
            if sc > score:
                best, score = (a, z), sc
        fallback = max(exp, prev + 0.4)
        cut = best or (fallback, fallback)
        cuts.append(cut)
        prev = (cut[0] + cut[1]) / 2
    starts = [s0] + [z for _, z in cuts]
    ends = [a for a, _ in cuts] + [s1]
    return list(zip(starts, ends))


def _spread(ws: list[str], a: float, z: float, cum: np.ndarray | None) -> list[Word]:
    """place words inside [a, z] by weight, following voiced frames when available"""
    wts = _weights(ws)
    tot = sum(wts) or 1

    def at(q: float) -> float:
        if cum is None:
            return a + (z - a) * q
        fa, fz = int(a * FPS_A), max(int(a * FPS_A) + 1, int(z * FPS_A))
        va, vz = cum[min(fa, len(cum) - 1)], cum[min(fz, len(cum) - 1)]
        if vz <= va:
            return a + (z - a) * q
        f = int(np.searchsorted(cum, va + (vz - va) * q))
        return min(max(f / FPS_A, a), z)

    out, k = [], 0.0
    for w, wt in zip(ws, wts):
        t0 = at(k / tot)
        k += wt
        out.append((w, t0, max(at(k / tot), t0 + 0.05)))
    return out


def build(scenes: list[dict], audio: np.ndarray | None = None,
          spans: list[dict] | None = None) -> tuple[Timing, float]:
    if audio is None or len(audio) == 0:
        return reading_pace(scenes)
    voiced = voiced_frames(audio)
    if not voiced.any():
        return reading_pace(scenes)
    total = len(audio) / SR
    cum = np.concatenate([[0], np.cumsum(voiced)])
    if spans and len(spans) == len(scenes):
        speech = [(float(s["start"]), float(s["end"])) for s in spans]
    else:
        speech = _snap_cuts(scenes, voiced)
    out: Timing = []
    for i, (ws, (a, z)) in enumerate(zip(_words(scenes), speech)):
        t0 = 0.0 if i == 0 else max(out[-1][0] + 0.3, min(a - 0.1, (speech[i - 1][1] + a) / 2))
        out.append((t0, 0.0, _spread(ws, a, z, cum)))
    end = max(total, speech[-1][1] + 0.6)
    return [(t0, out[i + 1][0] if i + 1 < len(out) else end, wl) for i, (t0, _, wl) in enumerate(out)], end
