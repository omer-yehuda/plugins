# Changelog

## 1.0.0 (2026-11-22)

- `/archive:recall <question>`: a script searches the local records of other plugins, and a read-only librarian answers from the matched files with a path behind every claim. Nothing found is reported as nothing found.
- `/archive:timeline [plugin]`, `/archive:shelf`, `/archive:catalog`: dated list, what is readable, and an index written to `.archive/index.json`.
- `scripts/archive.js` and `scripts/shelves.js`: zero dependencies. Reads army, court, er, critics, customs, studio, atc, mission-control, academy, newsroom and premiere folders. One declarative entry per plugin.
- Security: read-only on every other folder. A plugin folder that is tracked in git, is a symlink or points outside the project is skipped and reported, and symlinks inside folders are ignored. The query goes through an input file, never a command line. No session hook: nothing is injected into a session unless you ask.
