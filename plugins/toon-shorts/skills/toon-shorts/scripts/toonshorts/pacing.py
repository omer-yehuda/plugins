"""Pacing, cold open, character consistency and the new scene fields (cuts, sfx).

A shot is one unbroken camera move. A scene is one spoken line; `cuts` split it into more shots.
Fast story Shorts run about 25-30 shots a minute in the opening, so a 5 s line needs a cut or two."""
OPEN_SECONDS = 10.0
OPEN_SHOTS = 4            # at least 4 shots in the first 10 s (~24/min, aim for 27)
MIN_PER_MIN = 20          # whole video
MAX_SHOT = 4.0            # seconds; a longer shot gets a NOTE
HOOK_WORDS = 9
IDENTITY = ("skin", "hair", "hair_style", "facial_hair", "glasses", "outfit_color")


def est_spans(scenes: list[dict], wps: float = 2.6) -> list[tuple[float, float]]:
    out, t = [], 0.0
    for s in scenes:
        d = max(1.4, len(str(s.get("say", "")).split()) / wps) + 0.35
        out.append((t, t + d))
        t += d
    return out


def shots(scenes: list[dict], spans: list[tuple[float, float]]) -> list[tuple[float, float, int]]:
    """-> (start, end, scene index) for every shot"""
    out = []
    for i, (sc, (t0, t1)) in enumerate(zip(scenes, spans)):
        marks = sorted(float(c.get("at", 0)) for c in sc.get("cuts", []) if isinstance(c, dict))
        edges = [t0] + [t0 + min(max(m, 0.0), 1.0) * (t1 - t0) for m in marks] + [t1]
        out += [(a, b, i) for a, b in zip(edges, edges[1:]) if b - a > 0.05]
    return out


def report(scenes: list[dict], spans: list[tuple[float, float]]) -> list[str]:
    """pacing lines for real or estimated timing"""
    sh = shots(scenes, spans)
    if not sh:
        return []
    total = max(0.1, sh[-1][1])
    rate = len(sh) / total * 60
    opening = sum(1 for a, _, _ in sh if a < OPEN_SECONDS)
    lines = [f"{len(sh)} shots in {total:.0f}s = {rate:.0f}/min; {opening} in the first {OPEN_SECONDS:.0f}s"]
    if total > OPEN_SECONDS and opening < OPEN_SHOTS:
        lines.append(f"opening is slow: {opening} shots in the first {OPEN_SECONDS:.0f}s, aim for "
                     f"{OPEN_SHOTS}+ (add 'cuts' to the first scenes)")
    if rate < MIN_PER_MIN:
        lines.append(f"{rate:.0f} shots/min overall; aim for {MIN_PER_MIN}+ (add 'cuts' to long lines)")
    for a, b, i in sh:
        if b - a > MAX_SHOT:
            lines.append(f"scene {i}: one shot runs {b - a:.1f}s; add a cut (over {MAX_SHOT:.0f}s loses viewers)")
    return lines


def validate(sb: dict, cameras: list[str], kinds: list[str], errors: list[str]) -> None:
    for i, sc in enumerate(sb.get("scenes", [])):
        if not isinstance(sc, dict):
            continue
        for key in ("cuts", "sfx"):
            if key in sc and not (isinstance(sc[key], list) and all(isinstance(x, dict) for x in sc[key])):
                errors.append(f"scene {i}: '{key}' must be a list of objects")
        for c in sc.get("cuts", []) if isinstance(sc.get("cuts"), list) else []:
            if isinstance(c, dict):
                at = c.get("at")
                if not isinstance(at, (int, float)) or not 0.1 <= at <= 0.9:
                    errors.append(f"scene {i}: cut at={at!r} must be a number from 0.1 to 0.9")
                if c.get("camera", "push_in") not in cameras:
                    errors.append(f"scene {i}: cut camera='{c.get('camera')}' is not allowed. "
                                  f"Options: {', '.join(cameras)}")
        for s in sc.get("sfx", []) if isinstance(sc.get("sfx"), list) else []:
            if isinstance(s, dict) and s.get("type") not in kinds:
                errors.append(f"scene {i}: sfx type='{s.get('type')}' is not allowed. Options: {', '.join(kinds)}")


def notes(sb: dict) -> list[str]:
    scenes = sb["scenes"]
    out = [f"pacing (estimated): {line}" for line in report(scenes, est_spans(scenes))[1:]]
    first = scenes[0]
    if len(str(first.get("say", "")).split()) > HOOK_WORDS:
        out.append(f"scene 0: the hook has more than {HOOK_WORDS} words; the first line should land in ~3 s")
    late = [c.get("id") for c in first.get("cast", []) if c.get("enter", "none") != "none"]
    late += [p.get("type") for p in first.get("props", []) if float(p.get("at", 0)) > 0.1]
    if late:
        out.append(f"scene 0: {', '.join(map(str, late))} appear late; the first frame should already show the "
                   "result (enter 'none', prop at 0)")
    chars = sb.get("characters", {})
    for i, sc in enumerate(scenes):
        for c in sc.get("cast", []):
            base = chars.get(c.get("id"), {})
            moved = [k for k in IDENTITY if k in c and k in base and c[k] != base[k]]
            if moved and not c.get("costume"):
                out.append(f"scene {i} {c.get('id')}: changes {', '.join(moved)} from the character sheet; the "
                           "same person must look the same (add \"costume\": true if it is on purpose)")
    return out
