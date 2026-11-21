---
description: Make an animated cartoon Short from a true story (toon-shorts skill)
---

Load the `toon-shorts` skill with the skill tool (or read `.claude/skills/toon-shorts/SKILL.md`) and follow it
step by step for this request:

$ARGUMENTS

How this setup differs from Claude Code:

- `<skill>` in SKILL.md means `.claude/skills/toon-shorts` in this project. Run every command as
  `python ".claude/skills/toon-shorts/scripts/toon.py" <command> ...` from the project folder.
- Where SKILL.md says AskUserQuestion, use your question tool if you have one; otherwise ask in plain text with
  numbered options and wait for the answer.
- Where SKILL.md says "open preview.png with Read", read the image file. If you cannot see images, tell the user
  the preview path and ask them to check it against `references/checklist.md` with you, tile by tile.
- Facts: search for each fact you use and name the source in the description. Search YouTube for the idea too;
  if well-known videos already tell it the same way, pick another idea or another angle.
- Keep the PACE lines that `check`, `preview` and `render` print clean before the full render.
