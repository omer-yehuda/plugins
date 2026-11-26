---
name: new-style
description: Design and save your own Video Creator style pack from a description or reference images.
disable-model-invocation: true
argument-hint: "<describe the look, e.g. 'retro 1980s VHS sports broadcast'>"
---

# Video Creator: your own style

**Description:** $ARGUMENTS

Helper: `node "${CLAUDE_PLUGIN_ROOT}/scripts/vc.js"` (`V`).

1. Run `V styles` to see the names already taken. For a complete example pack, read the `3d-realistic` entry in `${CLAUDE_PLUGIN_ROOT}/styles/styles.json`.
2. If the user shared reference images, look at them and describe palette, lighting, line, texture and camera. Never copy a named artist, studio, game or franchise: describe the qualities in plain words.
3. Draft the pack with these keys: `id` (lowercase, dashes), `name`, `tagline`, `look`, `character`, `finish`, `negative`, `motion`, `palette` (three `#RRGGBB`), `grade`, `fx` (up to four), `fps`, `transition`, `transitionSeconds`, `shotSeconds` ([min, max]), `moves`, `score`, `tips`. Allowed values for `grade`, `fx`, `transition`, `moves` and `score` are the constant lists at the top of `${CLAUDE_PLUGIN_ROOT}/scripts/styles.js` (read the first 15 lines only).
4. Show the draft in a short table and ask: **Save it** · **Change something**.
5. Save it without putting text on a command line: run `V prep`, write the pack as JSON to the printed `input` path with the Write tool, then run `V add-style --input-file <path>`. If it prints `errors`, fix them and repeat.
6. Tell the user: `/video-creator:make <id> <idea>` now uses it, and it can be mixed with any built-in (`/video-creator:mix <id>+anime ...`). Custom styles live in `.video-creator/styles/` in this project.
