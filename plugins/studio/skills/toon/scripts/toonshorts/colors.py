"""Colour parsing, easing curves and deterministic seeds."""
import hashlib

Color = tuple[int, int, int]

INK: Color = (22, 20, 28)
WHITE: Color = (255, 255, 255)
ACCENT: Color = (255, 196, 0)

NAMED: dict[str, Color] = {
    "black": (24, 24, 28), "white": (250, 250, 250), "red": (214, 58, 58), "blue": (52, 104, 214),
    "navy": (30, 40, 82), "green": (64, 158, 92), "darkgreen": (34, 92, 58), "brown": (118, 76, 44),
    "tan": (206, 168, 118), "grey": (132, 134, 142), "gray": (132, 134, 142), "gold": (240, 190, 52),
    "yellow": (250, 210, 64), "orange": (240, 138, 54), "purple": (124, 72, 170), "pink": (240, 146, 178),
    "maroon": (118, 34, 46), "beige": (228, 208, 172), "cream": (246, 236, 212), "teal": (32, 142, 142),
    "olive": (116, 122, 54), "blonde": (232, 196, 110), "ginger": (196, 96, 42),
}

# skin tones, light -> deep
SKIN: dict[str, Color] = {
    "porcelain": (255, 232, 214), "light": (247, 214, 186), "medium": (226, 178, 138),
    "tan": (198, 142, 100), "brown": (150, 100, 66), "deep": (104, 68, 46),
}


def parse(v, default: Color = (200, 200, 200)) -> Color:
    """'#rgb', '#rrggbb', [r,g,b], a NAMED colour or a SKIN name -> (r, g, b)."""
    if v is None:
        return default
    if isinstance(v, (list, tuple)) and len(v) >= 3:
        try:
            return tuple(max(0, min(255, int(x))) for x in v[:3])  # type: ignore[return-value]
        except (TypeError, ValueError):
            return default
    s = str(v).strip().lower()
    if s.startswith("#") and len(s) in (4, 7):
        if len(s) == 4:
            s = "#" + "".join(ch * 2 for ch in s[1:])
        try:
            return tuple(int(s[i:i + 2], 16) for i in (1, 3, 5))  # type: ignore[return-value]
        except ValueError:
            return default
    return NAMED.get(s) or SKIN.get(s) or default


def shade(c: Color, k: float) -> Color:
    return tuple(max(0, min(255, int(x * k))) for x in c)  # type: ignore[return-value]


def mix(a: Color, b: Color, t: float) -> Color:
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))  # type: ignore[return-value]


def clamp01(p: float) -> float:
    return max(0.0, min(1.0, p))


def ease_in_out(p: float) -> float:
    p = clamp01(p)
    return p * p * (3 - 2 * p)


def ease_out(p: float) -> float:
    return 1 - (1 - clamp01(p)) ** 3


def overshoot(p: float, k: float = 1.7) -> float:
    """ease-out-back: overshoots then settles at 1."""
    p = clamp01(p) - 1
    return 1 + (k + 1) * p ** 3 + k * p ** 2


def seed(*parts) -> int:
    """Stable 32-bit seed from any values (same storyboard -> same video)."""
    return int(hashlib.sha256("|".join(map(str, parts)).encode()).hexdigest()[:8], 16)
