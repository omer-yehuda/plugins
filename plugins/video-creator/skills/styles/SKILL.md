---
name: styles
description: List every Video Creator style, built-in and your own.
disable-model-invocation: true
---

# Video Creator: styles

Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/vc.js" styles`. Show a table: command (`/video-creator:<id>`, or `/video-creator:make <id>` for custom styles), name, tagline. Mention any `problems` (broken custom style files) under the table.

Then add three lines:
- Mix any two: `/video-creator:mix voxel+anime <idea>`
- Same story, new look: `/video-creator:restyle <project-id> <style>`
- Your own look: `/video-creator:new-style <description>`
