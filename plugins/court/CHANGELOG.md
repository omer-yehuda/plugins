# Changelog

## 1.1.0 (2026-11-23)

- Deprecated. Code Court is now a drill of **army 2.0.0** (/army:trial, /army:appeal, /army:docket) with the same agents and records folder. The commands here only point there. This plugin will be removed in the next release.

## 1.0.0 (2026-11-19)

- `/court:trial`: puts a decision (2 to 4 options) on trial: clerk gathers evidence, one counsel per option argues and rebuts, an independent judge rules with dissent and overturn conditions.
- `/court:appeal`: reopens a case with new evidence; the judge re-rules and shows what changed.
- `/court:docket`: lists past cases and rulings.
- `scripts/court.js` (`open`, `list`, `path`): zero dependencies; protects `.court/` with its own `.gitignore` and refuses a `.court/` tracked in git.
- Security: no user text on any command line (`open --input-file`, ids made by the script), planted-state checks on `list` and `path`, symlinked state folders refused.
