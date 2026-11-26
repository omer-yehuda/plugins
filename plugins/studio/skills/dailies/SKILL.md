---
name: dailies
description: Show the contact sheet of a Studio film production's stills, or list productions.
disable-model-invocation: true
argument-hint: "[production-id]"
---

Helper: `node "${CLAUDE_PLUGIN_ROOT}/scripts/premiere.js"`.

With no argument, run it with `list` and show a table: id, status (new, pitched or rendered), folder. With an argument, match it against the ids that `list` prints, run `dailies <id>`, and show the path of `dailies.jpg`, the shot order, and any stills that are still missing. If ffmpeg is not installed, say so. Add nothing else.
