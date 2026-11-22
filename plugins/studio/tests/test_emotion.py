"""Emotion tags: parsing, validation, captions without tags, pitch curves, cache keys and the model patch."""
import json

import numpy as np
import pytest

from studiokit import emotion, voice
from studiokit.spec import validate


def test_plain_and_parse():
    line = "{warn|Fair warning}: it is {excite|free}."
    assert emotion.plain(line) == "Fair warning: it is free."
    text, spans = emotion.parse(line)
    assert text == "Fair warning: it is free."
    assert [(text[a:b], f) for a, b, f in spans] == [("Fair warning", "warn"), ("free", "excite")]


def test_problems():
    assert emotion.problems("{warn|ok} fine") == []
    assert "unknown feeling 'angry'" in emotion.problems("{angry|no}")[0]
    assert emotion.problems("{warn ok") == ["broken tag: write {feeling|words}"]


def test_storyboard_say_tags(tmp_path):
    good = {"title": "T", "scenes": [{"type": "title", "text": "Hi", "say": "{surprise|Surprise!} It is free."}]}
    sb, errs, _ = validate(good, tmp_path)
    assert not errs and sb.scenes[0].say == "Surprise! It is free."      # captions never show tags
    bad = {"title": "T", "scenes": [{"type": "title", "text": "Hi", "say": "{yell|Hey}"}]}
    _, errs, _ = validate(bad, tmp_path)
    assert any("unknown feeling" in e for e in errs)


@pytest.mark.parametrize("shape", ["up", "down", "hit", "peak"])
def test_bump_shapes(shape):
    y = emotion.bump(40, 0.4, shape)
    assert y.shape == (40,) and y.min() >= 0 and y.max() <= 1
    if shape == "up":
        assert y[-1] == pytest.approx(1.0)
    if shape == "down":
        assert y[0] > y[-1]
    if shape == "peak":
        assert y[16] > y[0] and y[16] > y[-1]


def test_every_preset_is_complete():
    for name, p in emotion.PRESETS.items():
        assert set(p) == {"rise", "shape", "slow", "loud", "beat", "range"}, name


class FakeTTS:
    def __init__(self):
        self.said = []

    def create(self, text, voice, speed, lang):
        self.said.append(text)
        return np.full(int(24000 * 0.05 * len(text.split())), 0.2, np.float32), 24000


def test_fake_engine_hears_plain_text_and_lines_have_no_tags(tmp_path):
    p = tmp_path / "s.json"
    p.write_text(json.dumps({"title": "T", "scenes": [{"type": "title", "text": "Hi", "say": "{wow|Eighteen} helpers."}]}))
    tts = FakeTTS()
    voice.narrate(p, "am_michael", 1.1, tts=tts, log=lambda *a: None)
    assert tts.said == ["Eighteen helpers."]
    assert json.loads((tmp_path / "voice.lines.json").read_text())[0]["text"] == "Eighteen helpers."


def test_flat_and_lively_use_different_cache_keys(tmp_path):
    tts = FakeTTS()
    voice.cached_synth("Hello there.", "am_michael", 1.1, tmp_path, tts, lively=1.0)
    voice.cached_synth("Hello there.", "am_michael", 1.1, tmp_path, tts, lively=1.2)
    assert len(list(tmp_path.glob("*.npy"))) == 2


def test_missing_emotion_model_falls_back_to_plain(monkeypatch, capsys):
    tts = FakeTTS()
    monkeypatch.setattr(voice, "engine", lambda: tts)
    monkeypatch.setattr(voice, "emotion_model", lambda: (_ for _ in ()).throw(voice.ModelError("no model")))
    voice._ENGINE.pop("emo_lively", None)
    x = voice.synth("{warn|Careful} now.", "am_michael", 1.1, lively=1.3)
    assert len(x) and tts.said == ["Careful now."] and "not available" in capsys.readouterr().out
    voice._ENGINE.pop("emo_lively", None)


