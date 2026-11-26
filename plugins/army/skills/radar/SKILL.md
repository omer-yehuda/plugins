---
name: radar
description: Show the ATC radar, an ASCII board of live flights, their lanes, ages and lane conflicts. Use ONLY when the user runs /army:radar or explicitly asks who is working on what, or which lanes are claimed.
argument-hint: ""
disable-model-invocation: true
---

# Radar

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/atc/atc.js" radar --session "${CLAUDE_SESSION_ID}"
```

Print the board exactly as the script returns it, inside a code block. `[YOU]` marks this session's flights, `[LIVE]` other sessions, `[EXPIRED]` flights with no activity for 2 hours (they no longer block anything). Below the board, add one line only if there is a CONFLICTS section: suggest the owners coordinate or that one session releases its lane.

If the script reports `not-a-git-repo` or an empty sky, say so plainly.
