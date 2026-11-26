# Changelog

## 1.1.0 (2026-11-23)

- Deprecated. Bug ER is now a drill of **army 2.0.0** (/army:admit, /army:chart) with the same agents and records folder. The commands here only point there. This plugin will be removed in the next release.

## 1.0.0 (2026-11-19)

- `/er:admit`: four-step ER flow (triage nurse, attending, surgeon, discharge) with an incision budget (default 3 files / 40 changed lines, tests excluded).
- `/er:chart [id]`: show past charts.
- `scripts/er.js`: `admit`, `list`, `show` and `incision`, zero dependencies, with tests on temporary git repos.
- `.er/` is private: it carries its own `.gitignore` and `admit` refuses to run if `.er/` is tracked in git.
- Security: no user text on any command line (`admit --input-file`, ids made by the script), planted-state checks on `list` and `show`, symlinked state folders refused.
