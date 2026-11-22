---
name: log
description: List past Mission Control countdowns and their rulings in this project.
disable-model-invocation: true
---

Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/mission.js" list` and show the result as a table with columns: id, status (open or ruled), ruling, telemetry floor. If there are no countdowns, say so and mention `/mission-control:countdown`. Add nothing else.
