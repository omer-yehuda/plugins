"""AI narration with Kokoro: one clip per scene `say`, scene durations set to fit the speech, one voice.wav.

Needs `studio.py setup --voice --yes` (numpy and kokoro-onnx in the private venv, hash-checked model files)."""
import hashlib
import json
from pathlib import Path

from . import emotion
from .audio import edges, master, write_wav
from .models import ModelError, emotion_model, models_dir, voice_ready
from .safety import safe_file
from .spec import validate

VOICES = {"am_michael": "US male, warm and clear", "am_puck": "US male, upbeat", "am_fenrir": "US male, deep",
          "bm_george": "British male, documentary", "af_heart": "US female, warm", "bf_emma": "British female, clear"}
SR = 24000
LEAD, TAIL = 0.12, 0.28        # silence before and after each scene's line (seconds)
_ENGINE: dict = {}


def engine():
    if "k" not in _ENGINE:
        if not voice_ready():
            raise ModelError("voice model missing or unverified. Ask the user, then run `studio.py setup --voice --yes`.")
        try:
            from kokoro_onnx import Kokoro
        except ImportError as e:
            raise ModelError("kokoro-onnx is not installed. Ask the user, then run `studio.py setup --voice --yes`.") from e
        d = models_dir()
        _ENGINE["k"] = Kokoro(str(d / "kokoro-v1.0.int8.onnx"), str(d / "voices-v1.0.bin"))
    return _ENGINE["k"]


def emo_engine(lively: float):
    """The emotion voice (same Kokoro voice, tags and melody); None when it cannot run here."""
    if _ENGINE.get("emo_lively") != lively:
        k = engine()
        try:
            _ENGINE["emo"] = emotion.Emotion(k, emotion_model(), lively)
        except (ImportError, ModelError, RuntimeError) as e:
            _ENGINE["emo"] = None
            print(f"note: emotion voice is not available ({e}); speaking without emotion. "
                  "`studio.py setup --voice --yes` adds it.")
        _ENGINE["emo_lively"] = lively
    return _ENGINE["emo"]


def trim(x, thr: float = 0.01):
    import numpy as np
    idx = np.nonzero(np.abs(x) > thr)[0]
    if len(idx) == 0:
        return x
    return x[max(0, idx[0] - int(0.03 * SR)): min(len(x), idx[-1] + int(0.08 * SR))]


def synth(text: str, voice: str, speed: float, tts=None, lively: float = emotion.LIVELY):
    """Mono float32 at 24 kHz, trimmed and with faded edges. {feeling|words} tags are spoken with feeling
    and every line gets `lively` melody; lively=1.0 is the old flat read and ignores tags."""
    import numpy as np
    if voice not in VOICES:
        raise ValueError(f"unknown voice '{voice}'. Choose one of: {', '.join(VOICES)}")
    lang = "en-us" if voice[0] == "a" else "en-gb"
    emo = None if tts or lively == 1.0 else emo_engine(lively)
    if emo:
        samples, sr = emo.create(text, voice, speed, lang)
    else:
        samples, sr = (tts or engine()).create(emotion.plain(text), voice=voice, speed=speed, lang=lang)
    if sr != SR:
        raise ValueError(f"unexpected sample rate {sr}")
    return edges(trim(np.asarray(samples, np.float32)), SR)


def cached_synth(text: str, voice: str, speed: float, cache: Path, tts=None, lively: float = emotion.LIVELY):
    """synth() with a per-production cache, so editing one line re-voices only that line."""
    import numpy as np
    tag = "" if lively == 1.0 else f"|{emotion.VERSION}|{lively}"
    key = hashlib.sha256(f"{voice}|{speed}|{text}{tag}".encode()).hexdigest()[:24]
    path = cache / f"{key}.npy"
    if path.is_file() and not path.is_symlink():
        return np.load(path, allow_pickle=False)
    x = synth(text, voice, speed, tts, lively)
    cache.mkdir(exist_ok=True)
    np.save(safe_file(path, cache), x, allow_pickle=False)
    return x


def narrate(board_path: Path, voice: str = "am_michael", speed: float = 1.12, tts=None, log=print,
            lively: float = emotion.LIVELY) -> dict:
    """Voice every scene that has `say`; rewrite those scenes' `duration` to fit, set `audio` to voice.wav.
    Scenes without `say` keep their duration and are silent. Returns paths and the new total length."""
    import numpy as np
    board_path = Path(board_path).resolve()
    folder = board_path.parent
    data = json.loads(board_path.read_text(encoding="utf-8"))
    sb, errs, _ = validate(data, folder)
    if errs:
        raise ValueError("fix the storyboard first:\n" + "\n".join(errs))
    parts, spans, t = [], [], 0.0
    for i, sc in enumerate(data.get("scenes", [])):
        line = " ".join(str(sc.get("say", "")).split())
        if line:
            x = cached_synth(line, voice, speed, folder / ".voice-cache", tts, lively)
            speech = len(x) / SR
            read = 0.9 + 0.3 * sb.scenes[i].words()      # never shorter than the on-screen text needs
            dur = round(max(LEAD + speech + TAIL, read, 1.0), 2)
            sc["duration"] = dur
            clip = np.zeros(int(round(dur * SR)), np.float32)
            a = int(LEAD * SR)
            clip[a:a + len(x)] = x[: len(clip) - a]
            spans.append({"scene": i, "start": round(t + LEAD, 3), "end": round(t + LEAD + speech, 3), "text": emotion.plain(line)})
            log(f"scene {i:2d}  {dur:5.2f}s  {line[:60]}")
        else:
            dur = float(sc.get("duration") or 3.0)
            clip = np.zeros(int(round(dur * SR)), np.float32)
        parts.append(clip)
        t += len(clip) / SR
    if not spans:
        raise ValueError("no scene has a 'say' line: nothing to narrate")
    raw = safe_file(folder / "voice.raw.wav", folder)
    write_wav(raw, np.concatenate(parts), SR)
    out = master(raw, safe_file(folder / "voice.wav", folder))
    raw.unlink(missing_ok=True)
    data["audio"] = "voice.wav"
    safe_file(board_path, folder).write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    lines = safe_file(folder / "voice.lines.json", folder)
    lines.write_text(json.dumps(spans, indent=1, ensure_ascii=False), encoding="utf-8")
    return {"audio": out, "lines": lines, "seconds": round(t, 2)}
