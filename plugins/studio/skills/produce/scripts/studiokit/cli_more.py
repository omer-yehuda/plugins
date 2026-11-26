"""studio.py commands that only read: shots (the director's scene list) and finalcheck (the rendered video)."""
from pathlib import Path

from .spec import SpecError, load


def cmd_shots(a) -> int:
    from .flow import report
    print(report(load(a.storyboard)[0]))
    return 0


def cmd_finalcheck(a) -> int:
    """Compare the rendered video with its storyboard, scene by scene. Exit 1 when they do not match."""
    from . import finalcheck as fc
    sb, _ = load(a.storyboard)
    folder = Path(a.storyboard).resolve().parent
    video = Path(a.video) if a.video else folder / "video.mp4"
    if not video.is_file():
        raise SpecError(f"video not found: {video} (render first)")
    if a.fit_audio:                      # rendered with --fit-audio: the scenes were stretched to the sound
        from .render import fit_to_audio
        sb = fit_to_audio(sb, fc.probe(video)["seconds"])
    res = fc.check(sb, video, folder / "voice.lines.json")
    w, h = res["size"]
    print(f"{'PASS' if res['ok'] else 'FAIL'}: {res['seconds']:g}s, {w}x{h}, {res['scenes_checked']} of "
          f"{len(sb.scenes)} scenes match the storyboard" if res["ok"] else
          f"FAIL: {res['seconds']:g}s, {w}x{h}, {len(res['problems'])} problem(s)")
    for line in [f"  - {p}" for p in res["problems"]] + [f"  note: {n}" for n in res["notes"]]:
        print(line)
    return 0 if res["ok"] else 1


MORE = {"shots": cmd_shots, "finalcheck": cmd_finalcheck}


def register(sub) -> None:
    sub.add_parser("shots", help="director's scene list: transitions, camera, flow notes").add_argument("storyboard")
    s = sub.add_parser("finalcheck", help="compare the rendered video with its storyboard, scene by scene")
    s.add_argument("storyboard")
    s.add_argument("--video", help="the rendered file (default: video.mp4 next to the storyboard)")
    s.add_argument("--fit-audio", action="store_true", help="the video was rendered with --fit-audio")
