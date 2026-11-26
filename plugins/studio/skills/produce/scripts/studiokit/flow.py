"""The director's view: one line per scene (how it enters, where the camera goes) and flow notes about
camera positions and how each scene leads into the next. No Pillow needed."""
RUN = 4                    # the same transition this many times in a row reads as monotone
BARELY = 0.8               # a zoom box covering more than this share of the screenshot barely moves


def _area(z: tuple) -> float:
    return (z[2] - z[0]) * (z[3] - z[1])


def camera(s) -> str:
    """what the camera does in one scene, in a few words"""
    if s.type == "image":
        return "slow zoom on the picture"
    if s.type != "screen":
        return "-"
    if not s.zoom:
        return "whole page, no move" + (", pointer" if s.cursor else "")
    cx, cy = (s.zoom[0] + s.zoom[2]) / 2, (s.zoom[1] + s.zoom[3]) / 2
    out = f"page -> zoom at {cx:.2f},{cy:.2f} ({_area(s.zoom):.0%} of it)"
    if s.cursor:
        out += f", pointer {s.cursor[0]:g},{s.cursor[1]:g}" + (f" clicks at {s.click:g}s" if s.click is not None else "")
    return out


def _screen_notes(s) -> list[str]:
    where, out = f"scene {s.index} (screen)", []
    if not s.zoom:
        out.append(f"{where}: no 'zoom', so the camera never moves in; add a zoom box on the part that matters")
    elif _area(s.zoom) > BARELY:
        out.append(f"{where}: the zoom box covers {_area(s.zoom):.0%} of the screenshot, so the camera barely "
                   "moves; tighten it on the part that matters")
    if s.zoom and s.cursor and not (s.zoom[0] <= s.cursor[0] <= s.zoom[2] and s.zoom[1] <= s.cursor[1] <= s.zoom[3]):
        out.append(f"{where}: the pointer rests outside the zoom box, so the camera ends on one place and the "
                   "click happens in another; move 'cursor' inside 'zoom' or widen the box")
    if s.click is not None and s.click >= s.duration:
        out.append(f"{where}: 'click' at {s.click:g}s is after the scene ends ({s.duration:g}s); nobody sees it")
    return out


def flow(sb) -> list[str]:
    """notes on camera positions and on how each scene leads into the next"""
    scenes, out = sb.scenes, []
    for s in scenes:
        if s.type == "screen":
            out += _screen_notes(s)
    for a, b in zip(scenes, scenes[1:]):
        if a.type == b.type == "screen" and a.image == b.image and b.transition != "cut":
            out.append(f"scenes {a.index}-{b.index}: the same screenshot twice; enter scene {b.index} with "
                       f"'cut' (not '{b.transition}') so the camera moves across the page instead of the page "
                       "leaving and coming back")
    punches = [s.index for s in scenes if s.transition == "zoom-punch"]
    most = max(2, len(scenes) // 5)
    if len(punches) > most:
        out.append(f"'zoom-punch' enters {len(punches)} scenes ({', '.join(map(str, punches))}); keep it for the "
                   f"hook and the big reveal ({most} at most here) or it stops landing")
    later, i = scenes[1:], 0
    while i < len(later):
        j = i
        while j + 1 < len(later) and later[j + 1].transition == later[i].transition:
            j += 1
        if j - i + 1 >= RUN:
            out.append(f"scenes {later[i].index}-{later[j].index}: '{later[i].transition}' {j - i + 1} times in a "
                       "row; break the run with another transition where the idea changes")
        i = j + 1
    return out


def table(sb) -> list[str]:
    """the scene list as text lines, one per scene"""
    rows = [f"{'scene':>5}  {'type':<8} {'enters':<10} {'secs':>5}  camera"]
    for s in sb.scenes:
        rows.append(f"{s.index:>5}  {s.type:<8} {s.transition:<10} {s.duration:>5.1f}  {camera(s)}")
    return rows



def report(sb) -> str:
    """the `shots` command: the scene list, then the flow notes"""
    notes = flow(sb)
    return "\n".join(table(sb) + [f"FLOW: {n}" for n in notes] + [f"{len(notes)} flow note(s)" if notes else "flow OK"])
