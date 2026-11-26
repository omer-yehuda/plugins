"""toon.py command line. Heavy modules are imported per command, so `check` needs no packages."""
import argparse
import json
import os
import shutil
import sys
import tempfile
from pathlib import Path


def _load(path: str) -> dict:
    with open(path, encoding="utf-8-sig") as f:
        return json.load(f)


def cmd_setup(a) -> int:
    from .setup_env import setup
    setup(voice=a.voice)
    return 0


def cmd_check(a) -> int:
    from .spec import check
    errors, notes = check(_load(a.storyboard))
    for e in errors:
        print("ERROR:", e)
    for n in notes:
        print("NOTE: ", n)
    print("OK" if not errors else f"{len(errors)} error(s) to fix", f"({len(notes)} note(s))" if notes else "")
    return 1 if errors else 0


def cmd_shots(a) -> int:
    """The director's shot list: every shot's camera, size and subject, then the flow notes."""
    from .director import flow, table
    from .spec import check
    sb = _load(a.storyboard)
    errors, _ = check(sb)
    for e in errors:
        print("ERROR:", e)
    if errors:
        return 1
    print("\n".join(table(sb)))
    notes = flow(sb)
    for n in notes:
        print("FLOW: ", n)
    print("flow OK" if not notes else f"{len(notes)} flow note(s)")
    return 0


def cmd_voices(a) -> int:
    from .voice import VOICES
    for vid, (lang, desc) in VOICES.items():
        if a.lang in (None, lang):
            print(f"{vid:12s} {lang}  {desc}")
    return 0


def cmd_samples(a) -> int:
    from .voice import VOICES, samples
    for letter, vid, path in samples(a.text, a.out, a.lang, a.voices.split(",") if a.voices else None, a.speed):
        print(f"{letter}  {vid:12s} {VOICES[vid][1]:42s} -> {path}")
    return 0


def cmd_voice(a) -> int:
    from .voice import make
    wav, lines = make(_load(a.storyboard), a.voice, a.out, a.speed)
    print(f"done -> {wav} and {lines}")
    return 0


def _prepare(a):
    from .audio import decode, find_ffmpeg
    from .spec import check
    from .timing import build
    sb = _load(a.storyboard)
    errors, _ = check(sb)
    if errors:
        for e in errors:
            print("ERROR:", e)
        raise SystemExit("fix the storyboard first (run `toon.py check`)")
    ff = find_ffmpeg(a.ffmpeg)
    voice = decode(ff, a.audio) if a.audio else None
    spans = None
    lines = Path(a.lines) if a.lines else (Path(a.audio).with_suffix(".lines.json") if a.audio else None)
    if lines and lines.exists():
        spans = json.loads(lines.read_text(encoding="utf-8-sig"))
    timing, total = build(sb["scenes"], voice, spans)
    for i, (t0, t1, _) in enumerate(timing):
        print(f"scene {i:2d}  {t0:6.2f}-{t1:6.2f}s  {sb['scenes'][i].get('say', '')[:56]}")
    print(f"total {total:.1f}s" + ("  (over 60s: too long for Shorts!)" if total > 60 else ""))
    from .pacing import report
    for line in report(sb["scenes"], [(t0, t1) for t0, t1, _ in timing]):
        print("PACE: ", line)
    return sb, timing, total, ff, voice


def cmd_preview(a) -> int:
    from .render import prerender, sheet
    sb, timing, total, _, _ = _prepare(a)
    tmp = tempfile.mkdtemp(prefix="toon-")
    try:
        print("preview ->", sheet(sb, timing, total, prerender(sb, tmp, a.workers), a.out))
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    return 0


def cmd_render(a) -> int:
    from .audio import decode
    from .render import prerender, video
    sb, timing, total, ff, voice = _prepare(a)
    music = decode(ff, a.music) if a.music else None
    tmp = tempfile.mkdtemp(prefix="toon-")
    try:
        files = prerender(sb, tmp, a.workers)
        Path(a.out).parent.mkdir(parents=True, exist_ok=True)
        fps = min(a.fps, 15) if a.draft else a.fps
        video(sb, timing, total, files, ff, a.out, voice, music, fps, a.workers, not a.no_sfx, tmp, a.draft)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    return 0


def parser() -> argparse.ArgumentParser:
    ap = argparse.ArgumentParser(prog="toon.py", description="toon-shorts: storyboard -> animated short")
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("setup", help="create the private venv (pinned packages); --voice adds the AI voice")
    p.add_argument("--voice", action="store_true")
    sub.add_parser("check", help="validate a storyboard").add_argument("storyboard")
    sub.add_parser("shots", help="director's shot list and camera flow notes").add_argument("storyboard")
    sub.add_parser("voices", help="list AI voices").add_argument("--lang")
    p = sub.add_parser("samples", help="render the hook in a few voices")
    p.add_argument("--text", required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--lang", default="en")
    p.add_argument("--voices")
    p.add_argument("--speed", type=float, default=1.1)
    p = sub.add_parser("voice", help="full AI voiceover + exact line timings")
    p.add_argument("storyboard")
    p.add_argument("--voice", required=True)
    p.add_argument("--out", default="voice.wav")
    p.add_argument("--speed", type=float, default=1.1)
    workers = max(1, min(4, (os.cpu_count() or 2) - 1))
    for name, default in (("preview", "preview.png"), ("render", "short.mp4")):
        p = sub.add_parser(name, help="contact sheet (one frame per scene)" if name == "preview" else "final MP4")
        p.add_argument("storyboard")
        p.add_argument("--audio", help="voiceover (AI voice.wav or the user's own recording)")
        p.add_argument("--lines", help="line timings json (auto-found next to the audio)")
        p.add_argument("--out", default=default)
        p.add_argument("--workers", type=int, default=workers)
        p.add_argument("--ffmpeg")
        if name == "render":
            p.add_argument("--music")
            p.add_argument("--fps", type=int, default=30)
            p.add_argument("--no-sfx", action="store_true")
            p.add_argument("--draft", action="store_true", help="quick 540x960 15 fps check render")
    return ap


COMMANDS = {"setup": cmd_setup, "check": cmd_check, "shots": cmd_shots, "voices": cmd_voices, "samples": cmd_samples,
            "voice": cmd_voice, "preview": cmd_preview, "render": cmd_render}


def main(argv: list[str] | None = None) -> int:
    a = parser().parse_args(argv)
    try:
        return COMMANDS[a.cmd](a)
    except (RuntimeError, ValueError, OSError, KeyError, TypeError, AttributeError) as e:
        print(f"ERROR: {e}", file=sys.stderr)
        return 2
