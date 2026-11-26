# Skill Installer

> **Every skill is scanned before it lands. A first filter, not a guarantee.** Not affiliated with or endorsed by Anthropic.

**Install Claude skills from GitHub the safe way: a customs scan gates every install, every file comes from one pinned commit, and a lockfile lets you audit later.**

```
/plugin install skill-installer --marketplace omer-yehuda/plugins
```

Then just ask:

```
install the frontend-design skill from anthropics/skills
/skill-installer:install https://github.com/anthropics/skills/tree/main/skills/pdf
/skill-installer:browse                      # skills in anthropics/skills, installed ones marked
/skill-installer:browse market               # every plugin in this marketplace, with install lines
/skill-installer:inspect https://github.com/<owner>/<repo>   # full passport: scanner plus officer agent
/skill-installer:audit                       # rescan everything you have installed
```

Customs used to be a separate plugin. It now lives here: the same scanner, the same `/skill-installer:inspect` passport, and it now runs on every install.

## What it does

| Step | What happens |
|---|---|
| Browse | Lists every folder with a `SKILL.md` in a repo (default `anthropics/skills`) and marks the ones you already have. `browse market` lists a plugin marketplace (default `omer-yehuda/plugins`). |
| Pin | Resolves the branch or tag to one commit first. The file list and every file download come from that commit, so a push in the middle of an install cannot slip a different file in. |
| Scan (the gate) | The [customs scanner](docs/SCANNER.md) reads every file without running anything. **CLEARED** installs. **SECONDARY INSPECTION** shows the findings and installs only if you say so. **DENIED** never installs. A scanner error counts as SECONDARY INSPECTION, never CLEARED. |
| Install | Writes to a temp folder, then renames it into place: never a half-installed skill. Updating keeps the old copy as `.name.backup-<time>` and first shows which files were added, removed or changed. |
| Lock | Records source, path, commit, per-file SHA-256 hashes, the verdict and whether you accepted findings in `skills.lock.json` next to the skills. A project lockfile can be committed and reviewed. |
| Audit | `/skill-installer:audit` rescans every installed skill (including ones installed some other way) and compares the files with the lockfile, so an edit made after install shows up. Read only. |
| Inspect | `/skill-installer:inspect` gives the full passport for any local path, GitHub URL or installed plugin: scanner plus a read-only officer agent that judges intent, with a saved report. `/skill-installer:manifest` lists what a package declares, no verdict. |

Where skills go: `~/.claude/skills/<name>` (or `CLAUDE_CONFIG_DIR/skills`) by default, `<project>/.claude/skills/<name>` when you say "project only". Restart Claude Code or run `/reload-plugins` afterwards. Plugins are installed with `/plugin install`, not with this skill.

## Why the gate matters

Public skill registries have had real malware: audits in 2026 found hundreds of malicious skills, some padded past scanner size limits to slip through. This scanner treats a file it cannot read in full as a finding (`TRUNCATED`), never as clean, and scans hooks, skills and scripts first so a file-count cutoff cannot hide them. See [SCANNER.md](docs/SCANNER.md) for every rule, the weighting and what it cannot catch.

## Tested

Run on 2026-11-19 against the public `anthropics/skills` repo (before the gate was added):

| Test | Result |
|---|---|
| Browse `anthropics/skills` | 19 skills listed with descriptions |
| Install `frontend-design` | 2 files, 0.8 s |
| Install `pdf`, `docx`, `xlsx` in one go | 126 files, 5.4 s |
| Same skill again | refused ("Already installed"), update keeps a backup |
| Typo `fronted-design` | "Did you mean skills/frontend-design?" |
| Private repo / API limit | falls back to a sparse git clone (13-file skill in 3.9 s) |

Offline tests cover the gate (CLEARED installs, SECONDARY needs `accept`, DENIED never installs), the lockfile, update diffs and audit: `node --test plugins/skill-installer/tests/*.test.js`.

## Safety

- Only `https://github.com` sources. Owner, repo, branch and paths are checked (no `..`, no absolute paths, no option-looking branches).
- User text never reaches the shell: the skills write a request file and the scripts read it.
- Symlinks and submodules are refused; a skill is capped at 300 files and 10 MB.
- Nothing from a downloaded skill is ever run. Scanning copies the files into a private temp folder, reads them as text and deletes the folder. The git fallback runs with hooks and symlinks off and no prompts.
- `GITHUB_TOKEN` or `GH_TOKEN` is used for the GitHub API when set (private repos, higher limits).

Behind a proxy, set `NODE_USE_ENV_PROXY=1` (Node 22.21+); otherwise the git fallback is used.

## Credits

The installer is adapted from the `skill-installer` skill that ships with OpenAI Codex ([openai/skills](https://github.com/openai/skills), Apache-2.0). The scanner and officer were written for the Customs plugin. See [NOTICE](NOTICE). Licensed under Apache-2.0 ([LICENSE](LICENSE)).

Not affiliated with, sponsored or endorsed by OpenAI or Anthropic.
