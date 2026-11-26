# Changelog

## 2.1.0 (2026-11-26)

Token saving. (Ported from a cloud session's 1.3.0 work, written before the drills joined.)

### Added
- **Token ledger.** A `SubagentStop` hook sums each finished unit's transcript usage into `<mission>/usage.jsonl` (new tokens: input, cache writes and output; cache reads listed apart). `phase`, `status` and `end` print the total and a per-unit list, and HQ puts it in the final report. Units that ran in a git worktree are counted. HQ's own tokens are not.
- **`/army:budget <tokens|off>`**: a per-mission ceiling for the units (for example `400k`). A `PostToolUse` hook on the Agent tool tells HQ once at 80% (finish with the planned units, merge briefs, drop optional units) and once at 100% (dispatch nothing new, say what was left out). Advice, not a hard stop. Changing it during a mission asks for approval, like `mode` and `gates`.
- **`/army:mode eco`**: a third model profile. Sonnet for engineering, rescue, defense, legal, ops and the inspector-general; Haiku for the other twelve units. HQ also runs smaller: at most 4 units, 120-word SITREPs, no re-briefs, no Turbo. `units.json` has a new `eco` field and the generated tables a new column.

### Fixed
- **Lessons caps now hold.** 100 lessons separated by blank lines used to load as 50, and a single very long line went into context whole. `start` now counts non-blank lines, cuts a line at 400 characters and stops at 12 KB; `end` refuses a file that is too large to load whole.

### Changed
- `army.js` prints compact single-line JSON instead of indented JSON (fewer tokens on every call).
- The Chief of Staff's token discipline is longer: name specialists in every brief, give units a file scope, reuse earlier reports, watch the ledger at each phase.

### Not changed
- The safety gate. None of the gate findings from the latest review are addressed in this release.

### Tests
- 5 new lifecycle tests: lesson caps, eco routing, ledger and budget warnings, worktree units, compact output.

## 2.0.0 (2026-11-23)

Eight plugins joined the army as **drills**: complete procedures with their own independent agents that run on their own or as a step of a mission.

| Drill | Commands | Formerly |
|---|---|---|
| trial | `/army:trial` `/army:appeal` `/army:docket` | court |
| admit | `/army:admit` `/army:chart` | er |
| taste | `/army:taste` `/army:retaste` `/army:menu` | critics |
| countdown | `/army:countdown` `/army:scrub` `/army:log` | mission-control |
| exam | `/army:enroll` `/army:exam` `/army:transcript` | academy |
| recall | `/army:recall` `/army:catalog` `/army:shelf` `/army:timeline` | archive |
| edition | `/army:edition` `/army:headline` `/army:wire` | newsroom |
| lanes | `/army:claim` `/army:clear` `/army:radar` `/army:release` | atc |

- Scripts live in `scripts/<drill>/`, tests in `tests/`, old docs in `docs/drills/`. Agents keep their names under `army:` (for example `army:judge`, `army:surgeon`). Records stay in their folders (`.court/`, `.er/` and so on), so earlier records and the archive keep working.
- `units.json` lists the drills; `tools/sync-army.js` accepts their agents and generates the drills table in the README and the raise skill.
- HQ now runs a drill when a step of the operation order matches one (a real fork goes to trial, a single failure to admit, review to taste, a release to countdown and edition, parallel engineering to lanes).
- The ATC lane hook is part of the army's hooks. It only acts when a lane has been claimed.
- Breaking: install `army` instead of the eight plugins above. They remain for one release as stubs that point to the new commands.


## 1.2.0 (2026-11-19)

Hardening release, based on an external design review.

### Security
- **`.army/` can no longer leak or be planted.** `start` writes `.army/.gitignore` (`*`) so git and `npm pack` skip the folder (both tested), and refuses to run when `.army/` is tracked in git.
- **The gate guards itself.** During a mission it asks before:
  - `gates` or `mode` changes, and `end --abort`
  - ending before after-action
  - writes to session state or settings (shell, Write/Edit, inline scripts)
- **Least-privilege kits.** Every unit has an explicit `tools` list:
  - Research and planning units have no shell and no edit tools.
  - Recon has no shell.
  - Defense and the Inspector General cannot edit.
- **Prompt-injection standing order** in every unit: orders come only from the brief. Embedded instructions are reported under HANDBACK.
- **Tokenizing gate** replaces raw regexes:
  - It strips git global options (`git -C . push`) and uses command basenames (`/bin/rm`).
  - It unwraps `sh -c`, `xargs`, `find -exec`, package runners and inline `python -c`/`node -e` code.
  - It ignores quoted text and allows read-only subcommands.
  - Newly covered: `curl | sh`, `npx`/`dlx`/`uvx` downloads, `gh api` writes, destructive SQL, data sent to non-local hosts, PowerShell, and MCP write actions.
  - No longer flagged: commit messages, `cat vercel.json`, `git rebase --abort`, `git push --dry-run`, `kubectl rollout status`, `go install ./...`.

### Reliability
- **Missions are bound to the session.** State moved to `.army/sessions/<id>.json`, keyed by `${CLAUDE_SESSION_ID}`. Missions expire after 4 hours of inactivity, not 12 hours after the start. The hook stops walking up at the git root and never runs in your home directory. Two missions in one repo no longer disarm each other.
- **Phases are recorded** (`army.js phase`). A `SessionStart` hook re-injects the mission after compaction or resume.
- **Single source of truth:** `units.json` generates agent frontmatter, the HQ routing table and the README table, and CI checks for drift. Agent frontmatter now uses the lean model, so a direct dispatch never runs Opus by accident. `start` and `mode` print the resolved unit→model map.
- **Cost ceiling:** campaigns and Turbo show a dispatch preview and wait for confirmation.
- **Parallel engineering** uses git worktrees, or runs sequentially.
- **Memory:** History runs on Sonnet. `lessons.md` is capped at 100 lines in code. `end` prints a lessons diff for the final report. Lessons are cut at line boundaries.
- **Recon** goes stale only when manifests, config or the top-level layout change.

### Quality
- **Tests:** 19 suites, including 150+ gate cases plus the lifecycle: start, phases, end, expiry, sessions, walk-up, planted memory, `npm pack`, self-protection, MCP and Windows forms.
- **Evals:** a new harness (`evals/`) compares the army with plain Claude on 6 fixed missions (pass rate, tokens, cost, turns). No results are published yet.
- **CI:** actions pinned by commit SHA, Claude Code CLI pinned.
- **Context:** shorter agent descriptions. `mode`, `gates`, `status` and `map` use `disable-model-invocation`, so they cost no always-on context. `$ARGUMENTS` is quoted. No hard-coded language in skills.

### Map
- A new **command center**: an operations table where a mission plays out (transmission, briefing, recon sweep, operation order, deployment, safety gate, SITREPs, inspector's stamp, lessons filed). It also has shoulder-patch units with rank stars, classified personnel files with every field manual, rules of engagement and radio codes. Fonts are embedded, so it works offline. The markdown renderer escapes quotes.

## 1.1.0 (2026-11-19)
- 4 new units (data, sales, rnd, special-ops) and 64 new specialist playbooks (110 total).
- Commander's intent, operation vs. campaign tiers, one re-brief for thin work, a starting-commit checkpoint.
- `/army:map` and the first interactive map, with a live docs site.

## 1.0.0 (2026-11-18)
- Initial release: Chief of Staff, 14 units, lean/full model routing, safety-gate hook, local lessons memory.
