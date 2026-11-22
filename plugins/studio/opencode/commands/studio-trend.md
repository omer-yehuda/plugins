---
description: Make a wide video plus a Short about one trending AI tool, from real screenshots (Studio trend skill)
---

Read `.opencode/studio/skills/trend/SKILL.md` and follow it step by step for this topic:

$ARGUMENTS

How this setup differs from Claude Code:

- `${CLAUDE_PLUGIN_ROOT}` in SKILL.md means `.opencode/studio` in this project. So `S` is
  `python ".opencode/studio/skills/produce/scripts/studio.py"`, and "/studio:produce Step N" means that step in
  `.opencode/studio/skills/produce/SKILL.md`.
- Step 2 needs real screenshots of the tool doing a real task. If you have a browser tool, use it. If not, stop
  at Step 2 and ask the user to take the screenshots (list exactly which: before, the action, the result, what
  broke) and give you the file paths. Never invent or mock up a screenshot.
- The screener agent is a subagent in Claude Code. Here, read `.opencode/studio/agents/screener.md` and do the
  screening yourself, as if you had not made the video.
- Where SKILL.md says AskUserQuestion, use your question tool if you have one; otherwise ask in plain text with
  numbered options and wait for the answer.
