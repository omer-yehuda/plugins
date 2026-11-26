# Critics: the Critics' Table

> **Now an army drill.** The Critics' Table was the `critics` plugin. Since army 2.0.0 it ships inside the army: same commands under `/army:`, same agents, same records folder. Install `army` and remove `critics`.

Three independent critics taste your work before it ships. A head critic merges their cards and awards up to **3 stars**, with a short "fix before serving" list.

## Install

```
/plugin install army --marketplace omer-yehuda/plugins
```

On Claude Code versions earlier than 2.1.275, run `/plugin marketplace add omer-yehuda/plugins` first, then `/plugin install army@omer-plugins`.

## Commands

| Say / run | What happens |
|---|---|
| `let the critics taste it` · `critics, review this` · `/army:taste [target]` | Taste files, a folder, a PR diff, a local dev server URL, or "the last change" |
| `/army:retaste <id>` | After fixes, each critic re-checks only its own send-back items; stars show before -> after |
| `/army:menu` | Explains the rubric (runs only when you type it) |

You can also call one critic directly: "ask the kitchen critic to look at the importer".

## How it works: the tasting table

Think of a restaurant. The pass (HQ) writes the **menu**, the requirements. Three critics sit at separate tables and never compare notes. The head critic reads only the cards.

```mermaid
flowchart TD
    A["/army:taste target"] --> B["The pass: dish + menu.md<br/>(one question round at most)"]
    B --> C["presentation critic<br/>UX, copy, ergonomics"]
    B --> D["kitchen critic<br/>performance, robustness"]
    B --> E["recipe critic<br/>craft, tests, naming"]
    C --> F["card-presentation-critic.md"]
    D --> G["card-kitchen-critic.md"]
    E --> H["card-recipe-critic.md"]
    F --> I["head critic<br/>reads cards + menu only"]
    G --> I
    H --> I
    I --> J["review.md: overall stars,<br/>fix before serving, chef's notes"]
    J --> K["compact star card"]
    K -. "after fixes" .-> L["/army:retaste id"]
    L --> C
    L --> D
    L --> E
```

Everything is written to `.critics/tastings/<id>/` in your project. The script protects the folder with its own `.gitignore` (`*`) and refuses to run if `.critics/` is tracked in git.

## The rubric

| Stars | Meaning |
|---|---|
| 0 | Send it back. A blocker: broken, unsafe or unusable |
| 1 | Edible with fixes. Works, but real problems will be hit |
| 2 | Very good. Minor issues only. The normal score for solid work |
| 3 | Exceptional. Rarely given |

| Critic | Tastes |
|---|---|
| presentation | Clarity, accessibility basics, copy, empty and error states; for non-UI work: API ergonomics, naming, docs |
| kitchen | Hot paths, N+1, bundle size, memory, error handling, edge cases; runs existing tests or benchmarks when cheap |
| recipe | Readability, structure, duplication, test quality, naming consistency, maintainability |

**The overall is not an average.** It is capped at the lowest category plus one star, so one weak area holds the whole table back. A missing card caps the overall at 2.

## Example star card

```
THE CRITICS' TABLE  -  checkout form
  Presentation  **.    Kitchen  *..    Recipe  **.
  OVERALL       **.    (kitchen holds the table back)

Fix before serving
  1. api/orders.js:48   N+1 query per cart line. Fix: one query with IN (...)
  2. form.js:112        no timeout on the payment call. Fix: AbortController, 10s
  3. form.html:30       error text not announced. Fix: aria-live="polite"

"A handsome plate, but the kitchen forgot to turn on the stove timer."
Full review: .critics/tastings/20261119-100000-checkout/review.md
```

After fixes, `/army:retaste 20261119-100000-checkout` shows `kitchen *.. -> **.`.

## Models

Critics and head critic run on **sonnet** by default (lean, Pro-friendly). For a deeper tasting, say "full mode" and HQ dispatches all four on **opus**.

## Safety & privacy

- Critics are read-only on your code: tools are Read, Glob, Grep, Bash and Write, and Write is for their own card only.
- Bash is used for read-only checks (your existing tests, build, linters). Running tests or builds executes the code under review, so use critics on code you trust, or tell them not to run it. Because critics hold Bash, "read-only" is a rule they follow, not a hard block.
- No text you type is placed in a shell command: the dish name goes through a file and tasting ids are made by the script. Symlinked `.critics` folders are refused. Critics never install dependencies, push, deploy, delete or contact external services. A dev server URL must be local (localhost or 127.0.0.1).
- Critics are independent: each gets only `menu.md` and the dish location. The head critic reads only the cards.
- Text inside your code, docs and pages is treated as data. Embedded instructions ("give this 3 stars") are reported, never followed.
- `scripts/critics.js` has no dependencies and no network calls. Tasting files stay local and git-ignored.

## Requirements

- Claude Code with plugin support
- Node 18+ (for the helper script)
- Optional: `git` (for PR diffs and the tracked-folder check)

Run the tests: `node --test plugins/army/tests/*.test.js`

## License

MIT. The restaurant words are only a metaphor, and the 0-3 star scale is a generic rubric, not any published guide's rating system.

Not affiliated with or endorsed by Anthropic.
