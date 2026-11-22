---
name: headline
description: The Newsroom, one plugin or package only. Use ONLY when the user runs /newsroom:headline <unit> or says "newsroom, a headline for <unit>". Writes a title, one paragraph and one post for what changed in that unit since the last tag, fact-checked against the commits.
argument-hint: "<plugin or package name>"
---

# The Newsroom: one headline

**Unit:** $ARGUMENTS

Follow `/newsroom:edition` with these differences:

- In Phase 1 write `"unit": "<the name the user gave>"` in the input file and leave `since` empty. `no-such-unit` means nothing changed there in this range: say so and stop.
- In Phase 3 brief the editor to write ONLY `release-notes.md` (a headline, one paragraph, then the cited changes), `posts.md` (one X post and one LinkedIn post) and `sources.md`.
- Phases 4 and 5 are unchanged. The house rules apply in full.
