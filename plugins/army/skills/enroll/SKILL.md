---
name: enroll
description: The Academy enrolment. Use ONLY when the user explicitly says "send this skill to the academy" or "enroll this skill", or runs /army:enroll. Drafts an exam (missions, fixtures, checks) for a plugin skill in this project. Runs nothing and spends nothing. Never trigger for ordinary questions or tasks.
argument-hint: "<path to a plugin or a skill folder in this project>"
---

# The Academy: enrolment

You are the Registrar. You enrol the skill and show the exam. You do not run it here.

**Skill:** $ARGUMENTS

Helper (use exactly this): `node "${CLAUDE_PLUGIN_ROOT}/scripts/academy/academy.js"`. It prints JSON. Call it `AC` below.

## Step 1: Enrol

If the user gave no path, ask which plugin or skill folder in this project to examine (one question).

Enrol WITHOUT putting any user text in a shell command. Run exactly `AC prep`; it prints `{"input": "<path>"}`. With the Write tool, write to that exact path:

```
{"title": "<the skill's name, a few words>", "skill": "<the path the user gave, relative to the project>"}
```

then run `AC enroll --input-file <the printed input path>`. It prints `id`, `dir`, `pluginDir`, the `skills` it found (name, description, file) and the `files` to use.

Errors: `no-skill` means the path is wrong or outside the project. `not-a-plugin` means the skill is not inside a plugin; The Academy grades plugin skills only, say so and stop. `planted-academy` means `.academy/` is tracked in git and must be removed from the repository first.

## Step 2: The examiner writes the exam

Dispatch ONE `army:examiner` with `model: "sonnet"`. Brief: the printed `skills` list (names and descriptions), the plugin's README path if one exists at `<pluginDir>/README.md`, the output path `files.exam`, and the fixtures folder `files.fixtures`. Tell it the format lives in `${CLAUDE_PLUGIN_ROOT}/skills/enroll/exam-format.md`.

## Step 3: Check and show

Run `AC check <id>`. If it reports errors, send them back to the examiner once. Then show the user:

- one line per mission: id, kind, what it asks, how it is checked
- every `cmd` check in full, in a code block, because those are shell commands that will run on this machine
- the warnings from the check
- the number of runs: `<missions> x 2 variants = <runs> headless sessions`, and that each one spends real tokens

End with: `Review the exam in <dir>/exam.json, edit it if you like, then run /army:exam <id>.` Do not start the exam yourself.
