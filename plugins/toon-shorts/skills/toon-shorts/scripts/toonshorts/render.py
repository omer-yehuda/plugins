"""Prerender sets, then draw frames into a preview sheet or an H.264 MP4 (via ffmpeg pipe)."""
import math
import multiprocessing as mp
import os
import subprocess
import time
from functools import lru_cache
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

from . import H, W
from .audio import mix, write_wav
from .colors import seed
from .compose import Movie, set_key
from .crowd import crowd
from .pen import font
from .sfx import events
from .sets import build, front

_G: dict = {}


def _prerender(job: tuple[str, dict, str]) -> tuple[str, dict[str, str]]:
    key, spec, folder = job
    s = seed(key, spec.get("place"), spec.get("time"))
    paths = {}
    for name, img in build(spec, s).items():
        paths[name] = str(Path(folder) / f"{key}_{name}.png")
        img.save(paths[name], compress_level=1)
    fr = front(spec.get("front"), s, crowd)
    if fr is not None:
        paths["front"] = str(Path(folder) / f"{key}_front.png")
        fr.save(paths["front"], compress_level=1)
    return key, paths


def prerender(sb: dict, folder: str, workers: int) -> dict[str, dict[str, str]]:
    jobs, seen = [], set()
    for i, sc in enumerate(sb["scenes"]):
        key = set_key(sb["scenes"], i)
        if key not in seen:
            seen.add(key)
            src = sb["scenes"][int(key[3:])]
            jobs.append((key, src.get("set", {}), folder))
    t0 = time.time()
    if workers > 1 and len(jobs) > 1:
        with mp.Pool(min(workers, len(jobs))) as pool:
            res = pool.map(_prerender, jobs)
    else:
        res = [_prerender(j) for j in jobs]
    print(f"sets: {len(jobs)} built in {time.time() - t0:.0f}s", flush=True)
    return dict(res)


def _loader(files: dict[str, dict[str, str]]):
    @lru_cache(4)
    def layers_for(key: str) -> dict:
        paths = files[key]
        out: dict[str, Image.Image | None] = {n: Image.open(p).convert("RGBA") for n, p in paths.items()}
        out.setdefault("front", None)
        return out
    return layers_for


def _init(sb, timing, total, fps, files):
    _G["movie"] = Movie(sb, timing, total, fps, _loader(files))


def _frame(n: int) -> bytes:
    m = _G["movie"]
    return m.frame(n / m.fps).tobytes()


def sheet(sb, timing, total, files, out: str, cols: int = 4) -> str:
    movie = Movie(sb, timing, total, 30, _loader(files))
    times = [t0 + (t1 - t0) * 0.6 for t0, t1, _ in timing][:20]
    tw, th = W // 4, H // 4
    rows = math.ceil(len(times) / cols)
    img = Image.new("RGB", (cols * tw, rows * th), (18, 18, 22))
    d = ImageDraw.Draw(img)
    for j, t in enumerate(times):
        img.paste(movie.frame(t).resize((tw, th), Image.Resampling.LANCZOS), ((j % cols) * tw, (j // cols) * th))
        d.text(((j % cols) * tw + 10, (j // cols) * th + 8), f"scene {j}", fill=(255, 220, 0), font=font(24, 800),
               stroke_width=3, stroke_fill=(0, 0, 0))
    img.save(out)
    return out


def prop_pops(sb: dict, timing) -> list[float]:
    out = []
    for sc, (t0, t1, _) in zip(sb["scenes"], timing):
        for pr in sc.get("props", []):
            if pr.get("anim", "pop") != "none":
                out.append(t0 + float(pr.get("at", 0)) * (t1 - t0))
    return out


def video(sb, timing, total, files, ffmpeg: str, out: str, voice=None, music=None, fps: int = 30,
          workers: int = 2, sfx: bool = True, tmp: str = ".", draft: bool = False) -> str:
    """draft: half the frames and a smaller 540x960 file, for checking timing before the full render"""
    audio = mix(voice, [t0 for t0, _, _ in timing[1:]], prop_pops(sb, timing), total, music, sfx,
                events(sb, timing))
    wav = os.path.join(tmp, "mix.wav")
    write_wav(wav, audio)
    nframes = int(total * fps)
    cmd = [ffmpeg, "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(fps),
           "-i", "-", "-i", wav, "-c:v", "libx264", "-preset", "veryfast",
           "-crf", "28" if draft else "20", *(["-vf", "scale=540:960"] if draft else []), "-pix_fmt", "yuv420p",
           "-af", "adeclick=w=55:o=75:t=2,lowpass=f=12000",   # safety pass: Kokoro has nothing above 12 kHz
           "-c:a", "aac", "-b:a", "128k" if draft else "192k", "-shortest", "-movflags", "+faststart", out]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stderr=subprocess.PIPE)
    assert proc.stdin is not None
    start = time.time()
    broken = False
    try:
        if workers > 1:
            with mp.Pool(workers, initializer=_init, initargs=(sb, timing, total, fps, files)) as pool:
                for n, data in enumerate(pool.imap(_frame, range(nframes), chunksize=8)):
                    proc.stdin.write(data)
                    if n % 150 == 0:
                        print(f"frame {n}/{nframes}  {time.time() - start:.0f}s", flush=True)
        else:
            _init(sb, timing, total, fps, files)
            for n in range(nframes):
                proc.stdin.write(_frame(n))
    except OSError:   # BrokenPipeError on POSIX, EINVAL on Windows
        broken = True   # ffmpeg exited early; its own error message is reported below
    finally:
        try:
            proc.stdin.close()
        except OSError:
            broken = True
        err = proc.stderr.read().decode(errors="replace") if proc.stderr else ""
        proc.wait()
    if proc.returncode != 0 or broken:
        raise RuntimeError(f"ffmpeg failed while encoding the video: {err.strip()[-800:] or 'no output'}")
    print(f"done -> {out}  ({total:.1f}s, {nframes} frames, {time.time() - start:.0f}s)", flush=True)
    return out
