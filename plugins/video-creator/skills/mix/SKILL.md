---
name: mix
description: Video Creator style mix. Use when the user runs /video-creator:mix <style>+<style> <idea>, or asks video creator for two styles combined (for example "minecraft but anime"). The first style gives the world and grade, the second the drawing technique, transition and music.
argument-hint: "<style>+<style> <idea>"
---

# Video Creator: mix two styles

**Arguments:** $ARGUMENTS

1. The first word must be two style ids joined with `+` (for example `minecraft+anime` or `noir+cyberpunk`). If the user gave two styles in words, join them that way. If one is unknown, run `node "${CLAUDE_PLUGIN_ROOT}/scripts/vc.js" styles` and ask.
2. Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/vc.js" style <a+b>` and show the user the mixed look in two lines: what comes from each style.
3. Then follow `${CLAUDE_PLUGIN_ROOT}/skills/make/SKILL.md` from Step 2, with that mixed style id. Read that file now and follow it exactly.

The order matters: `minecraft+anime` is a blocky world drawn like anime; `anime+minecraft` is an anime world built from blocks. Offer the reverse if the first animatic does not feel right.
