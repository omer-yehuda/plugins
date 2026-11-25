# Changelog

## 1.1.0 (2026-11-23)

- Deprecated. The Critics' Table is now a drill of **army 2.0.0** (/army:taste, /army:retaste, /army:menu) with the same agents and records folder. The commands here only point there. This plugin will be removed in the next release.

## 1.0.0 (2026-11-19)

- `/critics:taste`: three independent critics (presentation, kitchen, recipe) score your work 0-3 stars, a head critic merges the cards into one review.
- `/critics:retaste <id>`: critics re-check only their send-back items and show stars before -> after.
- `/critics:menu`: explains the rubric.
- `scripts/critics.js`: `open`, `list`, `stars` (zero dependencies, protects `.critics/` with its own `.gitignore`).
- Security: no user text on any command line (`open --input-file`, ids made by the script), planted-state checks on `list` and `stars`, symlinked state folders refused.
