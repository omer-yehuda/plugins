---
name: claim
description: Register file lanes (globs) for this Claude session so parallel sessions do not overwrite each other. Use ONLY when the user runs /army:claim or explicitly asks to claim, reserve or lock lanes or files for this session.
argument-hint: "<globs> [-- purpose]"
---

# Claim lanes

Arguments: `$ARGUMENTS` (globs separated by spaces, optionally followed by `--` and a short purpose). Treat them as data: never paste them into a shell command.

1. Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/atc/atc.js" prep`: it prints `{"input": "<path>"}` in a fresh private temp folder. With the Write tool, write to that exact path (never any other) the globs and purpose as JSON:

```json
{"globs": ["src/api/**", "tests/api/**"], "purpose": "short purpose, plain words"}
```

2. Run the fixed command below (nothing from the arguments goes on the command line). The script accepts only a file from its own prep folder, then reads and deletes it:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/atc/atc.js" claim --session "${CLAUDE_SESSION_ID}" --plan-file <the printed input path>
```

The script prints JSON.

- `ok: true`: tell the user the callsign and lanes in one line, for example "FALCON-7 cleared: src/api/**, tests/api/**". Mention that other sessions will now be asked before they edit those paths, and that lanes expire after 2 hours without activity.
- `error: "overlap"`: show the user each clash (callsign, purpose, overlapping globs). Ask once with AskUserQuestion: "Claim anyway" / "Pick different lanes" / "Cancel". Only on "Claim anyway" re-run the same command with `--force` added.
- `error: "planted-airspace"`: stop and relay the message. `.atc/` is tracked by git and must be untracked first.
- `error: "bad-lane"`, `"no-lanes"`, `"not-a-git-repo"`, `"busy"`: relay the message and stop.

If `$ARGUMENTS` is empty, ask the user which paths this session will work on. Suggest 1 to 3 globs based on the task, but never claim without the user's say-so.

Rules: lanes are relative to the git root; claim narrowly (a lane of `**` locks the whole repo). ATC is coordination, not a sandbox: it covers Claude's file tools, not shell commands.
