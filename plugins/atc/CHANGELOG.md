# Changelog

## 1.1.0 (2026-11-23)

- Deprecated. ATC is now a drill of **army 2.0.0** (/army:claim, /army:clear, /army:radar, /army:release) with the same agents and records folder. The commands here only point there. This plugin will be removed in the next release.

## 1.0.0 (2026-11-19)

- First release.
- `gate` hook: asks before a session edits a file in another live session's lane (never auto-allows, silent on any error, zero cost without `.atc/airspace.json`).
- `SessionEnd` hook releases the session's lanes; flights also expire after 2 hours without activity.
- Skills: `/atc:claim`, `/atc:release`, `/atc:radar`, `/atc:clear`.
- Agent: `pilot` (one flight, one lane).
- `scripts/atc.js`: claim, release, radar, status, conflicts, gate, session-end. Atomic writes with a lock file; zero dependencies.
- Hardening: a git-tracked `.atc/` is treated as planted and ignored by the gate, radar and status; flights have an 8 hour hard lifetime and future or invalid timestamps count as expired; callsign and purpose are sanitized (control characters stripped, purpose capped at 80) before they appear in the ask reason or radar; purposes and globs reach the script through `--plan-file` JSON, never the shell; stale lock breaking is race-free.
