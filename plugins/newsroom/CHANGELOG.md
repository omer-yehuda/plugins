# Changelog

## 1.0.0 (2026-11-22)

- `/newsroom:edition [since-ref]`: a reporter reads the commits and files, an editor writes release notes, a changelog draft, X and LinkedIn posts, YouTube metadata and a video brief, and a fact-checker writes corrections. One correction round, then the drafts are handed over.
- `/newsroom:headline <unit>`: the same for one plugin or package.
- `/newsroom:wire`: lists past editions.
- `scripts/newsroom.js` (`prep`, `open`, `facts`, `check`, `list`): zero dependencies. `facts` groups commits by unit and reads each version before and after. `check` fails a draft that cites a commit outside the release, has a claim with no commit, has an X post over 280 characters, or has metadata that would be rejected.
- Security: no user text on any command line, refs validated before git sees them, git run without a shell, planted-state checks, symlinked state refused. Drafts only: it never posts, tags or pushes.
