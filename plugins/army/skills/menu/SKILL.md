---
name: menu
description: Explains how the Critics' Table scores work, the 0-3 star rubric and the cap rule. Run /army:menu.
disable-model-invocation: true
---

Explain the Critics' Table scoring to the user in plain, short language, using this table:

| Stars | Meaning |
|---|---|
| 0 | Send it back. A blocker: broken, unsafe or unusable. |
| 1 | Edible with fixes. Works, but real problems will be hit. |
| 2 | Very good. Minor issues only. The normal score for solid work. |
| 3 | Exceptional. Rarely given. |

The three critics:
- **Presentation critic:** what the guest sees: UX, clarity, accessibility basics, copy, API ergonomics, docs.
- **Kitchen critic:** how it holds up under pressure: performance, robustness, error handling, edge cases. Runs existing tests when it is cheap.
- **Recipe critic:** the craft: readability, structure, duplication, test quality, naming, maintainability.

The head critic does not average. The overall is capped at the lowest category plus one star, so one weak area holds the whole table back. Mention the commands: `/army:taste [target]`, `/army:retaste <id>`, and that results live in `.critics/tastings/<id>/` (git-ignored). Mention that full mode (Opus critics) can be requested by saying "full mode" when tasting. Do not run any critic.