def test_build_model_adds_controls(tmp_path):
    onnx = pytest.importorskip("onnx")
    from onnx import TensorProto, helper
    # a tiny graph with the same tensor names as Kokoro's: Div -> Round, F0 Conv -> Squeeze, N Conv -> Squeeze
    nodes = [helper.make_node("Identity", ["a"], ["/encoder/Div_output_0"]),
             helper.make_node("Round", ["/encoder/Div_output_0"], ["/encoder/Clip_output_0"]),
             helper.make_node("Identity", ["b"], ["/encoder/F0_proj/Conv_output_0"]),
             helper.make_node("Identity", ["/encoder/F0_proj/Conv_output_0"], ["f"]),
             helper.make_node("Identity", ["b"], ["/encoder/N_proj/Conv_output_0"]),
             helper.make_node("Identity", ["/encoder/N_proj/Conv_output_0"], ["n"])]
    vi = lambda n, s: helper.make_tensor_value_info(n, TensorProto.FLOAT, s)
    g = helper.make_graph(nodes, "k", [vi("a", [1, 3]), vi("b", [1, 1, 4])], [vi("f", None), vi("n", None)])
    src = tmp_path / "k.onnx"
    onnx.save(helper.make_model(g, opset_imports=[helper.make_opsetid("", 20)], ir_version=9), str(src))
    out = emotion.build_model(src, tmp_path / "k.emo.onnx")
    m = onnx.load(str(out))
    assert {"dur_mul", "f0_mul", "n_mul"} <= {i.name for i in m.graph.input}
    assert sum(n.op_type == "Mul" for n in m.graph.node) == 3
    ort = pytest.importorskip("onnxruntime")
    s = ort.InferenceSession(str(out))
    r = s.run(None, {"a": np.array([[1.2, 2.0, 3.0]], np.float32), "b": np.ones((1, 1, 4), np.float32),
                     "dur_mul": np.array([[2.0, 1.0, 1.0]], np.float32), "f0_mul": np.full((1, 1, 4), 3, np.float32),
                     "n_mul": np.ones((1, 1, 1), np.float32)})
    assert r[0].ravel().tolist() == [3, 3, 3, 3]
    assert r[2].ravel().tolist() == [2.0, 2.0, 3.0]    # durations: 1.2*2 rounded, 2, 3


def test_build_model_rejects_other_models(tmp_path):
    onnx = pytest.importorskip("onnx")
    from onnx import TensorProto, helper
    vi = lambda n: helper.make_tensor_value_info(n, TensorProto.FLOAT, [1])
    g = helper.make_graph([helper.make_node("Identity", ["x"], ["y"])], "k", [vi("x")], [vi("y")])
    src = tmp_path / "x.onnx"
    onnx.save(helper.make_model(g), str(src))
    with pytest.raises(RuntimeError, match="unexpected Kokoro model"):
        emotion.build_model(src, tmp_path / "x.emo.onnx")


class FakeKokoro:
    class tokenizer:
        vocab = {c: i + 1 for i, c in enumerate("abcdefghijklmnopqrstuvwxyz ˈ")}

        @staticmethod
        def phonemize(word, lang):
            w = "".join(c for c in word.lower() if c.isalpha())
            return "ˈ" + w

    @staticmethod
    def get_voice_style(name):
        return np.zeros((510, 1, 256), np.float32)


class FakeSession:
    """Each sound lasts 3 units; pitch 120 Hz everywhere. Records every call's controls."""

    def __init__(self):
        self.calls = []

    def run(self, _, feeds):
        self.calls.append(feeds)
        dur = np.round(3 * feeds["dur_mul"].ravel())
        f0 = np.full(int(dur.sum() * 2), 120.0, np.float32)
        f0[:4] = 0                                       # a silent start: not voiced
        return np.zeros(int(dur.sum() * 600), np.float32), dur[None, :], f0[None, None, :]


def test_create_shapes_only_the_tagged_word():
    e = emotion.Emotion.__new__(emotion.Emotion)
    e.k, e.lively, e.sess = FakeKokoro(), 1.2, FakeSession()
    audio, sr = e.create("one {surprise|two} three", "am_michael", 1.1)
    assert sr == 24000 and len(audio)
    dm = e.sess.calls[-1]["dur_mul"].ravel()
    assert sorted(set(np.round(dm.astype(float), 2).tolist())) == [1.0, 1.3, 2.6]    # "two" is slower; the space before it holds the beat
    assert (np.round(dm.astype(float), 2) == 1.3).sum() == 3
    fm = e.sess.calls[-1]["f0_mul"].ravel()
    assert fm.max() > 1.25 and fm[:4].tolist() == [1, 1, 1, 1]          # rises on the word, silence untouched
    assert e.sess.calls[-1]["n_mul"].ravel().max() > 1.05


def test_create_rejects_very_long_lines():
    e = emotion.Emotion.__new__(emotion.Emotion)
    e.k, e.lively, e.sess = FakeKokoro(), 1.2, FakeSession()
    with pytest.raises(ValueError, match="too long"):
        e.create("word " * 200, "am_michael", 1.1)
