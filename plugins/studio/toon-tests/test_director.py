"""1.2.0: the director's shot list (camera positions) and flow notes (how one shot leads into the next)."""
import copy
import json

from toonshorts import cli
from toonshorts.director import flow, set_root, shot_list, table
from toonshorts.spec import check


def _two(**scene) -> dict:
    base = {"say": "Two people talk.", "set": {"place": "room"}, "camera": "push_in",
            "cast": [{"id": "a", "x": 0.3}, {"id": "b", "x": 0.7}]}
    return {"characters": {"a": {"outfit_color": "red"}, "b": {"outfit_color": "blue"}}, "scenes": [{**base, **scene}]}


def test_shot_list_follows_cuts_and_sets(onoda):
    shots = shot_list(onoda)
    assert [(s["scene"], s["shot"], s["camera"], s["size"]) for s in shots[:2]] == [
        (0, 0, "punch_in", "close"), (0, 1, "drift", "wide")]
    assert shots[1]["focus"] == shots[0]["focus"]                    # a cut without a focus keeps the last one
    assert set_root(onoda["scenes"], 9) == 8 and shots[-1]["subject"] == "onoda"
    assert set_root([{"same_set_as": 0}], 0) == 0                    # a bad reference never loops
    empty = shot_list({"scenes": [{"say": "The sea.", "camera": "static"}]})[0]
    assert empty["subject"] == "set" and empty["focus"] == 0.5
    assert table(onoda)[0].split()[:3] == ["scene", "shot", "camera"] and len(table(onoda)) == len(shots) + 1


def test_examples_have_clean_flow(onoda):
    assert flow(onoda) == []
    assert not [n for n in check(onoda)[1] if n.startswith("flow:")]


def test_camera_aimed_at_nothing_and_off_the_speaker():
    assert "where nothing stands" in flow(_two(focus=0.95))[0]
    sb = _two(focus=0.7)
    sb["scenes"][0]["cast"][0]["talking"] = True
    assert "a speaks but the only shot goes to b" in flow(sb)[0]
    sb["scenes"][0]["cuts"] = [{"at": 0.5, "camera": "punch_in", "focus": 0.3}]
    assert flow(sb) == []                                            # a cut makes it a reaction shot
    assert flow(_two(focus=0.5, cast=[{"id": "a", "x": 0.3, "talking": True}, {"id": "b", "x": 0.7}])) == []


def test_cut_that_changes_nothing_and_walk_against_the_camera():
    sb = _two(cuts=[{"at": 0.5, "camera": "push_in"}])
    assert "nothing changes" in flow(sb)[0]
    sb = _two(camera="pan_left", cast=[{"id": "a", "x": 0.4, "pose": "run", "facing": "right"}])
    assert "moves against a's run" in flow(sb)[0]
    sb["scenes"][0]["camera"] = "pan_right"
    assert flow(sb) == []


def test_crossing_the_line_pan_swing_and_close_run():
    sb = _two(camera="static")
    nxt = copy.deepcopy(sb["scenes"][0])
    nxt.update(same_set_as=0, cast=[{"id": "a", "x": 0.7}, {"id": "b", "x": 0.3}])
    sb["scenes"].append(nxt)
    assert "a and b swap sides" in flow(sb)[0]
    del sb["scenes"][1]["same_set_as"]
    assert flow(sb) == []                                            # a new set resets screen direction
    sb = _two(camera="pan_left", cuts=[{"at": 0.5, "camera": "pan_right"}])
    assert "back the way it came" in " ".join(flow(sb))
    sb = {"scenes": [{"say": "x", "camera": "punch_in", "cast": [{"id": "a", "x": 0.5}]}] * 3}
    assert "three close shots" in " ".join(flow(sb))
    assert flow({"scenes": ["junk", {"say": "x", "cast": ["junk"], "props": ["junk"], "cuts": ["junk"]}]}) == []


def test_check_reports_flow_and_shots_command(tmp_path, capsys):
    sb = _two(focus=0.95)
    assert any(n.startswith("flow:") for n in check(sb)[1])
    path = tmp_path / "sb.json"
    path.write_text(json.dumps(sb), encoding="utf-8")
    assert cli.main(["shots", str(path)]) == 0
    out = capsys.readouterr().out
    assert "FLOW:" in out and "1 flow note(s)" in out and "nothing" in out
    path.write_text(json.dumps(_two()), encoding="utf-8")
    assert cli.main(["shots", str(path)]) == 0 and "flow OK" in capsys.readouterr().out
    path.write_text(json.dumps(_two(camera="zoom")), encoding="utf-8")
    assert cli.main(["shots", str(path)]) == 1 and "ERROR:" in capsys.readouterr().out
