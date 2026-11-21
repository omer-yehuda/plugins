# Storyboard format

## The look

- **Characters:** chibi toons with a big round head, rounded body, outlined tube limbs and a choice of six skin
  tones. Hair, hats and a strong outfit colour make each person recognisable from far away.
- **Sets:** flat, bright, layered scenery (sky, distance, ground) that moves at different speeds when the
  camera moves, so every shot has depth. Time of day re-lights the whole set; night turns on windows and lamps.
- **Mood effects:** `angry`/`furious` get steam puffs (furious also turns red), `scared` a sweat drop, `shocked`
  shock lines, `crying` tears, happy moods rosy cheeks.
- **Captions:** 1-3 words at a time, white with a thick outline; the word being spoken lights up yellow.
  Hebrew is laid out right-to-left automatically.
- **Frame:** 1080x1920, 30 fps. The camera automatically keeps every character and prop inside the frame.

## JSON

```json
{
  "title": "Short title",
  "lang": "en",
  "captions": true,
  "highlight": true,
  "characters": {
    "hero": {"skin": "medium", "hair": "#2a1d16", "hair_style": "slick", "hat": "top_hat", "hat_color": "#222",
             "outfit": "suit", "outfit_color": "#22263a", "accent": "#b8322f", "pants": "#30344a",
             "facial_hair": "mustache", "glasses": false}
  },
  "scenes": [
    {
      "say": "Exact words spoken in this scene.",
      "voice": "optional phonetic spelling for the AI voice",
      "set": {"place": "city", "time": "day", "landmark": "lattice_tower", "front": "none"},
      "same_set_as": 0,
      "cast": [{"id": "hero", "x": 0.35, "scale": 1.0, "facing": "right", "mood": "sly", "pose": "point",
                "holding": "none", "label": "", "talking": false, "enter": "none"}],
      "props": [{"type": "money", "x": 0.75, "y": 0.3, "size": 240, "anim": "float", "at": 0.3,
                 "label": "", "behind": false}],
      "camera": "push_in",
      "focus": 0.35,
      "cuts": [{"at": 0.5, "camera": "punch_in", "focus": 0.7}],
      "sfx": [{"type": "ding", "at": 0.6}]
    }
  ]
}
```

## Fields

| Field | Meaning |
|---|---|
| `say` | **Required.** The words of the scene, exactly as spoken. Captions and timing come from it. |
| `lang` | `en` (default), `he` (Hebrew: RTL captions), `es`, `fr`, `it`, `pt`, `hi`. |
| `highlight` | `false` turns off the yellow active-word highlight. |
| `set.place` | outdoor: `city` `suburb` `farm` `mountains` `forest` `desert` `beach` `sea` (ship on the horizon) `deck` (on a ship) `moon` `sky` (above the clouds) · indoor: `room` `office` `palace` `court` `prison` `lab` `bank` `shop` `classroom` |
| `set.time` | `day` `sunset` `night` `dawn` `storm` |
| `set.landmark` | outdoor only: `none` `lattice_tower` `pyramid` `castle` `lighthouse` `clock_tower` `volcano`; `landmark_x` (0-1) moves it |
| `set.front` | drawn over the cast: `none` `bars` (behind bars) `desk` (seated at a desk) `crowd` (audience from behind) `bushes` (hiding) |
| `same_set_as` | index of an EARLIER scene: reuse exactly that set (continuity). Omit for a fresh variation. |
| `cast[].x` | 0 = left edge, 1 = right edge. Keep 0.2-0.8 and about 0.25 apart. |
| `cast[].scale` | 1.0 normal; 0.8-0.9 further back; up to 1.15 close-up. |
| `cast[].facing` | `right` or `left`. Make people in a conversation face each other. |
| `cast[].mood` | `neutral` `happy` `laughing` `proud` `sad` `crying` `shocked` `scared` `angry` `furious` `sly` `thinking` |
| `cast[].pose` | `stand` `point` `arms_up` `think` `hands_hips` `wave` `hold` `shrug` `walk` `run` `facepalm` |
| `cast[].holding` | a prop name (below) in the hand; use with `pose: hold` or `point`. `label` writes on a newspaper/document/sign/phone. |
| `cast[].talking` | `true` animates the mouth while words play. Only for the character actually speaking the line. |
| `cast[].enter` | `none` `pop` `slide_left` `slide_right` |
| any character key | can be overridden per scene (e.g. a different `outfit` or `hat`). |
| `props[].type` | `money` `bag` `letter` `document` `newspaper` `gold` `crown` `clock` `lightbulb` `question` `exclamation` `handcuffs` `ship` `car` `coin` `key` `chest` `sign` `book` `torch` `map` `diamond` `phone` `rocket` `heart` `star` `plane` `trophy` |
| `props[].x`, `y` | screen position 0-1. Keep `y` 0.2-0.45 so props float beside or above heads, clear of the captions. |
| `props[].size` | pixels, 160-340 |
| `props[].anim` | `pop` `float` `spin` `pulse` `none` (each appearance plays a soft pop sound unless `none`) |
| `props[].at` | when it appears, as a fraction of the scene (0-1). Time it to the word that names it. |
| `props[].behind` | `true` draws it behind the characters |
| `camera` | `push_in` `pull_out` `pan_left` `pan_right` `tilt_up` `drift` (sideways, shows depth) `punch_in` (hook/shock) `shake` (chaos) `static` |
| `focus` | the x (0-1) the camera moves toward; defaults to the first cast member |
| `cuts` | splits one line into more shots: `[{"at": 0.5, "camera": "punch_in", "focus": 0.7}]`. `at` 0.1-0.9 of the scene; each cut switches to its own camera move (and optional focus) on the same set. |
| `sfx` | extra sounds: `[{"type": "ding", "at": 0.6}]`. Types: `pop` `whoosh` `sting` `thud` `ding` `tap`. |
| `cast[].costume` | `true` allows a deliberate change of skin, hair, outfit colour or glasses in that scene (otherwise `check` flags it). |

