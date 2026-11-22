"""Emotion for the AI narration: tag a word in a scene's `say` and the voice says it with feeling.

    "say": "{warn|Fair warning}: it is six times heavier to run."
    "say": "And the {surprise|surprise}? It is completely {excite|free}."

Same Kokoro voice. A tag changes only that word: its pitch shape, length, loudness and a short beat
before it. Every line also gets a little more melody (`lively`), so the read is not flat.
How: a copy of the hash-checked Kokoro model gets three multiply inputs (sound length, pitch, energy)
and two outputs; with all of them at 1.0 its audio is the same as the original model's."""
import re
from pathlib import Path

SR = 24000
LIVELY = 1.2            # melody of every line: 1.0 = the old flat read
VERSION = "emo1"        # part of the voice cache key
TAG = re.compile(r"\{(\w+)\|([^{}|]*)\}")
# rise: pitch at the stress (1.2 = 20% up) · shape · slow: word length · loud: energy · beat: pause before (s) · range: melody
PRESETS = {
    "warn":     dict(rise=1.10, shape="hit",  slow=1.22, loud=1.10, beat=0.10, range=1.30),
    "surprise": dict(rise=1.32, shape="up",   slow=1.30, loud=1.12, beat=0.12, range=1.45),
    "excite":   dict(rise=1.22, shape="peak", slow=1.15, loud=1.12, beat=0.00, range=1.40),
    "wow":      dict(rise=1.28, shape="peak", slow=1.38, loud=1.08, beat=0.14, range=1.50),
    "punch":    dict(rise=1.12, shape="hit",  slow=1.10, loud=1.15, beat=0.06, range=1.20),
    "ask":      dict(rise=1.25, shape="up",   slow=1.12, loud=1.00, beat=0.00, range=1.30),
    "calm":     dict(rise=0.94, shape="down", slow=1.18, loud=0.92, beat=0.06, range=0.85),
    "sad":      dict(rise=0.88, shape="down", slow=1.25, loud=0.88, beat=0.08, range=0.80),
}
VOWELS = set("aeiouɑɐɒæɔəɘɚɛɜɝɞɨɪʊʉʌʏɯɤøœɶyoɵAIOWYQ")
TAPS = [("/encoder/Div_output_0", "dur_mul", [1, "sequence_length"]),        # each sound's length, before rounding
        ("/encoder/F0_proj/Conv_output_0", "f0_mul", [1, 1, "f0_len"]),      # pitch curve (Hz)
        ("/encoder/N_proj/Conv_output_0", "n_mul", [1, 1, "f0_len"])]        # energy curve


def plain(text: str) -> str:
    """The words without tags: what captions show."""
    return TAG.sub(lambda m: m.group(2), text)


def problems(text: str) -> list[str]:
    bad = [m.group(1) for m in TAG.finditer(text) if m.group(1) not in PRESETS]
    out = [f"unknown feeling '{b}' (use {', '.join(PRESETS)})" for b in bad]
    if "{" in TAG.sub("", text) or "}" in TAG.sub("", text):
        out.append("broken tag: write {feeling|words}")
    return out


def parse(text: str):
    """(plain text, [(start, end, feeling)]) in plain-text character positions."""
    out, spans, pos = "", [], 0
    for m in TAG.finditer(text):
        out += text[pos:m.start()]
        a = len(out)
        out += m.group(2)
        spans.append((a, len(out), m.group(1)))
        pos = m.end()
    return out + text[pos:], spans


def build_model(src: Path, dst: Path) -> Path:
    """Write the controllable copy of the Kokoro model (needs the pinned `onnx` package)."""
    import onnx
    from onnx import TensorProto, helper
    m = onnx.load(str(src))
    g = m.graph
    for tensor, name, shape in TAPS:
        users = [(n, i) for n in g.node for i, x in enumerate(n.input) if x == tensor]
        if not users:
            raise RuntimeError(f"unexpected Kokoro model: {tensor} not found")
        for n, i in users:
            n.input[i] = tensor + "_emo"
        at = next(i for i, n in enumerate(g.node) if tensor in n.output) + 1
        g.node.insert(at, helper.make_node("Mul", [tensor, name], [tensor + "_emo"], name="/emo/" + name))
        g.input.append(helper.make_tensor_value_info(name, TensorProto.FLOAT, shape))
    for out in ("/encoder/Clip_output_0", "/encoder/F0_proj/Conv_output_0"):
        g.output.append(helper.make_tensor_value_info(out, TensorProto.FLOAT, None))
    tmp = dst.with_suffix(".part")
    onnx.save(m, str(tmp))
    tmp.replace(dst)
    return dst


