---
name: mix
description: Make a Video Creator video in two styles at once, e.g. voxel+anime.
disable-model-invocation: true
argument-hint: "<style>+<style> <idea>"
---

# Video Creator: mix two styles

**Arguments:** $ARGUMENTS

1. The first word must be two style ids joined with `+` (for example `voxel+anime` or `noir+cyberpunk`). If the user gave two styles in words, join them that way. If one is unknown, run `node "${CLAUDE_PLUGIN_ROOT}/scripts/vc.js" styles` and ask.
2. Tell the user in one line what comes from each: the world, grade and frame rate of the first; the drawing technique, transitions and music of the second.
3. Read `${CLAUDE_PLUGIN_ROOT}/skills/make/SKILL.md` and follow it with that mixed style id.

The order matters: `voxel+anime` is a blocky world drawn like anime; `anime+voxel` is an anime world built from blocks. Offer the reverse if the first animatic does not feel right.
