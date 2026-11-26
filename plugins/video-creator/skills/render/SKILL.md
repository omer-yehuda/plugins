---
name: render
description: Cut a Video Creator project into the finished styled video (draft, final, burned captions or animatic).
disable-model-invocation: true
argument-hint: "<project-id> [--draft] [--burn] [--animatic]"
---

# Video Creator: render

**Arguments:** $ARGUMENTS

Helper: `node "${CLAUDE_PLUGIN_ROOT}/scripts/vc.js"` (`V`).

1. Run `V list` and match the id against the printed ids; use only an id the script printed.
2. `--animatic`: run `V animatic <id>`, report the path and stop. It needs no media.
3. Run `V check <id>`. Errors: show them and stop. Missing shots: list them and point to `/video-creator:shoot <id>`.
4. Sound: if the user wants a voice and has none yet, give them the `line` of every shot in order to record, and wait. When the file is in the project folder, set `"voice": "<file name>"` in `project.json` (same for `"music"`) and run `V check <id>` again. Video Creator does not synthesise voices.
5. Captions: Shorts, TikTok and Reels play muted by default, so recommend burned-in captions (`--burn`) for vertical videos. `captions.srt` is always written too.
6. Unless the user asked for the final straight away, render a draft first: `V render <id> --draft [--burn]` (half size, fast). Use a long timeout. Report `draft.mp4` and ask: **Render the final** · **Change timing, moves or transitions** (edit `project.json`, then `V check`) · **Redo a shot**.
7. Final: `V render <id> [--burn]`. About one minute for 30 seconds. Shots that did not change since the last render are reused (`shotsReused`), so re-renders after a small edit are fast. It writes `video.mp4`, `captions.srt` and `metadata.md`.
8. Report in about 8 lines: each file's path, length, size, style, sound, and the upload checklist from `metadata.md` (declare AI-generated content; say so if the voice is an AI voice).

Errors: `no-ffmpeg`: install ffmpeg. `ffmpeg-failed`: show the message as it is; the usual cause is a file ffmpeg cannot read, so name the shot.

Do not upload, publish or schedule the video. That is the user's decision.
