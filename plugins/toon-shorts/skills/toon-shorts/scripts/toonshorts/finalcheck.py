"""Final check: does the rendered short show what the storyboard draws, and say what it should say?

The engine redraws one frame per shot from the storyboard and the voice timing, and compares it with the same
frame taken from the file. A scene that is missing, out of place or cut off shows up as a mismatch. Length and
frame shape come from the same timing the render used, and every spoken line must be audible in the file."""
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image

from . import H, W
from .audio import SR, decode
from .pacing import shots

SHRINK = 8                # both pictures are shrunk this much before they are compared
TILE = 8                  # compared tile by tile, so one wrong prop is not averaged away
MISMATCH = 10.0           # worst tile's mean grey difference (0-255): the same frame measures under 3 even in a
                          # draft, one changed expression over 20
LENGTH_SLACK = 0.3        # seconds the file may differ from the timing
QUIET_LINE = -45.0        # dBFS: a spoken line below this is missing from the file


def probe(ffmpeg: str, video: str) -> dict:
    """-> {'seconds', 'size', 'fps', 'audio'} read from ffmpeg's description of the file"""
    log = subprocess.run([ffmpeg, "-hide_banner", "-i", video], capture_output=True, text=True, errors="replace").stderr
    dur = re.search(r"Duration:\s*(\d+):(\d+):([\d.]+)", log)
    vid = re.search(r"Stream #0.*Video:.*?\b(\d{2,5})x(\d{2,5})\b.*?([\d.]+) fps", log)
    if not dur or not vid:
        raise ValueError(f"{video} is not a video ffmpeg can read")
    return {"seconds": int(dur[1]) * 3600 + int(dur[2]) * 60 + float(dur[3]), "size": (int(vid[1]), int(vid[2])),
            "fps": float(vid[3]), "audio": bool(re.search(r"Stream #0.*Audio:", log))}


def grab(ffmpeg: str, video: str, n: int, fps: float, size: tuple[int, int]) -> np.ndarray | None:
    """frame number n of the file as a small grey picture, or None when the file has no such frame"""
    w, h = size
    t = max(0.0, (n - 0.4) / fps)          # ffmpeg returns the first frame at or after t: aim just before frame n
    raw = subprocess.run([ffmpeg, "-v", "error", "-ss", f"{t:.4f}", "-i", video, "-frames:v", "1", "-vf",
                          f"scale={w}:{h}:flags=area", "-f", "rawvideo", "-pix_fmt", "gray", "-"], capture_output=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(h, w).astype(np.int16) if len(raw) == w * h else None


def difference(a: np.ndarray, b: np.ndarray) -> float:
    """the mean grey difference of the worst TILE x TILE block"""
    h, w = (a.shape[0] // TILE) * TILE, (a.shape[1] // TILE) * TILE
    d = np.abs(a[:h, :w] - b[:h, :w]).reshape(h // TILE, TILE, w // TILE, TILE).mean(axis=(1, 3))
    return float(d.max()) if d.size else 0.0


def proof_frames(scenes: list[dict], timing, fps: float, total: float) -> list[tuple[int, int]]:
    """(scene index, frame number): the middle of every shot, so each cut is checked too"""
    last = max(0, int(total * fps) - 1)
    return [(i, min(last, round((a + b) / 2 * fps))) for a, b, i in shots(scenes, [(t0, t1) for t0, t1, _ in timing])]


def check(sb: dict, timing, total: float, movie, ffmpeg: str, video: str, voiced: bool) -> dict:
    """{'ok', 'seconds', 'size', 'shots_checked', 'problems', 'notes'}"""
    info, problems, notes = probe(ffmpeg, video), [], []
    if abs(info["seconds"] - total) > LENGTH_SLACK:
        problems.append(f"the file is {info['seconds']:.1f}s but the storyboard and voice add up to {total:.1f}s: the "
                        "render stopped early, or the storyboard or voice changed after it; render again")
    w, h = info["size"]
    if abs(w / h - W / H) > 0.01:
        problems.append(f"the frame is {w}x{h}, which is not 9:16")
    size, checked = (max(TILE, w // SHRINK), max(TILE, h // SHRINK)), 0
    for i, n in proof_frames(sb["scenes"], timing, info["fps"], total):
        got = grab(ffmpeg, video, n, info["fps"], size)
        if got is None:
            problems.append(f"scene {i}: the file has no picture at {n / info['fps']:.1f}s, where this scene should be")
            continue
        checked += 1
        own = np.asarray(movie.frame(n / info["fps"]).convert("L").resize(size, Image.Resampling.BOX), np.int16)
        d = difference(got, own)
        if d > MISMATCH:
            problems.append(f"scene {i}: at {n / info['fps']:.1f}s the file does not show what the storyboard draws "
                            f"(difference {d:.0f}, limit {MISMATCH:g}); the storyboard changed after the render, or the render is wrong")
    if not info["audio"]:
        problems.append("the file has no sound track")
    else:
        x = decode(ffmpeg, video)
        if float(np.max(np.abs(x), initial=0.0)) >= 0.999:
            notes.append("the sound touches full scale (it may clip); lower the music or the voice")
        for i, (_, _, words) in enumerate(timing if voiced else []):
            if words:
                part = x[int(words[0][1] * SR):int(words[-1][2] * SR)]
                rms = float(np.sqrt(np.mean(np.square(part)))) if len(part) else 0.0
                if 20 * np.log10(max(rms, 1e-9)) < QUIET_LINE:
                    problems.append(f"scene {i}: the line \"{str(sb['scenes'][i].get('say', ''))[:40]}\" is silent in the file")
        if not voiced:
            notes.append("no voice given: the words were not checked (captions only, or pass --audio)")
    return {"ok": not problems, "seconds": round(info["seconds"], 2), "size": info["size"], "shots_checked": checked,
            "problems": problems, "notes": notes}


def command(a, sb: dict, timing, total: float, ff: str, voice) -> int:
    """`toon.py finalcheck`: exit 1 when the file is not what the storyboard and voice say it should be"""
    from .compose import Movie
    from .render import _loader, prerender
    video = a.video or str(Path(a.storyboard).resolve().parent / "short.mp4")
    if not Path(video).is_file():
        raise ValueError(f"video not found: {video} (render first, or pass --video)")
    tmp = tempfile.mkdtemp(prefix="toon-")
    try:
        movie = Movie(sb, timing, total, probe(ff, video)["fps"], _loader(prerender(sb, tmp, a.workers)))
        res = check(sb, timing, total, movie, ff, video, voice is not None)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    w, h = res["size"]
    head = f"{res['shots_checked']} shots match the storyboard" if res["ok"] else f"{len(res['problems'])} problem(s)"
    print(f"{'PASS' if res['ok'] else 'FAIL'}: {res['seconds']:g}s, {w}x{h}, {head}")
    for line in [f"  - {p}" for p in res["problems"]] + [f"  note: {n}" for n in res["notes"]]:
        print(line)
    return 0 if res["ok"] else 1
