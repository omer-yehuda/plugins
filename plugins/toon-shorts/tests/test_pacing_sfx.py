"""1.1.0: cuts inside a scene, pacing notes, cold open, consistent characters, action sounds, draft render."""
import json
import subprocess

import numpy as np

from toonshorts import SR, cli
from toonshorts.audio import find_ffmpeg, mix
from toonshorts.camera import segment
from toonshorts.compose import Movie
from toonshorts.pacing import est_spans, report, shots
from toonshorts.sfx import KINDS, events, sound
from toonshorts.spec import check


def test_segment_switches_camera_and_focus_at_each_cut():
    sc = {"camera": "push_in", "cast": [{"x": 0.3}],
          "cuts": [{"at": 0.6, "camera": "drift"}, {"at": 0.3, "camera": "punch_in", "focus": 0.8}]}
    assert segment(sc, 0.5, 4.0) == ("push_in", 0.3, 0.5, 1.2, 0)
    cam, focus, lt, dur, k = segment(sc, 1.5, 4.0)
    assert (cam, focus, k) == ("punch_in", 0.8, 1) and abs(lt - 0.3) < 1e-9 and abs(dur - 1.2) < 1e-9
    cam, focus, lt, dur, k = segment(sc, 3.0, 4.0)
    assert (cam, focus, k) == ("drift", 0.8, 2) and abs(dur - 1.6) < 1e-9
    assert segment({}, 1.0, 2.0)[:2] == ("push_in", 0.5)


def test_cuts_count_as_shots_and_speed_up_the_report():
    scenes = [{"say": "one two three four five six seven eight nine ten eleven twelve thirteen"}] * 6
    slow = report(scenes, est_spans(scenes))
    assert any("opening is slow" in s for s in slow) and any("one shot runs" in s for s in slow)
    cut = [dict(s, cuts=[{"at": 0.33}, {"at": 0.66}]) for s in scenes]
    assert len(shots(cut, est_spans(cut))) == 18
    fast = report(cut, est_spans(cut))
    assert len(fast) == 1 and "18 shots" in fast[0]
    assert report([], []) == []


def test_bad_cuts_and_sfx_are_errors(tiny):
    tiny["scenes"][0]["cuts"] = [{"at": 0.95, "camera": "zoomy"}]
    tiny["scenes"][1]["sfx"] = [{"type": "boom"}]
    tiny["scenes"][1]["cuts"] = "soon"
    errors, _ = check(tiny)
    joined = " ".join(errors)
    assert "at=0.95" in joined and "zoomy" in joined and "boom" in joined and "list of objects" in joined


def test_cold_open_and_character_drift_notes(tiny):
    tiny["scenes"][0]["say"] = "A man sold a famous tower he never owned, and nobody noticed it."
    tiny["scenes"][0]["props"][0]["at"] = 0.5
    tiny["scenes"][1]["cast"][0]["outfit_color"] = "red"
    _, notes = check(tiny)
    text = " ".join(notes)
    assert "hook has more than" in text and "appear late" in text and "outfit_color" in text
    tiny["scenes"][1]["cast"][0]["costume"] = True
    assert "outfit_color" not in " ".join(check(tiny)[1])


def test_examples_pass_without_pacing_notes(onoda):
    _, notes = check(onoda)
    assert not [n for n in notes if "pacing" in n or "scene 0" in n]


def test_action_events_cover_enters_moods_steps_and_extras(tiny):
    tiny["scenes"][1]["sfx"] = [{"type": "ding", "at": 0.5}, {"type": "nope"}]
    tiny["scenes"][1]["cast"][0]["mood"] = "furious"
    timing = [(0.0, 2.0, []), (2.0, 4.0, [])]
    kinds = [k for _, k in events(tiny, timing)]
    for k in ("whoosh", "pop", "sting", "thud", "tap", "ding"):
        assert k in kinds
    assert "nope" not in kinds
    times = [t for t, _ in events(tiny, timing)]
    assert times == sorted(times)


def test_every_action_sound_starts_and_ends_silent():
    for k in KINDS:
        s = sound(k)
        assert len(s) > 0 and abs(float(s[0])) < 1e-3 and abs(float(s[-1])) < 1e-3, k
        assert float(np.abs(s).max()) <= 1.0


def test_mix_lays_actions_and_stays_silent_elsewhere():
    out = mix(None, [], [], 3.0, actions=[(1.0, "thud"), (2.9, "ding")])
    assert float(np.abs(out[: int(0.9 * SR)]).max()) == 0.0
    assert float(np.abs(out[int(1.0 * SR): int(1.2 * SR)]).max()) > 0.05
    assert len(out) == int(3.0 * SR) + SR


def test_frames_render_across_a_cut(tiny, tmp_path):
    tiny["scenes"][0]["cuts"] = [{"at": 0.5, "camera": "drift", "focus": 0.7}]
    from toonshorts.render import _loader, prerender
    files = prerender(tiny, str(tmp_path), 1)
    timing = [(0.0, 1.0, [("A", 0.1, 0.3)]), (1.0, 2.0, [])]
    m = Movie(tiny, timing, 2.0, 10, _loader(files))
    a, b = m.frame(0.45), m.frame(0.55)
    assert a.size == b.size and a.tobytes() != b.tobytes()


def test_draft_render_is_small_and_reports_pace(tmp_path, tiny, capsys):
    sb = tmp_path / "sb.json"
    sb.write_text(json.dumps(tiny), encoding="utf-8")
    mp4 = tmp_path / "draft.mp4"
    assert cli.main(["render", str(sb), "--out", str(mp4), "--workers", "1", "--draft"]) == 0
    assert "PACE:" in capsys.readouterr().out
    probe = subprocess.run([find_ffmpeg(), "-i", str(mp4)], capture_output=True, text=True).stderr
    assert "540x960" in probe and "15 fps" in probe


def test_trimmed_voice_lines_fade_at_both_edges():
    from toonshorts.voice import trim
    x = np.full(24000, 0.5, np.float32)
    x[:2000] = 0
    y = trim(x, 24000)
    assert abs(float(y[0])) < 1e-3 and abs(float(y[-1])) < 1e-3 and float(y.max()) == 0.5
