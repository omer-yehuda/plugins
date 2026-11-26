"""Storyboard loading and validation. Every error names the scene index. No Pillow needed."""
import difflib
import json
from pathlib import Path

from . import spec_media as media
from .model import FORMAT_NAMES, SCENE_TYPES, Scene, SpecError, Storyboard, default_duration
from .motion import TRANSITIONS
from .safety import inside
from .themes import DEFAULT_ACCENT, PALETTES, parse_accent

COMMON = {"type", "duration", "theme", "accent", "transition", "say"}
FIELDS = {
    "title": {"text"}, "bullets": {"text", "items"}, "stat": {"value", "label", "prefix", "suffix"},
    "compare": {"left", "right"}, "quote": {"text", "author"}, "image": {"image", "text"},
    "screen": {"image", "text", "url", "zoom", "cursor", "click"}, "link": {"text", "sub"}, "cta": {"text", "sub"},
}
TOP = {"title", "scenes", "audio", "meta", "accent", "format"}
MAX_TEXT = 140
MAX_SCENE_SECONDS = 20


def _hint(key: str, allowed) -> str:
    near = difflib.get_close_matches(key, sorted(allowed), n=1)
    return f" Did you mean '{near[0]}'?" if near else f" Allowed: {', '.join(sorted(allowed))}."


def _str(d, key, where, errs, required=False) -> str:
    v = d.get(key)
    if v is None:
        if required:
            errs.append(f"{where}: '{key}' is required")
        return ""
    if not isinstance(v, str) or not v.strip():
        errs.append(f"{where}: '{key}' must be a non-empty string")
        return ""
    if len(v) > MAX_TEXT:
        errs.append(f"{where}: '{key}' is {len(v)} characters, the limit is {MAX_TEXT}. Say less.")
    return v.strip()


def _items(v, where, errs, lo, hi) -> list:
    if not isinstance(v, list) or not lo <= len(v) <= hi or not all(isinstance(x, str) and x.strip() for x in v):
        errs.append(f"{where} must be a list of {lo}-{hi} non-empty strings")
        return []
    return [x.strip() for x in v]


def _side(d, key, where, errs) -> dict:
    v = d.get(key)
    if not isinstance(v, dict):
        errs.append(f"{where}: '{key}' must be an object with 'title' and 'items'")
        return {"title": "", "items": []}
    extra = set(v) - {"title", "items"}
    for k in sorted(extra):
        errs.append(f"{where}: '{key}.{k}' is not allowed.{_hint(k, {'title', 'items'})}")
    return {"title": _str(v, "title", f"{where}: '{key}'", errs, True),
            "items": _items(v.get("items"), f"{where}: '{key}.items'", errs, 1, 3)}


def _scene(i, raw, base: Path, default_accent, errs, fmt: str = "short") -> Scene | None:
    where = f"scene {i}"
    if not isinstance(raw, dict):
        errs.append(f"{where}: must be an object")
        return None
    kind = raw.get("type")
    if kind not in SCENE_TYPES:
        errs.append(f"{where}: 'type' must be one of {', '.join(SCENE_TYPES)}" + _hint(str(kind), SCENE_TYPES)
                    if kind else f"{where}: 'type' is required (one of {', '.join(SCENE_TYPES)})")
        return None
    where = f"scene {i} ({kind})"
    allowed = COMMON | FIELDS[kind]
    for k in sorted(set(raw) - allowed):
        errs.append(f"{where}: unknown field '{k}'.{_hint(k, allowed)}")
    theme = raw.get("theme", "light" if i % 2 == 0 else "dark")
    if theme not in PALETTES:
        errs.append(f"{where}: 'theme' must be 'light' or 'dark'")
    accent = parse_accent(raw.get("accent", default_accent))
    if accent is None:
        errs.append(f"{where}: 'accent' must be a name (coral, blue, green, yellow, purple, orange, pink, teal) or #RRGGBB")
    trans = raw.get("transition", "cut" if i == 0 else "slide")
    if trans not in TRANSITIONS:
        errs.append(f"{where}: 'transition' must be one of {', '.join(TRANSITIONS)}" + _hint(str(trans), TRANSITIONS))
    s = Scene(i, kind, 0.0, theme, accent or (0, 0, 0), trans, fmt=fmt)
    s.say = media.say(raw, where, errs)
    s.text = _str(raw, "text", where, errs, required=kind in ("title", "quote", "cta", "link"))
    s.author, s.sub = _str(raw, "author", where, errs), _str(raw, "sub", where, errs)
    if kind == "bullets":
        s.items = _items(raw.get("items"), f"{where}: 'items'", errs, 1, 4)
    if kind == "stat":
        v = raw.get("value")
        if isinstance(v, bool) or not isinstance(v, (int, float)):
            errs.append(f"{where}: 'value' must be a number (use 'prefix'/'suffix' for $ or %)")
        else:
            s.value = v
        s.label = _str(raw, "label", where, errs, True)
        s.prefix, s.suffix = raw.get("prefix", ""), raw.get("suffix", "")
        if not isinstance(s.prefix, str) or not isinstance(s.suffix, str):
            errs.append(f"{where}: 'prefix' and 'suffix' must be strings")
            s.prefix = s.suffix = ""
    if kind == "compare":
        s.left, s.right = _side(raw, "left", where, errs), _side(raw, "right", where, errs)
    if kind in ("image", "screen"):
        s.image = media.image_path(raw, base, where, errs)
    if kind == "screen":
        media.screen(s, raw, where, errs)
    d = raw.get("duration")
    if d is None:
        s.duration = default_duration(kind, s.words(), len(s.items))
    elif isinstance(d, bool) or not isinstance(d, (int, float)) or not 1.0 <= d <= MAX_SCENE_SECONDS:
        errs.append(f"{where}: 'duration' must be a number of seconds between 1 and {MAX_SCENE_SECONDS}")
    else:
        s.duration = float(d)
    return s


