"""Validation for scenes that show pictures (image, screen) and the narration field. No Pillow needed."""
from pathlib import Path

from .safety import inside

IMAGE_EXT = {".png", ".jpg", ".jpeg", ".webp"}
MAX_SAY = 600
MAX_URL = 90


def _fractions(v, n: int) -> tuple | None:
    if not isinstance(v, list) or len(v) != n:
        return None
    if not all(isinstance(x, (int, float)) and not isinstance(x, bool) and 0 <= x <= 1 for x in v):
        return None
    return tuple(float(x) for x in v)


def image_path(raw, base: Path, where: str, errs: list) -> Path | None:
    """The scene's picture: a file inside the storyboard folder with an image extension."""
    p = raw.get("image")
    if not isinstance(p, str) or not p:
        errs.append(f"{where}: 'image' must be a file path")
        return None
    path = (base / p).resolve()      # absolute paths are joined as-is by pathlib, so check containment
    if Path(p).is_absolute() or not inside(path, base):
        errs.append(f"{where}: image must be a path inside the storyboard folder (no absolute paths, no '..')")
    elif path.suffix.lower() not in IMAGE_EXT:
        errs.append(f"{where}: image must be one of {', '.join(sorted(IMAGE_EXT))}")
    elif not path.is_file():
        errs.append(f"{where}: image file not found: {path}")
    return path


def screen(s, raw, where: str, errs: list) -> None:
    """Fields of a 'screen' scene (a real screenshot in a browser frame): url, zoom, cursor, click."""
    url = raw.get("url", "")
    if not isinstance(url, str) or len(url) > MAX_URL:
        errs.append(f"{where}: 'url' must be text of at most {MAX_URL} characters")
    else:
        s.url = url.strip()
    if "zoom" in raw:
        z = _fractions(raw["zoom"], 4)
        if z is None or z[2] - z[0] < 0.05 or z[3] - z[1] < 0.05:
            errs.append(f"{where}: 'zoom' must be [x0, y0, x1, y1] fractions (0-1) of the image, x1 > x0 and y1 > y0")
        else:
            s.zoom = z
    if "cursor" in raw:
        c = _fractions(raw["cursor"], 2)
        if c is None:
            errs.append(f"{where}: 'cursor' must be [x, y] fractions (0-1) of the image")
        s.cursor = c
    if "click" in raw:
        k = raw["click"]
        if isinstance(k, bool) or not isinstance(k, (int, float)) or k < 0:
            errs.append(f"{where}: 'click' must be seconds (0 or more) into the scene")
        elif "cursor" not in raw:
            errs.append(f"{where}: 'click' needs a 'cursor' position")
        else:
            s.click = float(k)


def say(raw, where: str, errs: list) -> str:
    """Narration text for the voice step: spoken, never drawn."""
    v = raw.get("say")
    if v is None:
        return ""
    if not isinstance(v, str) or not v.strip() or len(v) > MAX_SAY:
        errs.append(f"{where}: 'say' must be non-empty text of at most {MAX_SAY} characters")
        return ""
    from .emotion import plain, problems
    errs.extend(f"{where}: 'say' {p}" for p in problems(v))
    return " ".join(plain(v).split())
