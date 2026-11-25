---
name: wire
description: List past Newsroom editions in this project.
disable-model-invocation: true
---

Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/newsroom/newsroom.js" list` and show the result as a table with columns: id, status (open or written), folder. If there are no editions, say so and mention `/army:edition`. Add nothing else.
