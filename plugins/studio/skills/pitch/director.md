# Director: camera positions and flow

Every Premiere film gets a camera plan: for each shot, where the camera stands (`size`, `angle`) and how it
moves (`move`), chosen so each shot leads into the next. The director writes these three fields for every
shot. The cinematographer turns `size` and `angle` into framing words in the prompt; the cut performs `move`.

`premiere.js shots <id>` prints the plan as a table and lists the flow notes:

```
#  id                    size    angle          move       secs
1  01-arrival            wide    eye            push-in    4.5
2  02-door               close   low            hold       3
```

Work from that table. Fix every flow note, then go through the two lists below.

## Camera positions (per shot)

| `size` | Shows | Use for |
|---|---|---|
| `wide` | the place, the figure small in it | the opening, a new place, loneliness, the ending |
| `medium` | the person from the waist up, some of the world | an action, two things in relation |
| `close` | the face | a feeling, a decision, the turn |
| `detail` | one object or a hand | the thing the story hinges on |

| `angle` | Camera is | Reads as |
|---|---|---|
| `eye` | level with the subject | neutral, the default |
| `low` | below, looking up | power, scale, threat |
| `high` | above, looking down | small, exposed, watched |
| `over-shoulder` | behind the subject | we see what they see |
| `top` | straight down | pattern, fate, a map of the scene |

- One subject and one reason per shot. If you cannot say why the camera is there, it is in the wrong place.
- Leave room for the move: a `pan` or `tilt` needs a subject off-centre with space to travel into; a
  `push-in` needs the subject near the middle. Leave the caption area clear (lower third on vertical).
- Moves are small (about 12% of the frame), so they suit `wide` and `medium`. On `close` and `detail` use
  `push-in`, `pull-out` or `hold`; a pan there slides the subject out of frame.

## Flow (shot to shot)

1. **Size tells the story:** wide (where), medium (who and what), close (what it means). Step one or two
   sizes at each cut. Three shots of the same size in a row flatten the film.
2. **No jump cuts.** Two shots in a row with the same size and the same angle on one subject look like a
   mistake. Change the size, the angle, or the subject.
3. **Moves carry over.** A `push-in` followed by a closer shot feels like one motion. A `pan-right` followed
   by `pan-left` swings back and cancels itself. The same move three times running is a pattern the viewer
   notices instead of the story.
4. **`hold` is the loudest move.** Use it once or twice, on the frame that must land, usually a `close`.
5. **Screen direction.** If the subject looks or travels left to right in one shot, keep that side in the
   next; say it in the one-line `prompt` ("facing right"). Reverse it only when the story turns back.
6. **Open and close.** The first shot is the most striking image at a size that reads at once, never a
   slow introduction. The last shot answers the first: often the same place at a different size, on a
   `pull-out` or a `hold`.
