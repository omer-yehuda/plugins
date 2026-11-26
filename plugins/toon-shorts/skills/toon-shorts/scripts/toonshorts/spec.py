"""Storyboard vocabulary and validation (errors block rendering, notes are quality hints)."""
import difflib
import re

OUTDOOR = ["city", "suburb", "farm", "mountains", "forest", "desert", "beach", "sea", "deck", "moon", "sky"]
INDOOR = ["room", "office", "palace", "court", "prison", "lab", "bank", "shop", "classroom"]
PLACES = OUTDOOR + INDOOR
TIMES = ["day", "sunset", "night", "dawn", "storm"]
LANDMARKS = ["none", "lattice_tower", "pyramid", "castle", "lighthouse", "clock_tower", "volcano"]
FRONTS = ["none", "bars", "desk", "crowd", "bushes"]
CAMERAS = ["static", "push_in", "pull_out", "pan_left", "pan_right", "tilt_up", "punch_in", "shake", "drift"]
POSES = ["stand", "point", "arms_up", "think", "hands_hips", "wave", "hold", "shrug", "walk", "run", "facepalm"]
MOODS = ["neutral", "happy", "laughing", "proud", "sad", "crying", "shocked", "scared", "angry", "furious",
         "sly", "thinking"]
HAIR = ["short", "slick", "curly", "long", "bun", "spiky", "ponytail", "bald"]
HATS = ["none", "top_hat", "bowler", "cap", "crown", "police", "beret", "helmet", "chef", "cowboy", "military",
        "headscarf"]
OUTFITS = ["shirt", "suit", "coat", "dress", "uniform", "robe", "hoodie"]
FACIAL = ["none", "mustache", "beard", "goatee"]
ITEMS = ["none", "money", "bag", "letter", "document", "newspaper", "gold", "crown", "clock", "lightbulb",
         "question", "exclamation", "handcuffs", "ship", "car", "coin", "key", "chest", "sign", "book", "torch",
         "map", "diamond", "phone", "rocket", "heart", "star", "plane", "trophy"]
ANIMS = ["none", "pop", "float", "spin", "pulse"]
ENTERS = ["none", "pop", "slide_left", "slide_right"]

CHAR_KEYS = {"hair_style": HAIR, "hat": HATS, "outfit": OUTFITS, "facial_hair": FACIAL}
SET_KEYS = {"place": PLACES, "time": TIMES, "landmark": LANDMARKS, "front": FRONTS}
HEBREW = re.compile(r"[֐-׿]")


def _bad(where: str, key: str, value, options: list[str]) -> str:
    near = difflib.get_close_matches(str(value), options, n=1)
    hint = f" Did you mean '{near[0]}'?" if near else ""
    return f"{where}: {key}='{value}' is not allowed.{hint} Options: {', '.join(options)}"


def is_rtl(sb: dict) -> bool:
    lang = str(sb.get("lang", "")).lower()
    if lang in ("he", "iw", "ar", "fa", "ur", "yi"):
        return True
    return any(HEBREW.search(s.get("say", "")) for s in sb.get("scenes", []))


def _check_characters(sb: dict, errors: list[str]) -> None:
    chars = sb.get("characters", {})
    if not isinstance(chars, dict):
        errors.append("characters must be an object of id -> look")
        return
    for cid, c in chars.items():
        for key, opts in CHAR_KEYS.items():
            if key in c and c[key] not in opts:
                errors.append(_bad(f"character {cid}", key, c[key], opts))


def _shape_ok(i: int, sc, errors: list[str]) -> bool:
    """malformed scenes become ERROR lines instead of tracebacks"""
    where = f"scene {i}"
    if not isinstance(sc, dict):
        errors.append(f"{where}: must be an object")
        return False
    ok = True
    for key, kind in (("set", dict), ("cast", list), ("props", list)):
        if key in sc and not isinstance(sc[key], kind):
            errors.append(f"{where}: '{key}' must be {'an object' if kind is dict else 'a list'}")
            ok = False
    for key in ("cast", "props"):
        if isinstance(sc.get(key), list) and not all(isinstance(x, dict) for x in sc[key]):
            errors.append(f"{where}: every '{key}' entry must be an object")
            ok = False
    return ok