**Character keys:** `skin`: `porcelain` `light` `medium` `tan` `brown` `deep` (or hex) · `hair` (hex) ·
`hair_style`: `short` `slick` `curly` `long` `bun` `spiky` `ponytail` `bald` · `hat`: `none` `top_hat` `bowler`
`cap` `crown` `police` `beret` `helmet` `chef` `cowboy` `military` `headscarf` · `hat_color` · `outfit`: `shirt`
`suit` `coat` `dress` `uniform` `robe` `hoodie` · `outfit_color` · `accent` (tie, belt, trim) · `pants` ·
`facial_hair`: `none` `mustache` `beard` `goatee` · `glasses`: true/false. Colours accept hex or names
(red, navy, teal, gold, ...).

## Pacing

- A **shot** is one camera move. Scene = one spoken line; `cuts` add shots inside it.
- First 10 seconds: 4 or more shots (fast story Shorts run about 27 a minute in the opening).
- Whole video: 20+ shots a minute. No single shot over about 4 seconds.
- Good cuts: wide → close-up on the face as the key word lands (`punch_in` with `focus` on that character),
  close-up → `drift` to reveal the other person, or `push_in` onto a prop the line names.
- `check` estimates pacing from word counts; `preview` and `render` print the real numbers (`PACE:` lines).

## Sound

Every action gets one short sound on the frame it happens, automatically: `enter: pop` → pop,
`enter: slide_*` → whoosh, a character turning `shocked`/`scared` → sting, `angry`/`furious` → thud,
`walk`/`run` → soft steps, and every prop appearance → pop (unless `anim: none`). Add more with `sfx`.
All sounds are synthesized with faded edges, so pauses stay silent and there are no clicks. `--no-sfx` turns
them all off.

## Visual rules

1. **Show the line.** "forged letters" → someone holds a document and a letter pops in; "fled to the mountains" → mountains.
2. **Faces carry the story.** Shocked on the turn, furious when cheated, laughing on the win, sly on the con.
3. **Change something every scene:** place, mood, pose or camera. `same_set_as` for continuity, but move the camera.
4. **Establishing shots are fine:** a scene with no cast, just a set and a prop, for "the city", "the ocean".
5. **Hook scene (cold open):** `punch_in`, the main character reacting big, a set that says where, and the
   payoff already on screen in the first frame (props `at: 0`, no `enter`). 9 words or fewer.
6. **Last scene** returns to the first scene's place so the loop feels seamless.
7. 1-4 characters per scene, never two in the same outfit colour. Use `front: crowd` for "everyone".
8. Dress characters for the era and place; vary skin tones naturally for the setting.
9. **One look per person.** Define each character once in `characters` and don't change skin, hair, outfit
   colour or glasses per scene unless the story needs it (`"costume": true`).
