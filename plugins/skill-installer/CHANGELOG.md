# Changelog

## 2.0.0 (2026-11-23)

- **Customs merged in.** The customs scanner, the officer agent, `/skill-installer:inspect` and `/skill-installer:manifest` (formerly `/customs:inspect` and `/customs:manifest`) now ship in this plugin. Scanner docs: [SCANNER.md](docs/SCANNER.md).
- **Install gate.** Every skill is scanned before it is written. CLEARED installs; SECONDARY INSPECTION installs only with `"accept": true` after the user agrees; DENIED never installs. Scanner errors count as SECONDARY INSPECTION.
- **Pinned commits.** The branch or tag is resolved to one commit, and the tree and every file are read from it (closes a window where a push during an install could change files after the listing).
- **`skills.lock.json`.** Source, path, commit, per-file SHA-256, verdict and acceptance for every install.
- **Update diffs.** Reinstalling shows `previousCommit` and the files added, removed and changed.
- **`/skill-installer:audit`.** Rescans every installed skill and compares it with the lockfile. Read only.
- Breaking: an install that used to succeed with only warnings now stops for approval when the scanner says SECONDARY INSPECTION.


## 1.0.0 (2026-11-20)

- `/skill-installer:install`: install one or more skills from a GitHub URL or `owner/repo/path` into `~/.claude/skills` or the project's `.claude/skills`, dry run first, quick risk check, atomic copy, backup on update.
- `/skill-installer:browse`: list the skills in a repo (default `anthropics/skills`) or the plugins in a marketplace (default `omer-yehuda/plugins`), marking installed ones.
- "Did you mean" for wrong skill paths.
- Dependency-free Node.js; GitHub tree API plus raw files, sparse git clone fallback.
- Adapted from OpenAI's Apache-2.0 Codex `skill-installer` (see NOTICE).
