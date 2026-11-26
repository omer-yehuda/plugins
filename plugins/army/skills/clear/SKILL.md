---
name: clear
description: "Lanes. Use ONLY when the user says \"ATC, clear for takeoff\", \"split this across parallel agents\" or runs /army:clear. Splits a task into 2-5 parallel pilots with non-overlapping file lanes."
argument-hint: "<big task>"
---

# ATC HQ: clear for takeoff

You are the tower. You split, assign lanes, dispatch, merge and check. Pilots do the flying.

**Task:** $ARGUMENTS

Control script: `node "${CLAUDE_PLUGIN_ROOT}/scripts/atc/atc.js"`. Use `S` for `--session "${CLAUDE_SESSION_ID}"`.

Never push, never touch the remote, never delete branches you did not create.

## 1. Survey (read only)

Read just enough to split the task: the file tree, the modules the task touches, the test command (package.json, Makefile, pyproject). Run `git status --porcelain`. If the working tree has uncommitted changes, tell the user in the flight plan: worktree flights start from the last commit, not from the dirty tree.

## 2. Flight plan

Split the task into **2 to 5 flights**. Rules:
- Lanes are file globs relative to the git root and must NOT overlap. If two parts need the same file, they are the same flight, or one flight owns it and the other works afterwards.
- Each flight gets a one-line purpose, its lanes, and the tests it should run.
- Shared files (lockfiles, route registries, index barrels, README) go to ONE flight or are left for HQ to touch at merge.
- If the task cannot be split without overlap, say so and offer one flight.

Show the plan as a compact table and ask once with AskUserQuestion: **Go** / **Fewer flights** / **Cancel**. On "Fewer flights" merge the closest pair and ask again. On "Cancel" stop.

## 3. Register lanes

For each flight (n = 1, 2, ...) run `node "${CLAUDE_PLUGIN_ROOT}/scripts/atc/atc.js" prep` (it prints `{"input": "<path>"}` in a fresh private temp folder), then write its lanes and purpose with the Write tool to that exact printed path, never any other (never put globs or purpose text on a command line):

```json
{"globs": ["lane/one/**", "lane/two/**"], "purpose": "short purpose, plain words"}
```

then register it under a synthetic flight id owned by this session (the script reads and deletes the file):

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/atc/atc.js" claim --session "${CLAUDE_SESSION_ID}" --id "${CLAUDE_SESSION_ID}:flight-<n>" --plan-file <the printed input path>
```

If any claim returns `overlap`, another live session owns those paths: show the user the clash and ask whether to adjust the plan or cancel. Do not use `--force` here.

## 4. Dispatch

Check whether worktree isolation is available (git repo with at least one commit, and the Agent tool accepts `isolation: "worktree"`).

**Available:** launch all flights in ONE message as parallel Agent calls:
- `subagent_type`: `army:pilot`, `model`: `sonnet` (lean; use `opus` for a flight with a hard design problem if the user asked for max quality), `isolation`: `worktree`.
- Brief each pilot: its callsign flight number, its purpose, its lane globs, the tests to run, and the rule "edit only inside your lane; if you need a file outside it, stop and report instead". Include the base commit (`git rev-parse HEAD`).

**Not available:** run the flights one at a time, in order, with the same briefs and no `isolation`. Say in the final report that flights ran sequentially.

## 5. Land and merge

Collect each pilot's SITREP (branch name and files changed). Then, in the main checkout and only if it is clean:
0. Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/atc/atc.js" branches`. It lists the local `worktree-*` branches straight from git and prints only names that pass a strict check (letters, digits, `.`, `_`, `-`, `/`; no leading `-`; no `..`). Match each pilot's reported branch against that list. Merge ONLY names printed there; if a reported branch is not in the list, do not merge it and report it as unmatched. Never type a branch name from a pilot report.
1. Merge each flight branch locally, one by one: `git merge --no-ff -- '<validated branch>'` (single quotes, name copied from the `branches` output). If a merge conflicts, abort that merge (`git merge --abort`), leave the branch intact, and report it. Never resolve silently.
2. Run the project's tests once on the merged result.

Run `prep` again and write the plan file with the Write tool to the exact printed path, then check lane discipline:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/atc/atc.js" conflicts --plan <the printed input path>
```

with `{"base": "<base commit>", "flights": {"flight-1": {"lanes": [...], "ref": "<branch>"}, ...}}`. For sequential flights omit `ref` and check after each flight instead. Report every file in `outsideLane` and every entry in `shared`.

## 6. Release

Always, even after failures:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/atc/atc.js" release --session "${CLAUDE_SESSION_ID}"
```

## 7. Final report (max 15 lines)

Flights flown (callsign, purpose, branch), merge result, test result, lane violations, anything left for the user (unmerged branches, stray files). Nothing was pushed. Offer: delete the flight branches/worktrees now that they are merged (ask, do not do it unprompted).
