---
name: docket
description: List past Code Court cases and their rulings in this project.
disable-model-invocation: true
---

Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/court/court.js" list` and show the result as a table with columns: id, status (open or ruled), ruling. If there are no cases, say so and mention `/army:trial`. Add nothing else.
