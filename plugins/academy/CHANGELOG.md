# Changelog

## 1.1.0 (2026-11-23)

- Deprecated. The Academy is now a drill of **army 2.0.0** (/army:enroll, /army:exam, /army:transcript) with the same agents and records folder. The commands here only point there. This plugin will be removed in the next release.

## 1.0.0 (2026-11-22)

- `/academy:enroll <path>`: enrols a plugin skill and has an examiner draft 3 to 5 missions (task, trigger, no-trigger, safety) with fixtures and checks. Runs nothing.
- `/academy:exam <id>`: after an explicit yes, runs every mission twice in headless Claude Code (plain, then with `--plugin-dir`), and shows GRADUATED, RETAKE or EXPELLED with pass rate, tokens, cost, turns and time.
- `/academy:transcript [id]`: lists exams or prints a report card as a markdown table.
- `scripts/academy.js` and `scripts/exam.js`: zero dependencies. The grade is computed by the script, not by a model. An exam that plain Claude Code passes completely is reported as too easy, not as a pass.
- Security: no user text on any command line (`enroll --input-file`, ids made by the script, prompts sent on stdin), the skill path must stay inside the project, runs happen in temporary copies with a local bare origin, planted-state checks, symlinked state refused. `cmd` checks are shell commands and are shown to the user before any run.
- Based on the repository's own `evals/run.js` harness.
