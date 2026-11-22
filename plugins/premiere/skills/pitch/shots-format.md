# Shot list format (`shots.json`)

```json
{
  "title": "The Lighthouse Keeper",
  "look": { "grade": "teal-amber", "grain": 0.4, "letterbox": true },
  "voice": "voice.wav",
  "shots": [
    {
      "id": "01-arrival",
      "still": "stills/01-arrival.png",
      "seconds": 4.5,
      "move": "push-in",
      "line": "Every night, one light stays on.",
      "prompt": "Photorealistic cinematic film still, <character block>, walking up a wet stone path toward a lighthouse, <world block>, blue hour, soft haze, rim light, shallow depth of field, wide establishing shot"
    }
  ]
}
```

- **shots**: 3 to 12, and the film is at most 120 seconds. Five to eight shots is the right size.
- **id**: lowercase letters, digits and dashes, unique. Start with a two-digit number so files sort in order.
- **still**: exactly `stills/<id>.png` (or `.jpg`, `.webp`). The file does not exist yet; it is where the generated image will be saved.
- **seconds**: 1.5 to 12. Fit it to the spoken line: about 2.5 words per second, plus half a second of air.
- **move**: `push-in`, `pull-out`, `pan-left`, `pan-right`, `tilt-up`, `tilt-down` or `hold`. Moves are slow and small (about 12% of the frame). Alternate them; never repeat the same move three times in a row.
- **line**: optional, at most 200 characters. It becomes a caption in `captions.srt` and the cue for the voice.
- **prompt**: 20 to 1200 characters. What the image model receives for this shot.
- **look.grade**: `teal-amber` (default), `warm`, `cold`, `mono` or `none`. One grade for the whole film.
- **look.grain**: 0 to 1 (default 0.4). **look.letterbox**: cinema bars on wide films (default true; ignored on vertical).
- **voice**: optional audio file placed in the production folder (`.wav`, `.mp3`, `.m4a`). The score ducks under it. Leave it out for a score-only film.

## Writing prompts that hold together

- Write one **character block** (25 to 40 words: age band, always an adult; hair; one signature accessory; outfit with material and colour; body language) and one **world block** (place, era, weather, palette). Reuse both word for word in every prompt. This is the main tool for keeping the same face and place between shots.
- Formula: `Photorealistic cinematic film still, <character block>, <pose and action>, <world block>, <time of day and light>, <lens and framing>`.
- Framing words: wide establishing shot, medium shot, medium close-up, over the shoulder, low angle. Leave clear space where captions sit (lower third on vertical).
- Words are taken literally. Do not name an accessory after an animal or object you do not want to see.
- Never ask for drawn words, logos, signs with text, or code. Text is added in the edit, where it is correct.
- Original, fictional, adult characters only. No real people, no characters from any film, game or show, no studio or franchise names. Describe a look; do not name one.
- Small actions hold up best: a turn of the head, a hand on a rail, walking away from camera.
