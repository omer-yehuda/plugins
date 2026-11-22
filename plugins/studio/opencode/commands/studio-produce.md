---
description: Make a kinetic-typography explainer video about a topic (Studio produce skill)
---

Read `.opencode/studio/skills/produce/SKILL.md` and follow it step by step for this topic:

$ARGUMENTS

How this setup differs from Claude Code:

- `${CLAUDE_PLUGIN_ROOT}` in SKILL.md means `.opencode/studio` in this project (the copied Studio plugin
  folder). So `S` is `python ".opencode/studio/skills/produce/scripts/studio.py"`.
- `$ARGUMENTS` in SKILL.md is the topic above.
- The crew (writer, director, screener) are subagents in Claude Code. Here, play each role yourself in turn:
  read `.opencode/studio/agents/<role>.md` as that role's brief, do exactly what it asks, write its files, then
  continue as the showrunner. Keep the roles separate: finish the script before you storyboard, and screen the
  contact sheet as if you had not made it.
- Where SKILL.md says AskUserQuestion, use your question tool if you have one; otherwise ask in plain text with
  numbered options and wait for the answer.
