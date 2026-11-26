"""The director's view of a storyboard: one line per shot (camera, where it looks, who is there)
and flow notes about how each shot leads into the next. Pure data, no packages needed."""
AIMED = ("push_in", "pull_out", "punch_in")          # cameras that travel toward `focus`
SIZE = {"punch_in": "close", "push_in": "medium", "shake": "medium"}     # everything else reads as wide
SIDEWAYS = {"pan_left": -1, "pan_right": 1, "drift": 1}
NEAR = 0.22               # how far (in frame widths) the focus may sit from its subject


def _num(v, default: float) -> float:
    return float(v) if isinstance(v, (int, float)) and not isinstance(v, bool) else default


def _marks(sc: dict) -> list[tuple[str, float]]:
    """every thing the camera could look at in a scene -> (name, x)"""
    out = [(str(c.get("id", "?")), _num(c.get("x"), 0.5)) for c in sc.get("cast", []) if isinstance(c, dict)]
    return out + [(str(p.get("type", "?")), _num(p.get("x"), 0.5)) for p in sc.get("props", []) if isinstance(p, dict)]


def _subject(marks: list[tuple[str, float]], focus: float) -> tuple[str, float] | None:
    near = min(marks, key=lambda m: abs(m[1] - focus), default=None)
    return near if near and abs(near[1] - focus) <= NEAR else None


def set_root(scenes: list[dict], i: int) -> int:
    """index of the scene whose set scene i really uses (follows same_set_as)"""
    seen = set()
    while i not in seen:
        seen.add(i)
        j = scenes[i].get("same_set_as")
        if not isinstance(j, int) or isinstance(j, bool) or not 0 <= j < i:
            break
        i = j
    return i


def shot_list(sb: dict) -> list[dict]:
    """-> one dict per shot, in order: scene, shot, camera, focus, size, subject, set, at"""
    scenes, out = sb.get("scenes", []), []
    for i, sc in enumerate(scenes):
        marks = _marks(sc)
        cast = [c for c in sc.get("cast", []) if isinstance(c, dict)]
        cam = sc.get("camera", "push_in")
        focus = _num(sc.get("focus"), _num(cast[0].get("x"), 0.5) if cast else 0.5)
        cuts = sorted((c for c in sc.get("cuts", []) if isinstance(c, dict)), key=lambda c: _num(c.get("at"), 0))
        for k, c in enumerate([None] + cuts):
            if c:
                cam, focus = c.get("camera", cam), _num(c.get("focus"), focus)
            sub = _subject(marks, focus)
            out.append({"scene": i, "shot": k, "camera": cam, "focus": round(focus, 2),
                        "size": SIZE.get(cam, "wide"), "subject": sub[0] if sub else ("set" if not marks else None),
                        "set": set_root(scenes, i), "at": _num(c.get("at"), 0) if c else 0.0})
    return out


def _sides(sc: dict) -> dict[str, float]:
    return {str(c.get("id")): _num(c.get("x"), 0.5) for c in sc.get("cast", []) if isinstance(c, dict)}


def _aim_notes(sc: dict, sh: dict, where: str) -> list[str]:
    marks = _marks(sc)
    if sh["camera"] not in AIMED or not marks or sh["subject"]:
        return []
    name, x = min(marks, key=lambda m: abs(m[1] - sh["focus"]))
    return [f"{where}: camera '{sh['camera']}' aims at x={sh['focus']:g} where nothing stands; "
            f"the nearest is {name} at {x:g}, set focus there"]


def _speaker_notes(i: int, sc: dict, shots: list[dict]) -> list[str]:
    """one uncut shot that travels to someone else while a single character speaks (a cut to a listener
    is a reaction shot and is fine)"""
    talkers = [c for c in sc.get("cast", []) if isinstance(c, dict) and c.get("talking") is True]
    if len(talkers) != 1 or len(shots) != 1 or shots[0]["camera"] not in AIMED or not shots[0]["subject"]:
        return []
    who, x = str(talkers[0].get("id")), _num(talkers[0].get("x"), 0.5)
    if abs(x - shots[0]["focus"]) <= NEAR:
        return []
    return [f"scene {i}: {who} speaks but the only shot goes to {shots[0]['subject']}; put focus on {who} "
            f"(x={x:g}) or add a cut, so the reaction reads as a choice"]


def _motion_notes(i: int, sc: dict, shots: list[dict]) -> list[str]:
    out = []
    for c in sc.get("cast", []):
        if not isinstance(c, dict) or c.get("pose") not in ("walk", "run"):
            continue
        way = 1 if c.get("facing", "right") == "right" else -1
        for s in shots:
            if SIDEWAYS.get(s["camera"], way) != way:
                out.append(f"scene {i}: camera '{s['camera']}' moves against {c.get('id')}'s {c['pose']}; "
                           "move the camera the way they go")
                break
    return out


def flow(sb: dict) -> list[str]:
    """notes on camera positions and on how each shot leads into the next"""
    scenes = [s for s in sb.get("scenes", []) if isinstance(s, dict)]
    shots = shot_list({"scenes": scenes})
    out: list[str] = []
    for i, sc in enumerate(scenes):
        mine = [s for s in shots if s["scene"] == i]
        for s in mine:
            where = f"scene {i}" + (f" shot {s['shot']}" if len(mine) > 1 else "")
            out += _aim_notes(sc, s, where)
        out += _speaker_notes(i, sc, mine) + _motion_notes(i, sc, mine)
        for a, b in zip(mine, mine[1:]):
            if (a["camera"], a["focus"]) == (b["camera"], b["focus"]):
                out.append(f"scene {i} shot {b['shot']}: the cut repeats camera '{b['camera']}' on the same "
                           "focus, so nothing changes; give it a new camera or focus")
        if i and set_root(scenes, i) == set_root(scenes, i - 1):
            was, now = _sides(scenes[i - 1]), _sides(sc)
            both = sorted(set(was) & set(now))
            for n, a in enumerate(both):
                for b in both[n + 1:]:
                    if (was[a] - was[b]) * (now[a] - now[b]) < 0:
                        out.append(f"scenes {i - 1}-{i}: {a} and {b} swap sides on the same set; viewers lose "
                                   "who is where. Keep their sides, or change the set")
    for a, b in zip(shots, shots[1:]):
        da, db = SIDEWAYS.get(a["camera"]), SIDEWAYS.get(b["camera"])
        if da and db and da != db and a["set"] == b["set"]:
            out.append(f"scenes {a['scene']}-{b['scene']}: '{a['camera']}' then '{b['camera']}' swings the camera "
                       "back the way it came; keep one direction or put a still shot between")
    for a, b, c in zip(shots, shots[1:], shots[2:]):
        if a["size"] == b["size"] == c["size"] == "close":
            out.append(f"scenes {a['scene']}-{c['scene']}: three close shots in a row; go wide once so the "
                       "viewer sees where they are")
    return out


def table(sb: dict) -> list[str]:
    """the shot list as text lines, one per shot"""
    rows = [f"{'scene':>5} {'shot':>4}  {'camera':<10} {'size':<6} {'focus':>5}  {'looks at':<12} set"]
    for s in shot_list(sb):
        rows.append(f"{s['scene']:>5} {s['shot']:>4}  {s['camera']:<10} {s['size']:<6} {s['focus']:>5g}  "
                    f"{str(s['subject'] or 'nothing'):<12} {s['set']}")
    return rows
