# Still checklist (Step 6)

Open `preview.png` and go through every tile with these 11 questions. Write down each tile that fails and
what you changed, then re-preview. Do not render until every tile passes or you have a reason it can't.

| # | Question | Typical fix |
|---|---|---|
| 1 | **Reads in one second?** Without the caption, can you tell what is happening? | Bigger mood, a prop that names the line, a closer camera |
| 2 | **Faces clear?** No face covered by a prop, the caption, the `front` overlay or another character. | Move `x` apart, lower the prop `y`, change `front` |
| 3 | **Nobody cut off?** Every character and prop is fully inside the frame. | Keep `x` 0.2-0.8, `scale` ≤ 1.15 |
| 4 | **Matches the line?** The picture shows what the words say, in the right place and era. | Change set, outfit, prop |
| 5 | **Same people?** Each character looks the same as in every other tile (skin, hair, outfit colour). | Remove the per-scene override, or mark it `"costume": true` if it's on purpose |
| 6 | **Tell people apart?** Two characters in one shot never share an outfit colour or silhouette. | Different `outfit_color`, hat or hair |
| 7 | **Neighbours differ?** Each tile changes something from the one before (place, mood, pose or camera). | New camera or mood; a cut |
| 8 | **First tile is the payoff?** Tile 0 already shows the result or the strange thing, not a lead-in. | Props `at: 0`, `enter: none`, `punch_in` |
| 9 | **Caption clear?** Nothing important sits behind the caption band (lower third). | Raise the prop (`y` 0.2-0.45) |
| 10 | **Mood matches the beat?** Shocked on the turn, angry when cheated, happy on the win. | Change `mood` |
| 11 | **Loop lands?** The last tile goes back to the first tile's place so the replay feels seamless. | `same_set_as: 0` with a new camera |

Then read the `PACE:` lines that `preview` printed. Fix any "opening is slow" or "one shot runs" line with
`cuts` before rendering.
