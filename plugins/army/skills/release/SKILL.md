---
name: release
description: Free the file lanes this Claude session claimed. Use ONLY when the user runs /army:release or explicitly asks to release, unlock or give up this session's lanes.
argument-hint: ""
---

# Release lanes

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/atc/atc.js" release --session "${CLAUDE_SESSION_ID}"
```

The script prints JSON with `released`: the callsigns that were freed (this includes any flights this session registered through `/army:clear`). Report them in one line, or say there was nothing to release.

Lanes are also released automatically when the session ends, and they expire after 2 hours without activity, so this is only needed to hand a path over early.
