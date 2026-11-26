---
name: budget
description: Show or set the army token budget per mission (for example 400k), or turn it off.
argument-hint: "[tokens such as 400k | off]"
disable-model-invocation: true
---

Run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/army.js" budget "$ARGUMENTS" --data "${CLAUDE_PLUGIN_DATA}"
```

Reply with the budget in one or two lines.
- The budget counts the new tokens the units use in one mission: input, cache writes and output. Cache reads are listed apart (they cost about a tenth) and HQ's own tokens are not counted.
- At 80% HQ is told to finish with the units already planned. At 100% it is told to dispatch nothing new and to say what was left out. It is advice to HQ, not a hard stop.
- `/army:status` shows the tokens used so far, per unit. With the budget off the ledger still runs.

If a mission is active, this command asks for approval (the safety gate protects the army's settings during missions).
