<div align="center">

<img src="docs/images/icon.png" width="84" alt="Army icon">

# Omer Yehuda · Claude Code Plugins

**A curated marketplace of tested plugins for [Claude Code](https://code.claude.com).**

[![Validate](https://github.com/omer-yehuda/plugins/actions/workflows/validate.yml/badge.svg)](https://github.com/omer-yehuda/plugins/actions/workflows/validate.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
![Claude Code](https://img.shields.io/badge/Claude%20Code-plugin%20marketplace-d97757)
![Node](https://img.shields.io/badge/node-%3E%3D18-339933)
![Python](https://img.shields.io/badge/python-3.11%2B-3776ab)

**[Army command center (live)](https://omer-yehuda.github.io/plugins/)** · [Studio toon](https://omer-yehuda.github.io/plugins/toon-shorts/) · [Order of battle](https://omer-yehuda.github.io/plugins/#units)

</div>

---

## Quick start

Three plugins cover everything. Run this in Claude Code (v2.1.275 or later):

```
/plugin install army --marketplace omer-yehuda/plugins
/plugin install studio --marketplace omer-yehuda/plugins
/plugin install skill-installer --marketplace omer-yehuda/plugins
```

<details>
<summary>Older Claude Code versions</summary>

```
/plugin marketplace add omer-yehuda/plugins
/plugin install army@omer-plugins
/plugin install studio@omer-plugins
/plugin install skill-installer@omer-plugins
```
</details>

Restart Claude Code (or run `/reload-plugins`), then type:

```
raise the army build a landing page for my habit-tracking app
put it on trial: should we move from REST to GraphQL?
admit this bug: checkout total is off by one cent
let the critics taste it
mission control, are we go?
newsroom, write the edition
studio, make a video about what a Claude skill is
make me an animated short about the man who sold the Eiffel Tower
studio, make a film about the last lighthouse keeper
install the pdf skill from anthropics/skills
/skill-installer:audit
```

To update later, run `/plugin marketplace update omer-plugins`.

## Plugin catalog

| Plugin | What it does | Version |
|---|---|---|
| [**army**](plugins/army/README.md) | **Get work done.** A Chief of Staff commands 18 specialist units (intel, engineering, defense, legal, comms, data, sales and more) as subagents, backed by 110 on-demand field manuals. Plus 8 **drills** you can run on their own: `trial` (a decision goes to court, an independent judge rules), `admit` (bug ER: regression test first, smallest fix), `taste` (three critics and a star rating), `countdown` (release go or no-go), `exam` (a skill tested with and without it), `recall` (search every record), `edition` (release notes and posts, fact-checked) and `lanes` (parallel sessions claim files). Safety gates, least-privilege kits, cost-aware routing, local memory. | 2.0.0 |
| [**studio**](plugins/studio/README.md) | **Make video.** An AI film crew in three formats. **Explainer:** a topic becomes a kinetic-typography MP4 (vertical or wide) with AI narration and emotion; the trend desk films a tool from real screenshots. **Toon:** a true story becomes a voiced cartoon short with original characters, parallax sets and Hebrew RTL karaoke captions. **Film:** director, cinematographer and continuity agents make a realistic short from stills you generate. One hash-locked venv, one voice model. | 2.0.0 |
| [**skill-installer**](plugins/skill-installer/README.md) | **Install skills safely.** Every skill is scanned by Customs before it lands (CLEARED installs, SECONDARY INSPECTION asks, DENIED never installs), every file comes from one pinned commit, `skills.lock.json` records hashes and `/skill-installer:audit` rescans what you have. `/skill-installer:inspect` gives the full passport for any skill or plugin. A first filter, not a guarantee. | 2.0.0 |

<details>
<summary>Moved in November 2026 (old plugins are stubs for one release)</summary>

| Old plugin | Now |
|---|---|
| court, er, critics, mission-control, academy, archive, newsroom, atc | army drills: `/army:trial`, `/army:admit`, `/army:taste`, `/army:countdown`, `/army:exam`, `/army:recall`, `/army:edition`, `/army:claim` and their siblings |
| toon-shorts, premiere | studio: `/studio:toon`, `/studio:pitch` · `shoot` · `cut` · `dailies` |
| customs | skill-installer: `/skill-installer:inspect`, `/skill-installer:manifest`, and it gates every install |

Each old plugin still installs, and its commands tell you where they moved. They will be removed in the next release.
</details>

---

## Featured: Army

> Give Claude a mission, not a prompt.

Say **"raise the army"** and Claude becomes a Chief of Staff. It asks its briefing questions once, writes an operation order, and dispatches specialist units in parallel, each on the most cost-effective model for its job. An independent Inspector General checks the result against your requirements before anything is reported back.

[![A mission playing out in the command center](docs/images/mission.gif)](https://omer-yehuda.github.io/plugins/)

```mermaid
flowchart LR
    U([You]) -->|mission| HQ{{Chief of Staff}}
    HQ -->|briefing questions, once| U
    HQ --> R[Recon]
    HQ --> O[Ops & Planning]
    HQ --> I[Intel]
    HQ --> E[Engineering]
    HQ --> D[Defense]
    HQ --> L[Legal]
    HQ --> C[Comms]
    HQ --> X[Data · UX · Logistics · Treasury · Growth · Sales · Rescue · R&D · Special Ops]
    R & O & I & E & D & L & C & X -->|SITREP| HQ
    HQ --> IG[Inspector General]
    IG -->|verdict| HQ
    HQ --> H[History: lessons learned]
    HQ -->|final report| U
```

### Watch

- [Stop Prompting Claude. Give It a Mission.](https://www.youtube.com/shorts/h9i1ZHay0JE) (YouTube Short)
- [14 AI Units. 1 Command. (Claude Code Army)](https://www.youtube.com/shorts/2X-fzvEffys) (YouTube Short, recorded with v1.0's 14 units)

### See it

| | |
|---|---|
| [![The operations table at the safety gate](docs/images/hero-gate.png)](https://omer-yehuda.github.io/plugins/) | [![Order of battle with shoulder patches](docs/images/order-of-battle.png)](https://omer-yehuda.github.io/plugins/#units) |
| **The mission:** a live operations table. HQ deploys units, then holds at the safety gate for your authorization | **Order of battle:** 18 units as shoulder patches; the rank stars follow the Lean/Full rations switch |
| [![Classified personnel file](docs/images/dossier.png)](https://omer-yehuda.github.io/plugins/?unit=defense) | [![Rules of engagement](docs/images/rules.png)](https://omer-yehuda.github.io/plugins/#roe) |
| **Personnel files:** each unit's assignment, kit, doctrine and every field manual | **Rules of engagement:** safety gates, local memory and token rations, stated honestly |

### Highlights

- **18 specialist units, 110 specialist playbooks:**
  - Research: competitor research, verification and wargames.
  - Code: bug hunting, unit and E2E testing, AI feature engineering.
  - Security: OWASP review, secrets scanning, hardening and AI security.
  - Legal: OSS licenses, privacy law, consumer law and contract review.
  - Text: UX copy and Hebrew/RTL localization.
  - Operations and market: CI/CD, SEO/ASO, data analysis, sales and support.
- **Self-improving:** the R&D unit proposes new skills and playbooks from recurring lessons, and you approve every change.
- **Cost-aware model routing:** a `lean` profile for the Pro plan (Sonnet and Haiku only) and a `full` profile for the Max plan (Opus for critical units). Switch with `/army:mode`.
- **Token discipline by design:** units write full reports to disk and return SITREPs of at most 200 words. Recon stays fresh until manifests change, and field manuals load only on demand. Campaigns and Turbo show a dispatch preview before launching.
- **Safety gates, bound to your mission:** a session-scoped `PreToolUse` hook tokenizes commands and asks before:
  - pushes, deletions, deploys and publishing
  - destructive SQL, `curl | sh` and downloaded packages
  - new dependencies, GitHub writes and external MCP actions
  - any attempt to switch itself off

  It's a speed bump, not a sandbox.
- **Least-privilege units:** research and planning units can't run a shell or edit code. Every unit ignores instructions embedded in files and web pages, and reports them instead.
- **Learns per project:** `.army/lessons.md` is read as data at the start of every mission, capped at 100 lines, and shown to you as a diff. It is never committed or packed, and a repository can't plant it.
- **Turbo mode:** `raise the entire army` (or `all units on board`) engages every unit.

See the full documentation in [plugins/army/README.md](plugins/army/README.md).

---

## Featured: Studio toon

> One conversation, one finished cartoon short.

Say **"make me an animated short"**. Claude asks a few questions, pitches 10 true-story ideas, writes a 30-60 second script built to hold attention, voices it, storyboards original toon characters on parallax sets, **checks its own preview frame by frame**, and renders the MP4 with a ready-to-paste title, description and hashtags.

[![Frames from the bundled example, last tile in Hebrew](docs/images/toon-shorts.png)](plugins/studio/docs/toon.md)

- **Original characters:** 12 moods, 11 poses, 6 skin tones, and a wardrobe of hats, outfits and 28 props.
- **20 sets with depth:** three parallax layers, 5 times of day, landmarks and foreground overlays.
- **Karaoke captions** that light up the spoken word, with correct **Hebrew right-to-left** layout.
- **Voice:** free Kokoro AI voices in 6 languages, your own recording in any language (timing snaps to your pauses), or captions only.
- **Safe by construction:** nothing installs without asking, dependencies are pinned, and the model is SHA-256 verified. No telemetry.

Run it with `/studio:toon`. Full documentation: [plugins/studio/docs/toon.md](plugins/studio/docs/toon.md).

---

## Privacy & safety

- **No telemetry.** Plugins in this marketplace send nothing anywhere on their own.
- **Local memory only.** Project memory lives in `.army/` inside your project, protected by its own `.gitignore` (`*`) and `.git/info/exclude`, so neither git nor `npm pack` includes it. Add `.army` to `.dockerignore` if you build images. Per-user settings live in Claude Code's plugin data directory.
- **Human in the loop.** Irreversible actions require your approval by default.
- **Studio installs nothing on its own.** Setup asks first, then installs into one private venv (`~/.cache/studio-plugin`) with hash-locked wheels and a SHA-256 verified voice model.
- **Defensive security only.** The red-team specialist is restricted to your own project in a local or test environment.
- The legal unit produces an automated risk review, **not legal advice**.

## Repository structure

```
.claude-plugin/marketplace.json   Marketplace catalog
plugins/
  army/
    .claude-plugin/plugin.json    Plugin manifest
    units.json                    Single source of truth: routing, tools, descriptions
    skills/                       raise · raise-all · mode · gates · status · map
    agents/                       18 unit subagents (frontmatter generated from units.json)
    doctrine/                     110 field manuals, loaded on demand
    hooks/hooks.json              Safety gate + SessionStart re-injection
    scripts/army.js               Zero-dependency control script and gate
    scripts/build-map.js          Generates the command-center map (fonts embedded)
    tests/                        Gate + lifecycle tests
    CHANGELOG.md
  court/ er/ atc/ critics/ mission-control/ academy/ archive/ newsroom/ customs/ toon-shorts/ premiere/
    Deprecated stubs: skills that point to the new commands (removed next release)
  skill-installer/
    skills/                       install · browse · audit · inspect · manifest
    scripts/si.js                 Zero-dependency installer (GitHub tree API + git fallback), gated by scripts/scan.js
    docs/SCANNER.md               The customs scanner: rules, weighting, limits
    NOTICE                        Credit: adapted from OpenAI's Apache-2.0 Codex skill-installer
  studio/
    skills/toon/                  SKILL.md · references · examples · toon engine (scripts/toonshorts)
    skills/pitch|shoot|cut|dailies/  film format; helper in scripts/premiere.js
    toon-tests/                   pytest suite for the toon engine (coverage gate 85%)
    skills/produce/               SKILL.md · examples · renderer (scripts/studiokit, Pillow + ffmpeg, Kokoro voice)
    skills/trend/                 SKILL.md · trend desk: real footage, wide video + Short
    tests/                        pytest suite
docs/                             Live site (GitHub Pages): interactive map + screenshots
evals/                            Each plugin vs. plain Claude on fixed missions
templates/plugin-template/        Scaffold for new plugins
tools/sync-army.js                Generates agent frontmatter and tables, CI drift check
.github/workflows/validate.yml    CI: manifest validation + tests
```

## Contributing a new plugin

1. Scaffold it: `cp -r templates/plugin-template plugins/<name>`
2. Edit `plugins/<name>/.claude-plugin/plugin.json` (kebab-case name, description, version).
3. Add skills (`skills/<skill>/SKILL.md`), agents (`agents/*.md`) and hooks (`hooks/hooks.json`) as needed.
4. Register it in `.claude-plugin/marketplace.json`:
   ```json
   { "name": "<name>", "source": "./plugins/<name>", "description": "..." }
   ```
5. Validate it:
   ```bash
   claude plugin validate .
   claude plugin validate plugins/<name>
   ```
6. Try it locally: `claude --plugin-dir plugins/<name>`
7. Bump `version` in `plugin.json` for every release. Users stay on a pinned version until it changes.

Plugin names must not start with `claude-` or `anthropic-`, because those prefixes are reserved.

## Development

```bash
node --test plugins/army/tests/*.test.js               # gate + lifecycle tests
for p in army skill-installer studio; do node --test plugins/$p/tests/*.test.js; done
(cd plugins/studio && python -m pytest)       # studio renderer tests (pip install -r requirements-dev.txt)
node tools/sync-army.js                       # regenerate files from units.json and standing orders
node evals/run.js                             # plugins vs. plain Claude (needs a signed-in claude CLI)
(cd plugins/studio && python -m pytest toon-tests)   # toon engine tests
claude plugin validate .                      # validate the marketplace
node plugins/army/scripts/build-map.js --out docs/index.html   # rebuild the live map after changing the army
```

CI runs all of the above on every push and pull request.

## License

[MIT](LICENSE) © 2026 Omer Yehuda, except `plugins/skill-installer` (Apache-2.0, adapted from OpenAI's Codex skill-installer; see its NOTICE).

Independent community project. Not affiliated with, sponsored or endorsed by Anthropic. Claude and Claude Code are trademarks of Anthropic, PBC.
