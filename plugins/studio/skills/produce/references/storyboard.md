# Storyboard format

One JSON file. Frame is 1080x1920 (`"format": "short"`, the default) or 1920x1080 (`"format": "wide"`), at 30 fps. Validate with `studio.py check storyboard.json` (exit 1 lists every problem with its scene number).

```json
{
  "title": "What is a Claude skill?",
  "accent": "coral",
  "format": "short",
  "audio": "voice.wav",
  "meta": {"titles": ["..."], "description": "...", "hashtags": ["Claude", "AI"]},
  "scenes": [ { "type": "title", "text": "...", "duration": 3 } ]
}
```

Top level: `title` (required), `scenes` (1 to 30, aim for 8 to 12), `format` (`short` or `wide`), `accent` (default for scenes), `audio` (optional file inside the storyboard folder; the `voice` command sets it), `meta` (optional, feeds `metadata.md`).

## Fields every scene accepts

| Field | Values | Default |
|---|---|---|
| `type` | title, bullets, stat, compare, quote, image, cta | required |
| `duration` | seconds, 1 to 20 (the `voice` command sets it from the narration) | from word count |
| `say` | narration for this scene, up to 600 characters: spoken by `voice`, used for captions, never drawn. Wrap the word that carries a feeling in `{feeling|words}` (see "Emotion tags" below) | none |
| `theme` | `light` or `dark` | alternates light, dark, light... |
| `accent` | coral, blue, green, yellow, purple, orange, pink, teal, or `#RRGGBB` | top-level `accent`, else coral |
| `transition` | how this scene enters: cut, slide, fade, zoom-punch | first scene cut, others slide |

## Scene types

| Type | Fields | Look |
|---|---|---|
| `title` | `text` | Big words pop in one by one, last word in the accent color, underline grows |
| `bullets` | `items` (1-4), optional `text` heading | Numbered cards slide in one at a time |
| `stat` | `value` (number), `label`, optional `prefix`, `suffix` | Number counts up; a `%` suffix also fills a bar |
| `compare` | `left`, `right`: each `{"title", "items" (1-3)}` | Two cards (stacked in the vertical frame) with a VS badge |
| `quote` | `text`, optional `author` | Big quote mark, words reveal |
| `image` | `image` (png, jpg, webp; path relative to the storyboard, must stay inside its folder), optional `text` caption | Slow zoom in a rounded frame |
| `screen` | `image` (a real screenshot), optional `text` (caption chip), `url` (shown in the address bar), `zoom` `[x0, y0, x1, y1]` (fractions of the screenshot to end on), `cursor` `[x, y]`, `click` (seconds) | Browser window; the whole screenshot fits first, then the camera eases into `zoom`; a pointer glides in and clicks with a ripple |
| `link` | `text` (the address), optional `sub` | Link card; the address types itself out |
| `cta` | `text`, optional `sub` (button label) | End card with a pulsing button |

## Rules of thumb (the checker warns about these)

- At most 7 words on screen (bullets and compare: 12). Short beats win.
- Hook in the first 3 seconds: scene 0 is a `title`, `stat` or `quote`, 3 s or less.
- End with a `cta`. Short: 30 to 60 seconds. Wide: 2 to 4 minutes is typical (45 s to 8 min allowed).
- Real footage beats cards: in a wide video, aim for a third or more `screen` scenes made from real screenshots of the tool doing a real task.
- In the wide format the right and bottom margins are larger, so a channel watermark in the corner never covers content.
- Reading time: at least 0.9 s + 0.3 s per word per scene.
- Accent contrast of 3:1 on the scene theme (yellow only on dark).
- Alternate light and dark for rhythm. Never three scene types in a row the same.
- Keep it light: no code on screen. Text is left to right only (right-to-left is not supported in v1).

## Emotion tags (in `say`)

The voice reads every line with a little melody. For the words that carry a feeling, add a tag: `{feeling|words}`. Only those words change (pitch shape, length, loudness, a short beat before them). Captions show the words without the tag.

```json
"say": "{warn|Fair warning}: it is six times heavier to run."
"say": "And the {surprise|surprise}? It is completely {excite|free}."
```

| Feeling | Use it for | What the voice does |
|---|---|---|
| `warn` | a catch, a limit, "careful" | short beat, firm and a bit slower |
| `surprise` | a twist, a reveal | beat, pitch climbs to the end |
| `excite` | the payoff, "free", a big number | brighter and a bit louder |
| `wow` | a result that should land | beat, slower, rises and falls |
| `punch` | a short claim, "Same prompt." | quick firm hit |
| `ask` | the end question | rises like a real question |
| `calm` | reassurance, "Relax." | softer, falls |
| `sad` | the problem, the pain | slower, lower |

Rules: one to three tags per line, on one to three words each. A tag on every word sounds as flat as none. Unknown feelings fail `check`. `voice --flat` gives the old flat read; `--lively 1.0-1.5` sets the melody of every line (default 1.2).
