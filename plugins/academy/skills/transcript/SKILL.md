---
name: transcript
description: Show an Academy report card, or list the exams in this project.
disable-model-invocation: true
argument-hint: "[exam-id]"
---

Helper: `node "${CLAUDE_PLUGIN_ROOT}/scripts/academy.js"`.

With no argument, run it with `list` and show a table: id, status, grade. With an argument, match it against the ids that `list` prints, then run `transcript <id>` and show the `markdown` field as it is. If the exam has not been run, say so and mention `/academy:exam`. Add nothing else.
