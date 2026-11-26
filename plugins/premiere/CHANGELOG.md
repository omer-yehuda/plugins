# Changelog

## 1.1.0 (2026-11-26)

- **Director pass** (camera positions and flow) inside every `/premiere:pitch`, before the pitch is shown. Craft sheet: `skills/pitch/director.md`.
- Two new optional shot fields: `size` (`wide`, `medium`, `close`, `detail`) and `angle` (`eye`, `low`, `high`, `over-shoulder`, `top`). The director sets both on every shot; the cinematographer turns them into the framing words of the prompt. Shot lists without them still validate and render.
- `premiere.js shots <id>`: the camera plan as a table (size, angle, move, seconds) and flow notes. `check` returns the same notes in `flow`.
- Flow notes: shots with no size; two shots running with the same size and angle (a jump cut on one subject); three shots of one size running; the same move three times running (the format always said this, now it is checked); a pan or tilt that reverses the one before; a pan or tilt on a close or detail shot; a push-in on a detail shot.
- `/premiere:director [id]`: the same pass as a skill of its own, for an existing production. It refreshes the framing words of changed shots and lists stills that must be reshot.
- Tests: 2 new tests for the fields, each flow note and the `shots` command.

## 1.0.0 (2026-11-22)

- `/premiere:pitch <topic>`: a director writes a 5 to 8 shot list and a cinematographer writes the look bible and one prompt per shot. Generates nothing.
- `/premiere:shoot <id>`: gets one still per shot into the production from the image model you choose (your own tool, or your signed-in browser), hero still first with your approval, then a continuity agent rules KEEP or RESHOOT on every frame.
- `/premiere:cut <id> [--draft]`: renders the stills into a film with slow camera moves, one colour grade, film grain, cinema bars, a synthesized score that ducks under an optional voice file, `captions.srt` and `metadata.md`. Wide 1920x1080 or vertical 1080x1920, 30 fps.
- `/premiere:dailies [id]`: contact sheet, or the list of productions.
- `scripts/premiere.js` and `scripts/film.js`: zero npm dependencies, ffmpeg only. One encoded file per shot, renamed only after ffmpeg exits 0, joined without re-encoding, sound added last.
- Security: no user text on any command line, ffmpeg run without a shell and only on files inside the production, still and voice paths validated against a fixed pattern, planted-state checks, symlinked state refused. No image model is bundled and nothing is downloaded or uploaded.
- Not in this version: image-to-video clips, voice synthesis, burned-in captions.
