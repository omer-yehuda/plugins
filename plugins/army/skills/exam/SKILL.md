---
name: exam
description: The Academy exam. Use ONLY when the user explicitly runs /army:exam or says "run the academy exam". Runs an approved exam in headless Claude Code, with and without the skill, and shows the report card. It spends real tokens, so never start it without the user's explicit yes.
argument-hint: "<exam-id> [--repeat N] [--only mission-id]"
---

# The Academy: the exam

**Arguments:** $ARGUMENTS

Helper: `node "${CLAUDE_PLUGIN_ROOT}/scripts/academy/academy.js"` (`AC`).

1. Run `AC list` and match the id the user gave against the printed ids. Use only an id the script printed. No id given and exactly one enrolled exam: use it. Otherwise show the list and ask.
2. Run `AC check <id>` (add `--repeat N` only if the user asked for repeats, N from 1 to 5). If it is not ok, show the errors and stop.
3. Read `exam.json` in the exam folder and show every `cmd` check in a code block. These are shell commands that will run on this machine in temporary copies of the fixtures.
4. Ask with **AskUserQuestion**: "Run <runs> headless Claude Code sessions for this exam? Each one spends tokens." Options: **Run it** · **One mission first** · **Cancel**. For "One mission first" add `--only <first mission id>`.
5. Only on a yes, run `AC run <id>` with the chosen flags and a long timeout (each session can take several minutes). Do not add any other flag. If it fails with `no-claude`, tell the user the `claude` CLI is not installed or not signed in.
6. Dispatch ONE `army:dean` with `model: "sonnet"`: the path of `results.json`, the path of `exam.json`, and the output path `<exam folder>/verdict.md`.
7. Show the report card (about 12 lines):

```
THE ACADEMY: <skill>
GRADE: GRADUATED | RETAKE | EXPELLED   (<reason from the script>)
CHECKS PASSED: plain <x%> · with the skill <y%>
COST: plain $<a> · with the skill $<b>  (<ratio>x)   TIME: <s> vs <s>
DEAN'S NOTE: <the dean's two sentences>
Transcript: <path>   (/army:transcript <id> for the table)
```

The grade comes from the script. Never raise or soften it. If the reason is that the exam is too easy, say so plainly and suggest harder missions.
