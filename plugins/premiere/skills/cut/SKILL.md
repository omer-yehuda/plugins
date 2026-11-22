---
name: cut
description: Premiere final cut. Use ONLY when the user runs /premiere:cut or says "premiere, cut the film". Renders the production's stills into a graded, scored film with camera moves, captions and metadata. Never trigger on its own, and never upload the result.
argument-hint: "<production-id> [--draft]"
---

# Premiere: the cut

**Arguments:** $ARGUMENTS

Helper: `node "${CLAUDE_PLUGIN_ROOT}/scripts/premiere.js"` (`P`).

1. Run `P list` and match the id the user gave against the printed ids; use only an id the script printed.
2. Run `P check <id>`. Not ok: show the errors and stop. Stills missing: list them and point to `/premiere:shoot <id>`.
3. If the shot list names a `voice` file, confirm it is in the production folder (the check says so). If the user wants a voice and has none yet, give them the lines in order from `shots.json` to record, and wait. Premiere does not synthesise a voice.
4. Unless the user asked for the final straight away, render a draft first: `P cut <id> --draft` (half size, fast). Use a long timeout. Tell the user where `draft.mp4` is and ask: **Render the final** · **Change timing or moves** (edit `shots.json`, then `P check`) · **Reshoot a still**.
5. Render the final: `P cut <id>`. A 30 second film takes about one to three minutes. It writes `film.mp4`, `captions.srt` and `metadata.md` in the production folder.
6. Report in about 8 lines: the path of each file, length, size, whether there is a voice, and the two reminders from `metadata.md`: declare AI-generated imagery when uploading, and say so if the voice is an AI voice.

If the render fails with `no-ffmpeg`, tell the user to install ffmpeg. If it fails with `ffmpeg-failed`, show the message as it is; the usual cause is an image file ffmpeg cannot read, so name the shot.

Do not upload, publish or schedule the film. That is the user's decision.
