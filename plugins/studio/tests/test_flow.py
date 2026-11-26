"""1.3.0: the director's scene list (camera positions) and flow notes (how one scene leads into the next)."""
import json

from studiokit import cli
from studiokit.flow import camera, flow, report, table
from studiokit.spec import validate

SCREEN = {"type": "screen", "image": "pic.png", "zoom": [0.2, 0.2, 0.6, 0.7], "cursor": [0.5, 0.5], "click": 1.0}
TITLE = {"type": "title", "text": "Hello"}


def load(tmp_path, photo, board, *scenes):
    (tmp_path / "pic.png").write_bytes(photo.read_bytes())
    sb, errs, warns = validate(board(*scenes), tmp_path)
    assert not errs, errs
    return sb, warns


def test_example_flow_is_clean(example, tmp_path):
    sb, errs, warns = validate(example, tmp_path)
    assert not errs and flow(sb) == [] and not [w for w in warns if w.startswith("flow:")]
    rows = table(sb)
    assert rows[0].split() == ["scene", "type", "enters", "secs", "camera"] and len(rows) == len(sb.scenes) + 1
    assert report(sb).endswith("flow OK")


def test_screen_camera_positions(tmp_path, photo, board):
    sb, warns = load(tmp_path, photo, board, TITLE, SCREEN, {"type": "image", "image": "pic.png"})
    assert flow(sb) == [] and "zoom at 0.40,0.45 (20% of it), pointer 0.5,0.5 clicks at 1s" in camera(sb.scenes[1])
    assert camera(sb.scenes[0]) == "-" and "slow zoom" in camera(sb.scenes[2])
    bad = [TITLE, {"type": "screen", "image": "pic.png", "cursor": [0.5, 0.5]},
           {**SCREEN, "zoom": [0, 0, 1, 0.9], "transition": "cut"},
           {**SCREEN, "cursor": [0.9, 0.9], "click": 9, "duration": 4, "transition": "cut"}]
    sb, warns = load(tmp_path, photo, board, *bad)
    text = "\n".join(flow(sb))
    for needle in ("never moves in", "barely", "outside the zoom box", "after the scene ends"):
        assert needle in text
    assert "whole page, no move, pointer" in camera(sb.scenes[1])
    assert sum(w.startswith("flow:") for w in warns) == len(flow(sb))


def test_flow_between_scenes(tmp_path, photo, board):
    sb, _ = load(tmp_path, photo, board, TITLE, SCREEN, SCREEN)
    assert "the same screenshot twice" in flow(sb)[0]
    sb, _ = load(tmp_path, photo, board, TITLE, SCREEN, {**SCREEN, "transition": "cut"})
    assert flow(sb) == []
    sb, _ = load(tmp_path, photo, board, *[TITLE] * 6)
    assert "'slide' 5 times in a row" in flow(sb)[0]
    sb, _ = load(tmp_path, photo, board, *[{**TITLE, "transition": "zoom-punch"}] * 3, TITLE)
    assert "'zoom-punch' enters 3 scenes" in "\n".join(flow(sb))


def test_shots_command(tmp_path, board, capsys):
    path = tmp_path / "storyboard.json"
    path.write_text(json.dumps(board(*[TITLE] * 6)), encoding="utf-8")
    assert cli.main(["shots", str(path)]) == 0
    out = capsys.readouterr().out
    assert "FLOW: scenes 1-5" in out and "1 flow note(s)" in out
    path.write_text("{}", encoding="utf-8")
    assert cli.main(["shots", str(path)]) == cli.EXIT_INVALID
