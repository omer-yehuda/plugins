---
name: restyle
description: Remake a Video Creator project's story and timing in another style, as a new project.
disable-model-invocation: true
argument-hint: "<project-id> <style or style+style>"
---

# Video Creator: restyle

**Arguments:** $ARGUMENTS

Helper: `node "${CLAUDE_PLUGIN_ROOT}/scripts/vc.js"` (`V`). The house rules in `${CLAUDE_PLUGIN_ROOT}/skills/make/SKILL.md` apply.

1. Run `V list`; use only an id the script printed.
2. Run `V restyle <id> --style <style>` (`unknown-style`: run `V styles` and ask). It makes a NEW project (the original is untouched) with the same shots, lines and timing, and clears `character` and `world`.
3. Dispatch ONE `video-creator:style-artist` with `model: "sonnet"`. Brief: the new `files.project` and `files.style` paths. Nothing else; it reads them.
4. Run `V build <new id>` (prompts and animatic in one call).
5. Show both projects side by side (style, shots, animatic path) and offer `/video-creator:shoot <new id>`.

Tip for series: one story in three styles makes a strong A/B test for a channel.
