# project.json format

The helper creates the file; the crew fills it in. Keep every key below and add nothing else.

```json
{
  "title": "The Cube Village",
  "style": "minecraft",
  "platform": "shorts",
  "logline": "One sentence: who wants what, and what stands in the way.",
  "character": "The main character in this style, the same words reused for every shot (style-artist).",
  "world": "The place, light and time of day, the same words reused for every shot (style-artist).",
  "shots": [
    {
      "id": "01-dawn",
      "seconds": 3,
      "move": "push-in",
      "prompt": "What is in frame, in this style's vocabulary. Content only: no style words, no aspect ratio.",
      "motion": "What moves during the shot, for video models (optional).",
      "line": "A caption or spoken line, at most about 12 words (optional).",
      "cast": false,
      "transition": "cut"
    }
  ],
  "voice": "voice.mp3",
  "music": "music.mp3"
}
```

Rules the helper checks (`V check`):

- `style`: a built-in or custom style id, or two joined with `+` (`minecraft+anime`).
- `platform`: `shorts` (1080x1920), `youtube` (1920x1080), `square` (1080x1080), `feed` (1080x1350).
- 2 to 16 shots, 1 to 12 seconds each, at most 180 seconds in total. Prefer the style's `shotSeconds` range.
- `id`: lowercase letters, digits and dashes, unique. Start with the shot number: `01-...`, `02-...`.
- `move`: `push-in`, `pull-out`, `pan-left`, `pan-right`, `tilt-up`, `tilt-down`, `orbit`, `shake`, `hold`. Prefer the style's `moves`.
- `prompt`: 10 to 800 characters. `line` and `motion`: up to 300 characters.
- `cast`: set `false` on shots without the main character (landscapes, objects), so the character block is left out of that prompt. Default is true.
- `transition` (optional, the cut INTO this shot): `cut`, `fade`, `fadeblack`, `fadewhite`, `dissolve`, `pixelize`, `wipeleft`, `wiperight`, `slideleft`, `slideright`, `smoothleft`, `smoothright`, `circleopen`, `circleclose`, `hblur`, `radial`, `zoomin`. Leave it out to use the style's transition.
- `voice`, `music` (optional): a file name in the project folder ending in `.wav`, `.mp3` or `.m4a`. Leave them out until the file exists.

How the final prompt is built (by code, word for word, so every shot shares one look):

`<style look>. <character, unless cast is false>. <shot prompt>. <world>. <style finish>. Aspect ratio <platform>.`

Media goes in `media/<shot id>.<ext>`: a still (`png`, `jpg`, `jpeg`, `webp`) gets the camera move; a clip (`mp4`, `mov`, `webm`) plays as it is and is held on its last frame if it is short.
