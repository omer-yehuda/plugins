# Changelog

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
