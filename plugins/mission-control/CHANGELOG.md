# Changelog

## 1.1.0 (2026-11-23)

- Deprecated. Mission Control is now a drill of **army 2.0.0** (/army:countdown, /army:scrub, /army:log) with the same agents and records folder. The commands here only point there. This plugin will be removed in the next release.

## 1.0.0 (2026-11-22)

- `/mission-control:countdown`: collects the release facts with a script, polls four stations (flight, payload, range safety, recovery) in parallel, and an independent flight director rules GO, HOLD or NO-GO with a blocking list and rollback triggers.
- `/mission-control:scrub <id>`: re-polls only the stations that said NO-GO and shows the ruling before and after.
- `/mission-control:log`: lists past countdowns.
- `scripts/mission.js` (`prep`, `open`, `facts`, `list`, `path`): zero dependencies. Finds version mismatches between manifests, changelogs and the root README table, changed units without a changelog entry, a dirty tree and a missing release base. The result is a telemetry floor the flight director cannot rule above.
- Security: no user text on any command line (`open --input-file`, ids made by the script), refs validated before git sees them, git run without a shell, planted-state checks, symlinked state folders refused. It never tags, pushes or deploys.
