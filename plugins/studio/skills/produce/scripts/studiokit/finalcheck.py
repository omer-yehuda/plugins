"""Final check: does the rendered file show what the storyboard draws?

Studio's renderer is deterministic, so the check redraws one settled frame per scene at the file's own size,
shrinks it, and compares it with the same frame taken from the file. A scene that is missing, out of place or cut off shows up
as a mismatch. Length, frame shape and the sound are checked against the storyboard's own numbers."""
import json
import subprocess
from pathlib import Path

from .ffmpeg import FfmpegError, require
from .paths import find_tool

SHRINK = 8                # both pictures are shrunk this much before they are compared
TILE = 8                  # the pictures are compared tile by tile, so one changed word is not averaged away
MISMATCH = 6.0            # worst tile's mean grey difference (0-255): the same frame measures under 2, one changed word over 9
LENGTH_SLACK = 0.25       # seconds the file may differ from the storyboard (one frame plus container rounding)


def probe(video: Path) -> dict:
    """-> {'seconds', 'size', 'fps', 'audio'} read from the file with ffprobe"""
    exe = find_tool("ffprobe")
    if not exe:
        raise FfmpegError("ffprobe was not found (it ships with ffmpeg)")
    r = subprocess.run([exe, "-v", "error", "-show_entries", "format=duration:stream=codec_type,width,height,r_frame_rate",
                        "-of", "json", str(video)], capture_output=True, text=True)
    try:
        data = json.loads(r.stdout)
        v = next(s for s in data["streams"] if s["codec_type"] == "video")
        num, den = v["r_frame_rate"].split("/")
        return {"seconds": float(data["format"]["duration"]), "size": (int(v["width"]), int(v["height"])),
                "fps": float(num) / float(den), "audio": any(s["codec_type"] == "audio" for s in data["streams"])}
    except (ValueError, KeyError, StopIteration, ZeroDivisionError) as e:
        raise FfmpegError(f"{video} is not a video ffprobe can read: {r.stderr.strip()[:200]}") from e


def grab(video: Path, t: float, size: tuple[int, int]):
    """the file's frame at time t as a small grey image (bytes), or None when the file has no frame there"""
    w, h = size
    r = subprocess.run([require(), "-v", "error", "-ss", f"{t:.4f}", "-i", str(video), "-frames:v", "1",
                        "-vf", f"scale={w}:{h}:flags=area", "-f", "rawvideo", "-pix_fmt", "gray", "-"], capture_output=True)
    return r.stdout if len(r.stdout) == w * h else None


def proof_frames(sb, fps: float):
    """(scene, frame number) pairs: one settled frame per scene, after its transition and before its end"""
    for s in sb.scenes:
        n0, n1 = round(s.start * fps), round((s.start + s.duration) * fps)
        yield s, min(n1 - 1, max(n0, round((s.start + s.duration * 0.92) * fps)))


def drawn(sb, s, n: int, fps: float, full: tuple[int, int], small: tuple[int, int]) -> bytes:
    """the frame the renderer draws for frame number n at the file's size, shrunk to a small grey image"""
    from PIL import Image
    from .canvas import progress_bar
    from .scenes_media import draw_scene
    img = draw_scene(s, n / fps - s.start, full)
    progress_bar(img, (n + 1) / (sb.duration * fps), s.accent, s.theme, s.fmt)
    return img.convert("L").resize(small, Image.Resampling.BOX).tobytes()


def difference(a: bytes, b: bytes, size: tuple[int, int]) -> float:
    """the mean grey difference of the worst TILE x TILE block of two small pictures"""
    w, h = size
    worst = 0.0
    for ty in range(0, h - TILE + 1, TILE):
        for tx in range(0, w - TILE + 1, TILE):
            total = 0
            for y in range(ty, ty + TILE):
                row = y * w + tx
                total += sum(abs(p - q) for p, q in zip(a[row:row + TILE], b[row:row + TILE]))
            worst = max(worst, total / (TILE * TILE))
    return worst


def check(sb, video: Path, lines: Path | None = None) -> dict:
    """{'ok', 'seconds', 'size', 'scenes_checked', 'problems', 'notes'}"""
    from .canvas import FORMATS, frame_size
    info, problems, notes = probe(video), [], []
    if abs(info["seconds"] - sb.duration) > LENGTH_SLACK:
        problems.append(f"the file is {info['seconds']:.1f}s but the storyboard adds up to {sb.duration:.1f}s: "
                        "the render stopped early or the storyboard changed after it; render again")
    w, h = info["size"]
    if frame_size(w / FORMATS[sb.format]["size"][0], sb.format) != (w, h):
        problems.append(f"the frame is {w}x{h}, which is not the '{sb.format}' format at any scale")
    size, checked = (max(TILE, w // SHRINK), max(TILE, h // SHRINK)), 0
    for s, n in proof_frames(sb, info["fps"]):
        t = max(0.0, (n - 0.4) / info["fps"])      # ffmpeg returns the first frame at or after t: aim just before frame n
        got = grab(video, t, size)
        if got is None:
            problems.append(f"scene {s.index} ({s.type}): the file has no picture at {t:.1f}s, where this scene should be")
            continue
        checked += 1
        d = difference(got, drawn(sb, s, n, info["fps"], (w, h), size), size)
        if d > MISMATCH:
            problems.append(f"scene {s.index} ({s.type}): at {t:.1f}s the file does not show what the storyboard draws "
                            f"(difference {d:.0f}, limit {MISMATCH:g}); the storyboard changed after the render, or the render is wrong")
    if sb.audio and not info["audio"]:
        problems.append("the storyboard names an audio file but the video has no sound")
    if info["audio"] and lines and Path(lines).is_file():
        from .audio import check as audio_check
        problems += [f"sound: {p}" for p in audio_check(video, lines)["problems"]]
    elif info["audio"]:
        notes.append("sound not checked line by line (no voice.lines.json); run audiocheck if there is narration")
    else:
        notes.append("no sound (captions only)")
    return {"ok": not problems, "seconds": round(info["seconds"], 2), "size": info["size"],
            "scenes_checked": checked, "problems": problems, "notes": notes}