def _meta(m, errs) -> dict:
    if m is None:
        return {}
    ok = isinstance(m, dict) and set(m) <= {"titles", "description", "hashtags"}
    ok = ok and isinstance(m.get("titles", []), list) and isinstance(m.get("hashtags", []), list)
    ok = ok and isinstance(m.get("description", ""), str)
    if not ok:
        errs.append("meta: must be {'titles': [..], 'description': '..', 'hashtags': [..]}")
        return {}
    return m


def validate(data, base_dir: Path | str = ".") -> tuple[Storyboard | None, list, list]:
    """Returns (storyboard or None, errors, warnings)."""
    from .flow import flow
    from .lint import lint
    base, errs = Path(base_dir), []
    if not isinstance(data, dict):
        return None, ["storyboard must be a JSON object"], []
    for k in sorted(set(data) - TOP):
        errs.append(f"unknown top-level field '{k}'.{_hint(k, TOP)}")
    title = _str(data, "title", "storyboard", errs, True)
    raw = data.get("scenes")
    if not isinstance(raw, list) or not 1 <= len(raw) <= 30:
        errs.append("'scenes' must be a list of 1-30 scenes")
        raw = []
    fmt = data.get("format", "short")
    if fmt not in FORMAT_NAMES:
        errs.append(f"'format' must be one of {', '.join(FORMAT_NAMES)} (short = 1080x1920, wide = 1920x1080)")
        fmt = "short"
    default_accent = data.get("accent", DEFAULT_ACCENT)
    if parse_accent(default_accent) is None:
        errs.append("top-level 'accent' must be a color name or #RRGGBB")
        default_accent = DEFAULT_ACCENT
    scenes = [_scene(i, r, base, default_accent, errs, fmt) for i, r in enumerate(raw)]
    audio = data.get("audio")
    if audio is not None and not (isinstance(audio, str) and (base / audio).is_file() and inside(base / audio, base)):
        errs.append(f"'audio' must be an existing file inside the storyboard folder: {audio}")
        audio = None
    if errs:
        return None, errs, []
    t = 0.0
    for s in scenes:
        s.start, t = t, t + s.duration
    sb = Storyboard(title, scenes, (base / audio).resolve() if audio else None, _meta(data.get("meta"), errs), fmt)
    return (None, errs, []) if errs else (sb, [], lint(sb) + [f"flow: {n}" for n in flow(sb)])


def load(path: Path | str) -> tuple[Storyboard, list]:
    """Load and validate a storyboard file. Raises SpecError listing every problem."""
    p = Path(path)
    try:
        data = json.loads(p.read_text(encoding="utf-8"))
    except OSError as e:
        raise SpecError(f"cannot read {p}: {e}") from e
    except json.JSONDecodeError as e:
        raise SpecError(f"{p.name} is not valid JSON: {e}") from e
    sb, errs, warns = validate(data, p.parent)
    if errs:
        raise SpecError("\n".join(errs))
    return sb, warns