def bump(n: int, peak: float, shape: str):
    """0..1 curve across one word: where and how its pitch moves."""
    import numpy as np
    x = np.linspace(0, 1, n)
    p = min(max(peak, 0.15), 0.85)
    if shape == "up":
        y = np.maximum(np.clip(x / p, 0, 1) ** 1.3, x)
    elif shape == "down":
        y = 1 - x
    elif shape == "hit":
        y = np.where(x < p, (x / p) ** 0.5, 1 - 0.6 * ((x - p) / (1 - p + 1e-6)) ** 2)
    else:
        y = np.where(x < p, np.sin(0.5 * np.pi * x / p), np.cos(0.5 * np.pi * (x - p) / (1 - p + 1e-6)))
    return np.clip(y, 0, 1).astype(np.float32)


class Emotion:
    """Speaks a tagged line with a Kokoro object (for phonemes and voices) and the controllable model."""

    def __init__(self, kokoro, model: Path, lively: float = LIVELY):
        import onnxruntime as ort
        self.k, self.lively = kokoro, lively
        self.sess = ort.InferenceSession(str(model), providers=["CPUExecutionProvider"])

    def _run(self, tok, style, speed, dm, fm=None, nm=None):
        import numpy as np
        one = np.ones((1, 1, 1), np.float32)
        a, dur, f0 = self.sess.run(None, {
            "tokens": tok, "style": style, "speed": np.array([speed], np.float32), "dur_mul": dm,
            "f0_mul": one if fm is None else fm[None, None, :], "n_mul": one if nm is None else nm[None, None, :]})
        return a, dur.ravel().astype(int), f0.ravel()

    def create(self, line: str, voice: str, speed: float, lang: str = "en-us"):
        import numpy as np
        text, spans = parse(line)
        marks, ph = [], ""
        for m in re.finditer(r"\S+", text):                 # word by word, so each tag maps to its sounds
            tag = next((s[2] for s in spans if m.start() < s[1] and m.end() > s[0]), None)
            w = self.k.tokenizer.phonemize(m.group(), lang)
            ph += " " if ph else ""
            marks.append((len(ph), len(ph) + len(w), tag, w))
            ph += w
        vocab = self.k.tokenizer.vocab
        keep = [i for i, c in enumerate(ph) if c in vocab]
        pos = {c: j + 1 for j, c in enumerate(keep)}        # char -> token index (token 0 is the start pad)
        tok = np.array([[0, *[vocab[ph[i]] for i in keep], 0]], np.int64)
        if tok.shape[1] > 512:
            raise ValueError("line is too long for one take: split the scene's 'say'")
        style = self.k.get_voice_style(voice)[tok.shape[1] - 2]
        dm = np.ones((1, tok.shape[1]), np.float32)
        _, dur0, _ = self._run(tok, style, speed, dm)
        for a, b, tag, _w in marks:
            if not tag:
                continue
            P = PRESETS[tag]
            for c in range(a, b):
                if c in pos and ph[c] not in "ˈˌ":
                    dm[0, pos[c]] = P["slow"]
            if P["beat"] and a - 1 in pos:                  # the space before the word holds the beat
                j = pos[a - 1]
                dm[0, j] = max(1.0, (dur0[j] + P["beat"] * SR / 600) / max(dur0[j], 1))
        _, dur, f0 = self._run(tok, style, speed, dm)
        edge = np.concatenate([[0], np.cumsum(dur)]) * 2    # 2 pitch frames per length unit
        on = f0 > 50
        med = float(np.median(f0[on])) if on.any() else 120.0
        safe = np.maximum(f0, 1.0)
        fm = np.where(on, (safe / med) ** (self.lively - 1), 1.0).astype(np.float32)
        nm = np.ones_like(fm)
        for a, b, tag, w in marks:
            toks = [pos[c] for c in range(a, b) if c in pos]
            if not tag or not toks:
                continue
            P = PRESETS[tag]
            s, e = int(edge[toks[0]]), int(edge[toks[-1] + 1])
            if e - s < 3:
                continue
            st = max(w.find("ˈ"), 0)
            vi = next((i for i in range(st, len(w)) if w[i] in VOWELS), 0)
            y = bump(e - s, (edge[pos.get(a + vi, toks[0])] - s) / (e - s), P["shape"])
            seg, v = slice(s, e), on[s:e]
            if v.any():
                wm = float(np.median(f0[seg][v]))
                fm[seg] = np.where(v, (safe[seg] / wm) ** (self.lively * P["range"] - 1), 1.0)
            fm[seg] *= 1 + (P["rise"] - 1) * y
            nm[seg] = 1 + (P["loud"] - 1) * (0.4 + 0.6 * y)
        k = np.hanning(9).astype(np.float32)
        k /= k.sum()
        fm = np.convolve(np.pad(fm, 4, mode="edge"), k, mode="valid").astype(np.float32)
        nm = np.convolve(np.pad(nm, 4, mode="edge"), k, mode="valid").astype(np.float32)
        fm[~on] = 1.0
        audio, _, _ = self._run(tok, style, speed, dm, fm, nm)
        return np.asarray(audio, np.float32), SR
