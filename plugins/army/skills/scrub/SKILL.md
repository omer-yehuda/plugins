---
name: scrub
description: Mission Control re-poll. Use ONLY when the user runs /army:scrub <id> or says "re-run the countdown" after fixing blocking items. Re-checks a past countdown against the repository as it is now and rules again.
argument-hint: "<countdown-id>"
disable-model-invocation: true
---

# Mission Control: scrub and re-poll

**Countdown:** $ARGUMENTS

Helper: `node "${CLAUDE_PLUGIN_ROOT}/scripts/mission-control/mission.js"` (`MC`).

1. Run `MC list` and match the id the user gave against the printed ids. Use only an id the script printed. No match: show the list and stop.
2. Run `MC path <id>` and read the old `ruling.md` and `facts.json` there. Note the old ruling, the blocking list and the `base` ref recorded in the facts.
3. Open a fresh countdown exactly as `/army:countdown` Phase 1 does, with the same title plus "recheck" and `since` set to the recorded `base` (empty when the old `baseKind` was `none`).
4. Dispatch `army:station` only for the desks that said NO-GO last time, with the same briefs, and copy nothing from the old reports. For desks that said GO, write a one-line report: "GO carried over from <old id>; not re-polled."
5. Dispatch `army:flight-director` as in Phase 3, adding the path of the old `ruling.md` so it can say what changed.
6. Show the readout from Phase 4 with one extra line: `WAS: <old ruling>  NOW: <new ruling>`.

Never fix anything yourself during a scrub, and never release.
