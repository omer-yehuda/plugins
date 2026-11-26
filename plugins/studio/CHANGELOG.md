# Changelog

## 2.1.0 (2026-11-26)

**Director pass** (camera positions and shot-to-shot flow) in every format, run inside every production and available on its own as `/studio:director [storyboard | film id]`. One skill for all three formats; it picks the format from what you give it. The agents work from a printed shot table instead of re-reading the JSON (fewer tokens).

- **Explainer:** `studio.py shots <storyboard>` prints one line per scene and `FLOW:` notes (also shown by `check` as `flow:` warnings): a `screen` scene with no `zoom`; a zoom box over 80% of the screenshot; a pointer outside the zoom box; a `click` after the scene ends; the same screenshot twice running without a `cut`; too many `zoom-punch` entries; one transition four or more times in a row. Runs in `/studio:produce` and on both cuts of `/studio:trend`. Craft sheet: `skills/produce/references/director.md`.
- **Toon:** `toon.py shots <storyboard>` prints camera, size, focus and set per shot with `FLOW:` notes: an aimed camera with nothing at its focus; an uncut shot that leaves the speaker; characters swapping sides on one set; a pan reversing the one before; a sideways camera against a walking character; a cut repeating camera and focus; three close shots in a row. Runs between the storyboard and the preview. Craft sheet: `skills/toon/references/director.md`.
- **Film:** two optional shot fields, `size` (`wide`, `medium`, `close`, `detail`) and `angle` (`eye`, `low`, `high`, `over-shoulder`, `top`), set by the film director and turned into framing words by the cinematographer. `premiere.js shots <id>` prints the camera plan and flow notes (also returned by `check`). Runs inside every `/studio:pitch`. Craft sheet: `skills/pitch/director.md`. Shot lists without the new fields still validate and render.
- Tests: new suites for the explainer flow notes, the toon shot list and the film fields. The bundled examples pass with no flow notes.

(Ported from a cloud session's work for studio 1.3.0, toon-shorts 1.2.0 and premiere 1.1.0, written before those three became one plugin.)

## 2.0.0 (2026-11-23)

- **Three formats in one plugin.** The toon-shorts plugin is now `/studio:toon` (cartoon shorts, Hebrew RTL), and Premiere is now `/studio:pitch`, `/studio:shoot`, `/studio:cut` and `/studio:dailies` (realistic films). Their engines moved in unchanged: `skills/toon/scripts/toonshorts/` and `scripts/premiere.js`. Docs: [docs/toon.md](docs/toon.md), [docs/film.md](docs/film.md).
- **One venv, one voice model.** Every format uses `~/.cache/studio-plugin` (override with `STUDIO_HOME`; `TOON_SHORTS_HOME` still works). The Kokoro model is downloaded once.
- **Hash-locked for every format.** `requirements.txt` now pins Pillow 13.0.0, NumPy 2.5.4 and imageio-ffmpeg 0.8.1 with SHA-256 hashes, and the toon setup now installs with `--require-hashes --only-binary=:all:` too (toon-shorts used plain version pins).
- Premiere's `director` agent is now `film-director` (Studio already had a `director`); `cinematographer` and `continuity` keep their names. Productions still live in `.premiere/`.
- The explainer, the crew screen and the showrunner point story topics to `/studio:toon` or `/studio:pitch`.
- OpenCode: `opencode/commands/studio-toon.md`.
- Breaking: install `studio` instead of `toon-shorts` or `premiere`. Both old plugins remain for one release as stubs that point here.

## 1.2.0 (2026-11-22)

- Emotion in the AI narration. Tag a word in `say` with `{feeling|words}` (warn, surprise, excite, wow, punch, ask, calm, sad) and only that word changes: pitch shape, length, loudness and a short beat before it. Every line also gets a little more melody (`voice --lively`, default 1.2; `--flat` for the old read). Same Kokoro voice: Studio makes a local copy of the verified model with three multiply inputs (sound length, pitch, energy); with them at 1.0 the audio is identical to the original. Needs the new pinned `onnx` package, which `setup --voice` installs; without it Studio says so and speaks without emotion.
- `check` fails on unknown feelings or broken tags; captions and `voice.lines.json` never show tags.
- The director and the trend desk tag the words that carry a feeling (one to three per line).

## 1.1.1 (2026-11-21)

- OpenCode support: `opencode/commands/studio-produce.md` and `studio-trend.md` run Studio in OpenCode on a free model. The commands map the plugin path, play the crew roles in turn from `agents/`, and make `/studio-trend` ask for real screenshots when there is no browser tool (README, "Run it free with OpenCode"). No engine changes.

## 1.1.0 (2026-11-20)

- Wide format: `"format": "wide"` renders 1920x1080 with its own safe area (bottom-right kept clear for a channel watermark). Compare cards sit side by side in wide; contact sheets, captions and metadata follow the format (`#Shorts` only on Shorts).
- `screen` scene: a real screenshot in a browser window; the whole picture fits first, then the camera eases into a `zoom` box, with an optional pointer that glides in and clicks (`cursor`, `click`) and a caption chip.
- `link` scene: a link card where the address types itself out.
- AI narration: `setup --voice` (consent first; pinned kokoro-onnx plus the SHA-256 verified Kokoro-82M model) and `voice storyboard.json`, which voices each scene's new `say` field, sets the durations, caches lines and attaches a mastered `voice.wav` (declick, 12 kHz low-pass, two-pass -14 LUFS in linear mode so pauses stay silent).
- `audiocheck`: fails on pauses louder than -35 dBFS or more than 3 clicks a minute.
- Captions follow the narration when a scene has `say`; cues are timed by word count.
- `/studio:trend`: research a trending tool, film a real task in the browser, one script, a wide video and a Short.
- Scene duration limit raised from 12 to 20 seconds (narrated wide scenes); the checker warns above 12 s on Shorts.

## 1.0.0 (2026-11-19)

First release.

- `/studio:produce <topic>`: a crew of agents (writer, director, screener) plus a local renderer turns a topic into a 1080x1920, 30 fps H.264 explainer video with `captions.srt` and `metadata.md`.
- Seven scene types: title, bullets, stat, compare, quote, image (slow zoom), cta. Light and dark themes, eight accent colors, four transitions (cut, slide, fade, zoom-punch).
- Storyboard checker with scene-numbered errors and retention warnings (hook, words per screen, reading time, contrast, length).
- Contact-sheet preview with a safe-area outline for Shorts UI, reviewed by the screener before the final render.
- Optional user audio (`--audio`, `--fit-audio`). Captions-only by default.
- `/studio:crew`: one-screen description of the crew.
- Consent-first `setup`: private venv with pinned Pillow 12.3.0; ffmpeg is checked, never installed.
- Bundled Rubik font (OFL).
- 130+ pytest tests, about 98% coverage, including a real end-to-end render.
- Security: topic and audio path reach the scripts through files, safe folder names, outputs and image/audio paths confined to the production folder, no writes through symlinks, hash-locked pip install.
