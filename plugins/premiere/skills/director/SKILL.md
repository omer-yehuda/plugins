---
name: director
description: Premiere director pass. Reviews and fixes the camera plan of a Premiere production (size, angle and move of each shot, and how each shot leads into the next). Runs automatically inside every /premiere:pitch after the shot list is written. Use on its own ONLY when the user runs /premiere:director or says "premiere, direct the shots" or "premiere, fix the camera" for an existing production.
argument-hint: "[production-id]"
---

# Premiere: the director pass

**Production:** $ARGUMENTS (if empty, use the production of the pitch in this conversation; if there is none, run `P list` and ask which)

Helper: `node "${CLAUDE_PLUGIN_ROOT}/scripts/premiere.js"` (`P`). The house rules in `/premiere:pitch` apply.

1. Match the id against `P list`; use only an id the script printed. Run `P shots <id>`. `bad-shots` means the
   shot list is not valid yet: show the errors and stop.
2. `flowOk: true`: show the table and say the camera plan is clean. Stop here unless the user asked for a change.
3. Otherwise dispatch ONE `premiere:director` with `model: "sonnet"`. Brief: the path of `shots.json`, the craft
   sheet `${CLAUDE_PLUGIN_ROOT}/skills/pitch/director.md`, the `table` rows and the `flow` notes exactly as
   printed, and "change only `size`, `angle`, `move` and the order of shots; keep ids, stills, seconds and lines".
   Pass any change the user asked for in their own words.
4. Run `P shots <id>` again. If notes remain, send them back once more (two rounds at most), then show what is
   left and why.
5. If `size` or `angle` changed on any shot, the prompts are stale: dispatch ONE `premiere:cinematographer`
   (sonnet) with "rewrite the framing words of the prompts for these shot ids to match size and angle; change
   nothing else", then run `P check <id>` and `P prompts <id>`. A still that was already generated for a changed
   shot must be reshot: list those shots.
6. Report in at most 8 lines: the table, what changed and why, what is left on purpose.
