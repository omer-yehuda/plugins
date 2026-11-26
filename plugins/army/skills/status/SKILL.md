---
name: status
description: Show the army status (mode, safety gates, token budget and usage, active mission and phase, memory size).
disable-model-invocation: true
---

Run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/army.js" status --session "${CLAUDE_SESSION_ID}" --data "${CLAUDE_PLUGIN_DATA}"
```

Reply with a compact summary: mode, gates, token budget, the active mission and its phase (if any) with the tokens its units have used so far (`tokens.spent`, the per-unit list, and `used` when a budget is set), missions logged, and lessons size. If the user also asks to see the lessons, read `.army/lessons.md` and show it, labeled as project memory.
