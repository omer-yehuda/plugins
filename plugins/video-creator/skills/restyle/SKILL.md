---
name: restyle
description: Video Creator restyle. Use when the user runs /video-creator:restyle <project-id> <style>, or asks to make the same video again in another style. Copies the story and timing into a new project with the new look, then renders a new animatic.
argument-hint: "<project-id> <style or style+style>"
---

# Video Creator: restyle

**Arguments:** $ARGUMENTS

Helper: `node "${CLAUDE_PLUGIN_ROOT}/scripts/vc.js"` (`V`). The house rules in `/video-creator:make` apply.

1. Run `V list`; use only an id the script printed. Run `V style <style>`; if unknown, show `V styles` and ask.
2. Run `V restyle <id> --style <style>`. It makes a NEW project (the original is untouched) with the same shots, lines and timing, and clears `character` and `world`.
3. Dispatch ONE `video-creator:style-artist` with `model: "sonnet"`. Brief: the new `files.project`, the new style JSON, the format file `${CLAUDE_PLUGIN_ROOT}/skills/make/project-format.md`, and "write character and world in this style and translate every shot prompt and motion into this style's vocabulary; keep the story, ids, seconds and lines".
4. Run `V check <new id>`, `V prompts <new id>`, `V animatic <new id>`.
5. Show both projects side by side (style, shots, animatic path) and offer `/video-creator:shoot <new id>`.

Tip for series: one story in three styles makes a strong A/B test for a channel.
