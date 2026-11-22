# Changelog

## 1.1.0 (2026-11-23)

- Deprecated. The scanner, officer, inspect and manifest moved into **skill-installer 2.0.0** (`/skill-installer:inspect`, `/skill-installer:manifest`). The commands here only point there. This plugin will be removed in the next release.

## 1.0.0 (2026-11-19)

- `/customs:inspect`: locate (path, GitHub URL or installed plugin), static scan, officer review, passport (CLEARED, SECONDARY INSPECTION, DENIED) and a saved report in `.customs/reports/`.
- `/customs:manifest`: fast inventory of what a package declares, no verdict.
- `officer` agent: read-only semantic review (hidden actions, exfiltration, safety overrides, promise vs behaviour).
- Zero-dependency scanner: remote code, obfuscation, hidden text, prompt injection, credential access, exfiltration, destructive commands, persistence, hooks, MCP and manifest checks. Never executes or follows anything it scans.
- Hardening (found by the AEGIS review before release): no package or user text is ever placed in a shell command (`--target-file` flow, scanner-derived output names); strict GitHub URL grammar and a hardened clone in `fetch.js`; the officer has no Write tool; scanner bypasses closed (NUL bytes, per-rule cap, tests and `.customs` folders, oversize files, comment tricks, detector tricks, long lines, file-count cutoff, scanner errors); linear-time scanning (4 KB windows, bounded patterns); prompt-injection findings can no longer be softened by claims inside the text; control characters in snippets are escaped.
- Second hardening pass (AEGIS verification): remote-code forms that used to be CLEARED are now caught (pipe into any interpreter by any path or wrapper, `sh -c "$(curl ...)"`, process substitution, download then run, line continuations, hex or unicode escapes, string concatenation, base64 decode-and-run, network plus execution in one wired script, reassigned `RegExp`/`String` built-ins); fenced remote-code examples in skills are never softened below HIGH; docs that skills point at keep agent severity.
- Planted-state defenses: `locate.js prep` makes a private temp input folder (`--target-file` is accepted only there); the store refuses tracked or symlinked `.customs`, `scans/`, `reports/`; all writes refuse symlinks; only the prep folder is ever deleted.
