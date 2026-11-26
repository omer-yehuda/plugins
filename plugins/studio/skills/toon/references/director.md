# Director: camera positions and flow

The director pass runs on every short, after the storyboard passes `check` and before the preview. It
changes only where the camera is and how one shot leads into the next: `camera`, `focus`, `cuts`, `cast[].x`,
`cast[].facing`, `cast[].scale` and `same_set_as`. It never changes `say`, the story, the characters' looks
or the sets' places.

Run `toon.py shots storyboard.json`. It prints one line per shot and the `FLOW:` notes:

```
scene shot  camera     size   focus  looks at     set
    0    0  punch_in   close   0.42  onoda        0
    0    1  drift      wide    0.42  onoda        0
```

Work from that table, not from the JSON. Fix every `FLOW:` note, then go through the two lists below.

## Camera positions (one decision per shot)

| The beat | Size | Camera | Focus |
|---|---|---|---|
| Where are we, who is here | wide | `pull_out`, `drift`, `pan_*`, `static` | the middle, or the landmark |
| Someone says or does something | medium | `push_in` | that character's `x` |
| The key word, the turn, a face reacting | close | `punch_in` | the face that reacts |
| A prop the line names | medium | `push_in` | the prop's `x` |
| Chaos, a crash, a chase | medium | `shake` | the centre of it |
| Something tall, a reveal upward | wide | `tilt_up` | under it |

- Every aimed camera (`push_in`, `pull_out`, `punch_in`) needs a subject at its `focus`. A camera that
  travels to empty ground is the most common mistake; the `looks at` column shows `nothing` when it happens.
- Size follows meaning: go close only when a face or an object matters. Three close shots in a row and the
  viewer no longer knows where they are; go wide once.
- A character further back (`scale` 0.8 to 0.9) is background. The one the shot is about stays at 1.0 or more.
- Two people talking: 0.3 and 0.7, facing each other. A single character: 0.35 to 0.65, facing into the
  empty side of the frame, never out of it.

## Flow (what joins one shot to the next)

1. **Every cut has a reason:** a new word that matters, a reaction, a reveal. A cut that keeps the same
   camera and focus changes nothing; give it a new size or a new subject.
2. **Wide, then close.** Open a new place wide, then go in. Inside one line: wide → `punch_in` on the face
   as the key word lands, or close → `drift` to reveal the other person.
3. **Keep sides.** On the same set (`same_set_as`), a character who stood on the left stays on the left.
   If two characters swap sides, the viewer reads it as two new people. To change sides, change the set.
4. **Keep direction.** A character who walks or runs right is followed right (`pan_right`, `drift`). A
   journey keeps one direction across scenes; going home reverses it.
5. **Do not swing back.** `pan_left` straight after `pan_right` on the same set looks like a mistake. Put a
   `static` or an aimed shot between them.
6. **Reaction shots are a choice.** While one character talks, a cut to the listener's face is good. One
   uncut shot that ignores the speaker is not.
7. **The loop.** The last shot returns to the first scene's set and ends wide (`pull_out` or `static`), so
   the replay cuts cleanly into the opening `punch_in`.

When the table and both lists are clean, run `toon.py check` once more (positions changed) and go on to the
preview. Report the pass in one line: how many shots, how many were changed, and anything left on purpose.
