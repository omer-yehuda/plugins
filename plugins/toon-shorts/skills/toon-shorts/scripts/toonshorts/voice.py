"""Free AI voiceover with Kokoro-82M (Apache-2.0 model, runs on CPU). Requires `toon.py setup --voice`."""
import json
import os
from pathlib import Path

import numpy as np

from .audio import write_wav
from .numbers import speakable
from .paths import models_dir
from .setup_env import MODELS, SetupError, model_ok

VOICES = {   # id: (language, description)
    "am_michael": ("en", "US male, calm warm storyteller"),
    "am_fenrir": ("en", "US male, deep and serious (true crime)"),
    "am_puck": ("en", "US male, upbeat and energetic"),
    "af_heart": ("en", "US female, warm and friendly"),
    "af_bella": ("en", "US female, bright and expressive"),
    "af_nicole": ("en", "US female, soft and close"),
    "bm_george": ("en", "British male, documentary narrator"),
    "bm_fable": ("en", "British male, young and lively"),
    "bf_emma": ("en", "British female, clear and polished"),
    "em_alex": ("es", "Spanish male"), "ef_dora": ("es", "Spanish female"),
    "ff_siwis": ("fr", "French female"),
    "im_nicola": ("it", "Italian male"), "if_sara": ("it", "Italian female"),
    "pm_alex": ("pt", "Brazilian Portuguese male"), "pf_dora": ("pt", "Brazilian Portuguese female"),
    "hm_omega": ("hi", "Hindi male"), "hf_alpha": ("hi", "Hindi female"),
}
SAMPLE_SET = {"en": ["am_michael", "am_fenrir", "af_heart", "bm_george"], "es": ["em_alex", "ef_dora"],
              "fr": ["ff_siwis"], "it": ["im_nicola", "if_sara"], "pt": ["pm_alex", "pf_dora"],
              "hi": ["hm_omega", "hf_alpha"]}
ESPEAK = {"a": "en-us", "b": "en-gb", "e": "es", "f": "fr-fr", "i": "it", "p": "pt-br", "h": "hi"}
_ENGINE: dict = {}


def engine():
    if "k" not in _ENGINE:
        missing = [n for n in MODELS if not model_ok(n)]
        if missing:
            raise SetupError(f"voice model missing or unverified: {', '.join(missing)}. Run `toon.py setup --voice`.")
        try:
            from kokoro_onnx import Kokoro
        except ImportError as e:
            raise SetupError("kokoro-onnx is not installed. Run `toon.py setup --voice`.") from e
        d = models_dir()
        _ENGINE["k"] = Kokoro(str(d / "kokoro-v1.0.int8.onnx"), str(d / "voices-v1.0.bin"))
    return _ENGINE["k"]


def synth(text: str, voice: str, speed: float) -> tuple[np.ndarray, int]:
    if voice not in VOICES:
        raise ValueError(f"unknown voice '{voice}'. See `toon.py voices`.")
    lang = ESPEAK[voice[0]]
    said = speakable(text) if lang.startswith("en") else text
    samples, sr = engine().create(said, voice=voice, speed=speed, lang=lang)
    return trim(np.asarray(samples, np.float32), sr), sr


def trim(x: np.ndarray, sr: int, thr: float = 0.01) -> np.ndarray:
    idx = np.nonzero(np.abs(x) > thr)[0]
    if len(idx) == 0:
        return x
    x = x[max(0, idx[0] - int(0.03 * sr)): min(len(x), idx[-1] + int(0.08 * sr))].astype(np.float32, copy=True)
    k = min(len(x) // 2, int(0.006 * sr))   # fade the cut edges: a trimmed line must not start on a step (click)
    if k > 0:
        ramp = np.sin(np.linspace(0, np.pi / 2, k, dtype=np.float32)) ** 2
        x[:k] *= ramp
        x[-k:] *= ramp[::-1]
    return x


def save(path: str | Path, x: np.ndarray, sr: int) -> None:
    peak = float(np.abs(x).max()) or 1.0
    write_wav(str(path), x / peak * 0.9, sr)


def samples(text: str, out_dir: str, lang: str = "en", ids: list[str] | None = None,
            speed: float = 1.1) -> list[tuple[str, str, str]]:
    os.makedirs(out_dir, exist_ok=True)
    rows = []
    for i, vid in enumerate(ids or SAMPLE_SET.get(lang, SAMPLE_SET["en"])):
        x, sr = synth(text, vid, speed)
        letter = "ABCDEFGHIJ"[i]
        path = str(Path(out_dir) / f"voice_{letter}_{vid}.wav")
        save(path, x, sr)
        rows.append((letter, vid, path))
    return rows


def make(sb: dict, voice: str, out: str, speed: float = 1.1, pause: float = 0.3) -> tuple[str, str]:
    """full voiceover; also writes <out>.lines.json with exact line spans for render timing"""
    lines = [s.get("voice") or s.get("say", "") for s in sb["scenes"]]
    sr, t = 24000, 0.15
    parts, spans = [np.zeros(int(t * sr), np.float32)], []
    for i, line in enumerate(lines):
        x, sr = synth(line, voice, speed)
        spans.append({"start": round(t, 3), "end": round(t + len(x) / sr, 3), "text": line})
        parts.append(x)
        t += len(x) / sr
        if i < len(lines) - 1:
            gap = pause * (1.5 if line.rstrip().endswith(("?", "!")) else 1.0)
            parts.append(np.zeros(int(gap * sr), np.float32))
            t += gap
        print(f"line {i + 1:2d}/{len(lines)}  {spans[-1]['start']:6.2f}-{spans[-1]['end']:6.2f}s  {line[:56]}",
              flush=True)
    parts.append(np.zeros(int(0.5 * sr), np.float32))
    save(out, np.concatenate(parts), sr)
    lines_path = str(Path(out).with_suffix(".lines.json"))
    Path(lines_path).write_text(json.dumps(spans, indent=1, ensure_ascii=False), encoding="utf-8")
    return out, lines_path
