# Director: camera positions and flow

The director pass runs on every Studio video, after `storyboard.json` passes `check` and before the preview.
It changes only how each scene enters and where the camera goes: `transition`, the scene order inside one beat,
and on `screen` scenes `zoom`, `cursor` and `click`. It never changes the words, the facts or the durations
that a voice step has set.

Run `studio.py shots storyboard.json`. It prints one line per scene and the `FLOW:` notes:

```
scene  type     enters      secs  camera
    0  title    cut          3.0  -
    4  screen   slide        6.0  page -> zoom at 0.40,0.45 (20% of it), pointer 0.5,0.5 clicks at 1s
```

Work from that table, not from the JSON. Fix every `FLOW:` note, then go through the two lists below.

## Camera positions

Studio's camera is the frame itself on text scenes and a moving crop on `screen` and `image` scenes.

- **`screen`: start wide, end on the proof.** The whole page shows first so the viewer knows where they are,
  then the camera eases into `zoom`. Put the box on the one thing the line talks about: a result, a number, a
  button. A box that covers most of the page is no move at all; aim for 10% to 40% of the screenshot.
- **The pointer lives inside the box.** `cursor` is where the eye should end, so it sits inside `zoom`, on
  the control or the result. `click` lands on the word that names the action, and before the scene ends.
- **One page, several looks.** To show two parts of the same screenshot, use two `screen` scenes on the same
  image with different `zoom` boxes and enter the second with `cut`: the camera moves across the page.
- **Reading order.** Across consecutive `screen` scenes move the box the way the page is read: top to
  bottom, left to right. Jumping back up needs a reason (the result changed what we look at).
- **`image`** has a slow zoom built in; use it for a picture that needs no pointing.

## Flow (how one scene leads into the next)

| Entering with | Means | Use for |
|---|---|---|
| `cut` | same thought, next beat | rapid beats, the same screenshot again, a punchline |
| `slide` | a new idea | the default step forward |
| `fade` | a breath | a soft moment, a change of mood, the limit or the caveat |
| `zoom-punch` | look at this | the hook and the one big reveal, never more than a couple |

1. **The transition says how two scenes relate.** Choose it from the table above, not for variety alone.
   Four of the same in a row hides the structure: break the run where the idea really changes.
2. **Cards set up, footage proves.** Lead into a `screen` scene with the claim (a `title` or `stat`), then
   show it happening. Do not stack three cards before the first real picture in a wide video.
3. **One reveal.** Find the scene the video exists for and give it the `zoom-punch`. If two scenes both
   have it apart from the hook, one of them is not the reveal.
4. **Light and dark follow the story.** A theme change marks a new section better inside a run of `cut`s
   than a transition does.
5. **The end holds still.** Enter the `cta` with `slide` or `fade`, not `zoom-punch`: the viewer should
   read it, not flinch.

When the table and both lists are clean, run `studio.py check` once more and go on. Report the pass in one
line: scenes in total, what changed, and anything left on purpose.
