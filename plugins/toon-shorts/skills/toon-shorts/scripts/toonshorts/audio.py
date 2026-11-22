"""ffmpeg discovery (never installs anything), decoding and the final mix (voice + sfx + ducked music).

Every sound is faded at its edges and the music loop is crossfaded, so the mix has no clicks or crackle."""
import math
import shutil
import subprocess
import wave

import numpy as np

from . import SR


class FfmpegMissing(RuntimeError):
    pass


def find_ffmpeg(explicit: str | None = None) -> str:
    if explicit:
        return explicit
    on_path = shutil.which("ffmpeg")
    if on_path:
        return on_path
    try:
        import imageio_ffmpeg   # pinned in requirements.txt, installed by `toon.py setup`
        return imageio_ffmpeg.get_ffmpeg_exe()
    except (ImportError, RuntimeError) as e:
        raise FfmpegMissing("ffmpeg not found. Run `python toon.py setup` (installs the pinned imageio-ffmpeg "
                            "into the toon-shorts venv) or install ffmpeg yourself.") from e


def decode(ffmpeg: str, path: str) -> np.ndarray:
    """any audio file -> mono float32 at SR"""
    raw = subprocess.run([ffmpeg, "-v", "error", "-i", path, "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).copy()


def _edges(x: np.ndarray, ms: float = 5.0) -> np.ndarray:
    """fade both ends in and out so a sound never starts or stops on a non-zero sample (that step is a click)"""
    x = x.astype(np.float32, copy=True)
    k = min(len(x) // 2, int(SR * ms / 1000))
    if k > 0:
        ramp = np.sin(np.linspace(0, math.pi / 2, k, dtype=np.float32)) ** 2
        x[:k] *= ramp
        x[-k:] *= ramp[::-1]
    return x


def _box(x: np.ndarray, w: int) -> np.ndarray:
    """moving average of width w, same length as x"""
    if w <= 1 or len(x) == 0:
        return x.astype(np.float32, copy=True)
    c = np.cumsum(np.pad(x.astype(np.float64), (w // 2 + 1, w - w // 2 - 1), mode="edge"))
    return ((c[w:] - c[:-w]) / w).astype(np.float32)


def whoosh(seconds: float = 0.4, seed: int = 1) -> np.ndarray:
    n = int(SR * seconds)
    noise = np.random.default_rng(seed).standard_normal(n).astype(np.float32)
    noise = _box(_box(noise, 24), 24)   # two passes: a soft "air" sweep, not bright hiss
    noise /= float(np.abs(noise).max()) + 1e-9
    return _edges(noise * np.sin(np.linspace(0, math.pi, n)) ** 2 * 0.5, 10)


def pop(seconds: float = 0.12) -> np.ndarray:
    t = np.linspace(0, seconds, int(SR * seconds), dtype=np.float32)
    return _edges(np.sin(2 * math.pi * (900 - 4000 * t) * t) * np.exp(-t * 40) * 0.6, 3)


def music_bed(music: np.ndarray, n: int, fade_in: float = 0.5, xfade: float = 0.08) -> np.ndarray:
    """loop the music to n samples without clicks: crossfade every loop seam, fade in, remove DC and rumble"""
    if len(music) == 0 or n <= 0:
        return np.zeros(max(0, n), np.float32)
    m = music.astype(np.float32) - float(np.mean(music))
    m = m - _box(m, SR // 120)                           # gentle high-pass (~60 Hz): no low hum under the voice
    k = min(int(SR * xfade), len(m) // 4)
    if len(m) < n and k > 0:
        body, head, tail = m[k:-k] if len(m) > 2 * k else m, m[:k], m[-k:]
        a = np.sin(np.linspace(0, math.pi / 2, k, dtype=np.float32))
        seam = tail * a[::-1] + head * a                 # equal-power crossfade from the end back to the start
        unit = np.concatenate([seam, body])
        out = np.tile(unit, n // len(unit) + 1)[:n]
        out[:k] = head                                   # the very first loop starts on the real beginning
    else:
        out = np.tile(m, n // len(m) + 1)[:n]
    fl = min(n, int(SR * fade_in))
    if fl > 0:
        out[:fl] *= np.linspace(0, 1, fl, dtype=np.float32)
    return out.astype(np.float32)


def mix(voice: np.ndarray | None, cuts: list[float], pops: list[float], total: float,
        music: np.ndarray | None = None, sfx: bool = True,
        actions: list[tuple[float, str]] | None = None) -> np.ndarray:
    n = int(total * SR) + SR
    out = np.zeros(n, np.float32)
    if voice is not None and len(voice):
        out[: min(n, len(voice))] += _edges(voice[:n], 5)
    if sfx:
        for i, t in enumerate(cuts):
            w = whoosh(seed=i + 1)
            a = max(0, int((t - 0.2) * SR))
            out[a:a + len(w)] += w[: max(0, n - a)] * 0.045  # cuts land in pauses: keep them soft
        for t in pops:
            pp = pop()
            a = max(0, int(t * SR))
            out[a:a + len(pp)] += pp[: max(0, n - a)] * 0.12
        if actions:
            from .sfx import lay
            lay(out, actions)
    if music is not None and len(music):
        m = music_bed(music, n)
        duck = np.ones(n, np.float32)
        if voice is not None and len(voice):
            v = np.abs(np.pad(voice, (0, max(0, n - len(voice))))[:n])
            env = _box(v, int(SR * 0.1))
            duck = 1 - 0.7 * np.clip(env / (env.max() * 0.25 + 1e-9), 0, 1)
            duck = _box(duck, int(SR * 0.05))            # smooth the ducking so it never pumps or ticks
        fade = np.ones(n, np.float32)
        fl = min(n, int(1.5 * SR))
        fade[-fl:] = np.linspace(1, 0, fl)
        out += m * 0.16 * duck * fade
    peak = float(np.abs(out).max()) if len(out) else 0.0
    if peak > 0.98:
        out *= 0.98 / peak
    return out


def write_wav(path: str, x: np.ndarray, sr: int = SR) -> None:
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes())
