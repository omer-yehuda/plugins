import wave

import numpy as np
import pytest

from toonshorts import SR, audio, timing


def _speech(segments: list[tuple[float, float]], total: float) -> np.ndarray:
    x = np.zeros(int(total * SR), np.float32)
    rng = np.random.default_rng(0)
    for a, z in segments:
        x[int(a * SR):int(z * SR)] = rng.standard_normal(int(z * SR) - int(a * SR)) * 0.3
    return x


SCENES = [{"say": "one two three four"}, {"say": "five six"}, {"say": "seven eight nine ten eleven"}]


def test_reading_pace_is_monotonic():
    tm, total = timing.build(SCENES)
    assert tm[0][0] == 0.0 and total > tm[-1][1] - 1
    for (t0, t1, words), nxt in zip(tm, tm[1:] + [(tm[-1][1], 0, [])]):
        assert t0 < t1 == nxt[0]
        assert all(a < b for _, a, b in words)


def test_spans_are_used_exactly():
    x = _speech([(0.2, 1.4), (1.8, 2.5), (3.0, 4.6)], 5.0)
    spans = [{"start": 0.2, "end": 1.4}, {"start": 1.8, "end": 2.5}, {"start": 3.0, "end": 4.6}]
    tm, total = timing.build(SCENES, x, spans)
    assert tm[1][2][0][1] == pytest.approx(1.8, abs=0.05)
    assert tm[2][2][-1][2] <= 4.61 and total >= 5.0


def test_own_recording_snaps_to_pauses():
    x = _speech([(0.3, 1.6), (2.4, 3.1), (3.9, 5.8)], 6.5)
    tm, _ = timing.build(SCENES, x)
    assert 1.6 <= tm[1][0] <= 2.4
    assert 3.1 <= tm[2][0] <= 3.9
    assert tm[1][2][0][1] == pytest.approx(2.4, abs=0.1)


def test_silent_or_empty_audio_falls_back():
    assert timing.build(SCENES, np.zeros(SR, np.float32))[0][0][0] == 0.0
    assert timing.build(SCENES, np.zeros(0, np.float32))[1] > 0
    assert timing.voiced_frames(np.zeros(10, np.float32)).size == 0
    assert timing.silences(np.zeros(5, bool)) == []


def test_mix_ducks_music_and_limits_peak():
    voice = np.ones(SR, np.float32) * 0.9
    music = np.ones(SR // 2, np.float32)
    out = audio.mix(voice, [0.5], [0.2], 2.0, music, sfx=True)
    assert len(out) == 3 * SR and np.abs(out).max() <= 0.98 + 1e-6
    quiet = audio.mix(None, [], [], 1.0, None, sfx=False)
    assert not quiet.any()


def test_wav_roundtrip_through_ffmpeg(tmp_path):
    path = str(tmp_path / "t.wav")
    tone = np.sin(np.linspace(0, 440 * 2 * np.pi, SR)).astype(np.float32) * 0.5
    audio.write_wav(path, tone)
    with wave.open(path) as w:
        assert w.getframerate() == SR and w.getnframes() == SR
    back = audio.decode(audio.find_ffmpeg(), path)
    assert abs(len(back) - SR) < 100


def test_find_ffmpeg(monkeypatch):
    assert audio.find_ffmpeg("/x/ffmpeg") == "/x/ffmpeg"
    monkeypatch.setattr(audio.shutil, "which", lambda _: "/usr/bin/ffmpeg")
    assert audio.find_ffmpeg() == "/usr/bin/ffmpeg"
    monkeypatch.setattr(audio.shutil, "which", lambda _: None)
    import builtins
    real = builtins.__import__

    def no_imageio(name, *a, **k):
        if name == "imageio_ffmpeg":
            raise ImportError(name)
        return real(name, *a, **k)

    monkeypatch.setattr(builtins, "__import__", no_imageio)
    with pytest.raises(audio.FfmpegMissing):
        audio.find_ffmpeg()


def test_sfx_shapes():
    assert len(audio.whoosh(0.2)) == int(0.2 * SR)
    assert np.abs(audio.pop()).max() <= 0.61


def _max_step(x: np.ndarray) -> float:
    return float(np.abs(np.diff(x)).max())


def test_sfx_start_and_end_silent():
    for s in (audio.whoosh(), audio.pop()):
        assert abs(s[0]) < 1e-3 and abs(s[-1]) < 1e-3


def test_music_loop_seam_has_no_click():
    # 0.37 s of a 220 Hz tone does not end where it starts: a hard loop would jump
    t = np.arange(int(0.37 * SR)) / SR
    music = (np.sin(2 * np.pi * 220 * t) * 0.8).astype(np.float32)
    hard = np.tile(music, 4)
    bed = audio.music_bed(music, len(hard), fade_in=0.0)
    smooth = 2 * np.pi * 220 / SR * 0.8 * 1.5          # largest step a clean 220 Hz tone can make, with headroom
    assert _max_step(hard) > 3 * smooth
    assert _max_step(bed) < smooth


def test_music_bed_fades_in_and_drops_dc_and_rumble():
    music = np.full(SR, 0.5, np.float32) + (np.sin(np.arange(SR) * 2 * np.pi * 30 / SR) * 0.3).astype(np.float32)
    bed = audio.music_bed(music, 3 * SR)
    assert abs(bed[0]) < 1e-4
    assert abs(float(bed[SR:].mean())) < 0.01             # DC offset removed
    assert np.sqrt(np.mean(bed[SR:] ** 2)) < 0.3 * 0.7 * 0.5  # 30 Hz rumble strongly reduced
    assert len(audio.music_bed(np.zeros(0, np.float32), 10)) == 10


def test_mix_has_no_clicks_at_voice_edges():
    voice = np.full(SR // 2, 0.5, np.float32)             # a clip that starts and stops on a loud sample
    out = audio.mix(voice, [], [], 1.0, None, sfx=False)
    assert _max_step(out) < 0.01
