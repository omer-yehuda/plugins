# Army: a chief of staff and specialist units for Claude Code

**18 units and 8 drills in one plugin.** Raise the whole army for a mission, or run a single drill: put a decision on trial, admit a bug, let the critics taste your work, go/no-go a release, examine a skill, recall what was decided, write the release edition, or claim lanes for parallel sessions. See [Drills](#drills).

Say **"raise the army"** and Claude becomes a Chief of Staff (HQ). It asks you its briefing questions once, writes an operation order, and dispatches specialist units as subagents, each on the cheapest model that can do the job. An Inspector General who never saw the work checks the result before you get it.

**[Open the command center →](https://omer-yehuda.github.io/plugins/)** Watch a mission play out, browse every unit, and read all 110 field manuals.

[![A mission playing out on the operations table](../../docs/images/mission.gif)](https://omer-yehuda.github.io/plugins/)

## Watch

| Video | What it shows |
|---|---|
| [Stop Prompting Claude. Give It a Mission.](https://www.youtube.com/shorts/h9i1ZHay0JE) | Say "raise the army" and Claude Code becomes a Chief of Staff |
| [14 AI Units. 1 Command. (Claude Code Army)](https://www.youtube.com/shorts/2X-fzvEffys) | The order of battle, unit by unit |

Both Shorts are from [One Result](https://www.youtube.com/@OneResultDev) and were recorded with v1.0, which had 14 units. The army now has 18.

## Install

```
/plugin install army --marketplace omer-yehuda/plugins
```

On Claude Code versions earlier than 2.1.275, run `/plugin marketplace add omer-yehuda/plugins` first, then `/plugin install army@omer-plugins`.

## Commands

| Say / run | What happens |
|---|---|
| `raise the army <mission>` · `/army:raise <mission>` | HQ engages only the units the mission needs |
| `raise the entire army <mission>` · `all units on board` · `/army:raise-all` | Turbo: every unit, after you confirm a dispatch preview |
| `/army:mode eco` · `/army:mode lean` · `/army:mode full` | Model profile. Eco uses the fewest tokens (Haiku wherever a mistake is cheap, smaller missions); lean (default, Pro-friendly) never uses Opus; full puts critical units on Opus |
| `/army:budget 400k` · `/army:budget off` | Token budget per mission for the units. HQ is warned at 80% and told to stop dispatching at 100% |
| `/army:gates on` · `/army:gates off` | Safety gates (default: on) |
| `/army:status` | Mode, gates, budget, active mission and phase, tokens used per unit, memory size |
| `/army:map` | Generate the command-center map locally (`.army/army-map.html`, works offline) |

The settings commands run only when you type them. Claude cannot invoke them on its own, and their descriptions cost no context. You can also call one unit directly: "send the defense unit to audit the auth flow". A unit called directly runs on its lean model.

## Order of battle

<!-- BEGIN ORDER OF BATTLE -->
**18 units, 110 specialist playbooks.** Generated from `units.json`.

| Unit | Callsign | Specialists | Tools | full | lean | eco |
|---|---|---|---|---|---|---|
| `recon` | PATHFINDER | codebase map, cached until manifests or config change | scoped | haiku | haiku | haiku |
| `ops` | OVERLORD | Mission planner, Architect, Risk analyst, Devil's advocate, Innovation officer, Product manager | scoped | opus | sonnet | sonnet |
| `inspector-general` | OVERWATCH | Consistency checker, Preflight checker | scoped | opus | sonnet | sonnet |
| `history` | ARCHIVE | Lessons keeper, Mission chronicler, Technical writer | scoped | sonnet | sonnet | haiku |
| `rnd` | FORGE | Skill smith, Playbook author, Automation officer, Proving ground | scoped | opus | sonnet | haiku |
| `special-ops` | GHOST | domains no unit covers; workarounds when stuck | scoped | opus | sonnet | haiku |
| `intel` | SPECTRE | Competitor analyst, Market analyst, Audience listener, Tech scout, Strategist, Verifier, Case-study researcher, Watch officer, Due-diligence investigator, Keyword researcher, Grants & competitions scout, User-research planner, Wargame officer | scoped | sonnet | sonnet | haiku |
| `data` | ORACLE | Data analyst, Experiments & statistics, Dashboard & report designer, Data collector | scoped | sonnet | sonnet | haiku |
| `engineering` | IRONWORKS | Builder, Test strategist, Unit-test specialist, Optimizer, Clean-code reviewer, Dependency specialist, Bug hunter, QA explorer, Compatibility checker, AI engineer, Integrations engineer, Mobile developer | all | sonnet | sonnet | sonnet |
| `ux` | PRISM | UX reviewer, Accessibility specialist, Design-consistency specialist | scoped | sonnet | sonnet | haiku |
| `logistics` | SUPPLY LINE | CI/CD engineer, Deployment engineer, Infrastructure & cost, Observability | all | sonnet | haiku | haiku |
| `rescue` | MEDEVAC | Debugger, Incident commander | all | opus | sonnet | sonnet |
| `defense` | AEGIS | AppSec specialist, Secrets hunter, Supply-chain specialist, Threat modeler, Red team, Hardening officer, AI security officer, Personal-data mapper, Child-safety officer, Backup & recovery officer, Account security officer | scoped | opus | sonnet | sonnet |
| `legal` | TRIBUNAL | Licenses & copyright, Privacy counsel, Terms & policies, Accessibility law, Trademarks & naming, AI & platform compliance, Minors counsel, Consumer-protection counsel, Advertising counsel, Reputation & defamation counsel, Contract reviewer, Disputes counsel, Platform-terms officer | scoped | opus | sonnet | sonnet |
| `comms` | MEGAPHONE | UX copywriter, Marketing copywriter, Localization editor, Plain-language editor, Proofreader, Brand-voice keeper, Outreach writer, Review & complaint responder, Press-release writer, Video scriptwriter | scoped | sonnet | sonnet | haiku |
| `growth` | WILDFIRE | SEO specialist, ASO specialist, Launch planner, Analytics specialist, Social media specialist, Email marketing specialist, Partnerships officer, Conversion specialist, Paid ads specialist, PR officer, Community manager, Reviews specialist | scoped | sonnet | haiku | haiku |
| `treasury` | VAULT | Pricing & business model, Cost forecaster, Forecaster, Tax mapper, Procurement officer, Crowdfunding officer | scoped | sonnet | haiku | haiku |
| `sales` | CLOSER | Offer & sales conversation, B2B & institutional sales, Negotiation officer, Customer support designer, Retention officer | scoped | sonnet | haiku | haiku |
<!-- END ORDER OF BATTLE -->

## Drills

Eight plugins joined the army in 2.0.0. Each is a **drill**: a complete procedure with its own independent agents that you can run on its own, without raising the army. HQ also runs a drill when a step of its plan matches one. Their old docs are in [docs/drills/](docs/drills/).

<!-- BEGIN DRILLS -->
| Drill | Run | Unit it extends | Use for | Formerly |
|---|---|---|---|---|
| trial | `/army:trial` `/army:appeal` `/army:docket` | ops | put a technical decision on trial: counsel argue each option, an independent judge rules | court |
| admit | `/army:admit` `/army:chart` | rescue | fix one bug: regression test first, smallest incision under a hard budget | er |
| taste | `/army:taste` `/army:retaste` `/army:menu` | inspector-general | three independent critics review the work, a head critic awards up to 3 stars | critics |
| countdown | `/army:countdown` `/army:scrub` `/army:log` | inspector-general | release go or no-go from collected facts and four stations | mission-control |
| exam | `/army:enroll` `/army:exam` `/army:transcript` | rnd | test a skill with and without it in headless Claude Code; pass rate, tokens, cost | academy |
| recall | `/army:recall` `/army:catalog` `/army:shelf` `/army:timeline` | history | search every record the army keeps, with the file behind every claim | archive |
| edition | `/army:edition` `/army:headline` `/army:wire` | comms | release notes, changelog, social posts and a video brief from the commits, fact-checked | newsroom |
| lanes | `/army:claim` `/army:clear` `/army:radar` `/army:release` | engineering | parallel sessions claim file lanes; a hook asks before one edits another's lane | atc |
<!-- END DRILLS -->

Examples: `put it on trial: should we move from REST to GraphQL?` · `admit this bug: checkout total is off by one cent` · `let the critics taste it` · `mission control, are we go?` · `send this skill to the academy` · `ask the archive why we chose REST` · `newsroom, write the edition` · `/army:claim src/billing/** (invoice refactor)`. The old phrases still work.

**Why this structure:** each unit is one subagent, and its specialists are field manuals (`doctrine/`) that the unit reads only when its brief needs them. Claude Code can nest subagents, but every subagent starts with a fresh context, so one subagent per unit keeps both the cost and the HQ's reading load low. Adding a specialist costs nothing until it is used. **Kits are least-privilege:** research and planning units can read, search the web and write their report, but cannot edit code or run a shell. Recon has no shell. Defense and the Inspector General can't edit. Only engineering, rescue and logistics carry the full kit.

## How HQ runs a mission

1. **Muster.** `army.js start` binds the mission to your session. It loads your mode and gates, and prints the unit→model map, which is the only routing table HQ uses. It also loads this project's lessons, labelled as data and never as instructions.
2. **Briefing.** All questions in one round, then HQ runs on its own.
3. **Recon.** A Haiku scout maps the codebase. The map stays fresh until manifests or config change.
4. **Operation order.** Commander's intent, definition of done, tier, units, phases.
   - A **campaign** gets checkpoints after each phase and its own `army/<missionId>` branch.
   - A **campaign or Turbo** first shows you a **dispatch preview** of units and models, and waits for your go.
5. **Dispatch.** Independent units run in parallel. Parallel engineering instances get separate git worktrees.
6. **Safety gates.** Irreversible and external actions wait for you.
7. **Integrate.** RED findings loop back for a fix and re-check. Thin work gets one targeted re-brief. Embedded instructions found in data are reported, never followed.
8. **Inspection.** The Inspector General judges the result cold.
9. **After-action.** History curates `lessons.md` (on Sonnet, at most 100 lines). `end` prints the lessons diff, which goes into your final report.

Every phase is recorded with `army.js phase`. If the context is compacted mid-mission, a `SessionStart` hook restores the mission, the phase and the operation order, so HQ doesn't skip inspection or leave the gate armed.

## Token saving

- **A measured ledger.** When a unit finishes, a hook sums the usage in that unit's own transcript into `<mission>/usage.jsonl`. `phase`, `status` and `end` print the total and the units from most to least expensive, and the final report carries it. "Spent" means new tokens (input, cache writes, output); cache reads are listed apart because they cost about a tenth. HQ's own tokens are not in the ledger. Units that ran in a git worktree are counted too.
- **A budget** (`/army:budget 400k`). At 80% HQ is told to finish with the units already planned; at 100% to dispatch nothing new and to say what was left out. It is advice to HQ, not a hard stop, and HQ cannot change it during a mission without your approval.
- **Eco mode** (`/army:mode eco`). Sonnet only for engineering, rescue, defense, legal, ops and the inspector-general, Haiku for the other twelve units, at most 4 units per mission, shorter SITREPs, no re-briefs and no Turbo.
- **Lessons caps that hold.** `start` loads at most 100 lessons (blank lines do not count), 400 characters per line and 12 KB in total, whatever the file holds, and `end` refuses a file that is too large to load whole.
- **Compact control output.** `army.js` prints single-line JSON; the indented form cost extra tokens on every phase change.

## Security model

| Threat | Defense |
|---|---|
| Mission reports leaking into commits, npm packages or images | `.army/.gitignore` contains `*`, and `.army/` is also added to `.git/info/exclude`. Tested: neither git nor `npm pack` includes it. **Docker** build contexts ignore nested `.gitignore` files, so add `.army` to your `.dockerignore`. |
| A repository planting fake lessons in `.army/` | `start` refuses to run if `.army/` is tracked in git. Lessons are always presented as data, and units are told to report embedded instructions instead of following them. |
| Prompt injection from web pages, files or other units' reports | A standing order in every unit says orders come only from the brief. Research units have no shell and no edit tools, so an injected instruction has little to act with. |
| The army switching off its own gate | During a mission, the gate asks before `gates`, `mode`, `budget` or `end --abort`, before ending ahead of after-action, and before any write to the army's session state or settings, whether by shell, Write/Edit or inline script. |
| One session's mission gating another session | State is per session (`.army/sessions/<id>.json`). It expires after 4 hours without activity, and the hook never walks above the git root or into your home directory. |

**The gate is a speed bump, not a sandbox.** It tokenizes shell commands:
- it strips git global options like `-C`
- it unwraps `sh -c`, `xargs`, `find -exec`, `npx`/`dlx`/`uvx` and inline `python -c`/`node -e` code
- it ignores quoted text, such as commit messages
- it allows read-only subcommands

It asks before pushes, history rewrites, deletions, deploys, publishing, destructive SQL, `curl | sh`, packages downloaded and run, new dependencies, GitHub writes, data sent to non-local hosts, and MCP tools whose names are write actions. It cannot see inside scripts, Makefiles or `package.json` scripts. 150+ cases in `tests/` cover what it catches and what it lets through.

## Memory (local only)

```
.army/
  .gitignore        "*": git, npm pack and most tools skip the folder
  sessions/<id>.json  one active mission per session (used by the gate)
  recon.md          codebase map, with a manifest fingerprint
  lessons.md        lessons learned, at most 100 lines, read by HQ as data
  missions/<id>/    opord.md, unit reports, lessons.before.md, state.final.json, log.md
```

Your settings (mode, gates, budget) are stored per user in the plugin's data directory.

## Development

```bash
node tools/sync-army.js          # regenerate agent frontmatter + tables from units.json
node tools/sync-army.js --check  # CI: fails if anything drifted
node --test plugins/army/tests/*.test.js # gate + lifecycle tests
node evals/run.js                # army vs. plain Claude on fixed missions (needs a signed-in claude CLI)
```

`units.json` is the single source of truth for each unit's model routing, tools and description. Agent frontmatter, the HQ routing table, this README's table and the map are all generated from it.

## Requirements

Claude Code with plugin support, and Node.js 18+ (control script, hooks and map generator). See [CHANGELOG.md](CHANGELOG.md) for release notes.
