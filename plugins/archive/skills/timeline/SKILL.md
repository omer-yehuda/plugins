---
name: timeline
description: Show a dated list of the records other plugins saved in this project (rulings, charts, reviews, countdowns, exams), newest first.
disable-model-invocation: true
argument-hint: "[plugin name]"
---

Helper: `node "${CLAUDE_PLUGIN_ROOT}/scripts/archive.js"`.

With no argument run `timeline`. With an argument, pass it only if it is exactly one of: army, court, er, critics, customs, studio, mission-control, academy, newsroom, premiere, as `timeline --plugin <name>`; otherwise say the name is unknown and list those.

Show a table with columns: date, plugin, record, outcome, path. Newest first, at most 30 rows, then say how many more there are. If nothing is recorded, say so. Add nothing else.
