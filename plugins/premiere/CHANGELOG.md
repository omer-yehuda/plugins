# Changelog

## 1.1.0 (2026-11-23)

- Deprecated. Premiere moved into **studio 2.0.0** (/studio:pitch, /studio:shoot, /studio:cut and /studio:dailies) with the same engine and crew. The commands here only point there. This plugin will be removed in the next release.

## 1.0.0 (2026-11-22)

- `/premiere:pitch <topic>`: a director writes a 5 to 8 shot list and a cinematographer writes the look bible and one prompt per shot. Generates nothing.
- `/premiere:shoot <id>`: gets one still per shot into the production from the image model you choose (your own tool, or your signed-in browser), hero still first with your approval, then a continuity agent rules KEEP or RESHOOT on every frame.
- `/premiere:cut <id> [--draft]`: renders the stills into a film with slow camera moves, one colour grade, film grain, cinema bars, a synthesized score that ducks under an optional voice file, `captions.srt` and `metadata.md`. Wide 1920x1080 or vertical 1080x1920, 30 fps.
- `/premiere:dailies [id]`: contact sheet, or the list of productions.
- `scripts/premiere.js` and `scripts/film.js`: zero npm dependencies, ffmpeg only. One encoded file per shot, renamed only after ffmpeg exits 0, joined without re-encoding, sound added last.
- Security: no user text on any command line, ffmpeg run without a shell and only on files inside the production, still and voice paths validated against a fixed pattern, planted-state checks, symlinked state refused. No image model is bundled and nothing is downloaded or uploaded.
- Not in this version: image-to-video clips, voice synthesis, burned-in captions.