def _check_scene(i: int, sc: dict, sb: dict, errors: list[str], notes: list[str]) -> None:
    where = f"scene {i}"
    say = str(sc.get("say", "")).strip()
    if not say:
        errors.append(f"{where}: 'say' is required (the exact words spoken in this scene)")
    elif len(say.split()) > 16:
        notes.append(f"{where}: {len(say.split())} words; split it, scenes read best under ~14 words")
    for key, opts in SET_KEYS.items():
        v = sc.get("set", {}).get(key)
        if v is not None and v not in opts:
            errors.append(_bad(where, f"set.{key}", v, opts))
    same = sc.get("same_set_as")
    if same is not None and (not isinstance(same, int) or not 0 <= same < i):
        errors.append(f"{where}: same_set_as must be the index of an EARLIER scene")
    if sc.get("camera", "push_in") not in CAMERAS:
        errors.append(_bad(where, "camera", sc.get("camera"), CAMERAS))
    colors = []
    for c in sc.get("cast", []):
        cid = c.get("id")
        if cid not in sb.get("characters", {}):
            errors.append(f"{where}: cast id '{cid}' is not defined in characters")
        for key, opts in (("pose", POSES), ("mood", MOODS), ("holding", ITEMS), ("enter", ENTERS)):
            if key in c and c[key] not in opts:
                errors.append(_bad(f"{where} {cid}", key, c[key], opts))
        x = c.get("x", 0.5)
        if not isinstance(x, (int, float)):
            errors.append(f"{where} {cid}: x must be a number between 0 and 1")
        elif not 0.12 <= x <= 0.88:
            notes.append(f"{where} {cid}: x={x} is near the edge; keep 0.2-0.8")
        colors.append(c.get("outfit_color") or sb.get("characters", {}).get(cid, {}).get("outfit_color"))
    if len([c for c in colors if c]) != len({c for c in colors if c}):
        notes.append(f"{where}: two characters share an outfit colour; they will be hard to tell apart")
    if len(sc.get("cast", [])) > 4:
        notes.append(f"{where}: more than 4 characters; use set.front='crowd' for groups")
    for p in sc.get("props", []):
        if p.get("type") not in ITEMS:
            errors.append(_bad(where, "prop type", p.get("type"), ITEMS))
        if p.get("anim", "pop") not in ANIMS:
            errors.append(_bad(where, "prop anim", p.get("anim"), ANIMS))


def check(sb: dict) -> tuple[list[str], list[str]]:
    """-> (errors, notes)."""
    errors: list[str] = []
    notes: list[str] = []
    scenes = sb.get("scenes")
    if not isinstance(scenes, list) or not scenes:
        return ["storyboard needs a non-empty 'scenes' list"], notes
    _check_characters(sb, errors)
    for i, sc in enumerate(scenes):
        if _shape_ok(i, sc, errors):
            _check_scene(i, sc, sb, errors, notes)
    from .pacing import notes as pace_notes, validate
    from .sfx import KINDS
    validate(sb, CAMERAS, KINDS, errors)
    if errors:
        return errors, notes
    notes += pace_notes(sb)
    from .director import flow
    notes += [f"flow: {line}" for line in flow(sb)]
    cams = [s.get("camera", "push_in") for s in scenes]
    for i in range(2, len(cams)):
        if cams[i] == cams[i - 1] == cams[i - 2]:
            notes.append(f"scenes {i - 2}-{i}: camera '{cams[i]}' three times in a row; vary it")
    if scenes[0].get("camera") not in ("punch_in", "shake"):
        notes.append("scene 0: the hook usually lands harder with camera 'punch_in'")
    words = sum(len(str(s.get("say", "")).split()) for s in scenes)
    secs = words / 2.6
    if secs > 62:
        notes.append(f"~{secs:.0f}s of speech ({words} words); Shorts must stay under 60s, cut lines")
    return errors, notes
