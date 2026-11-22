---
name: shoot
description: Premiere shoot. Use ONLY when the user runs /premiere:shoot or says "premiere, shoot it". Gets one generated still per shot into the production, hero still first with the user's approval, then has continuity review every frame. Never trigger on its own.
argument-hint: "<production-id>"
---

# Premiere: the shoot

**Production:** $ARGUMENTS

Helper: `node "${CLAUDE_PLUGIN_ROOT}/scripts/premiere.js"` (`P`). The house rules in `/premiere:pitch` apply.

Premiere does not contain an image model. The stills come from the image model the user chooses. Your job is to get the right file into the right place and to stop bad frames.

## Step 1: Where are we

Run `P list` and match the id the user gave against the printed ids; use only an id the script printed. Run `P check <id>`. If it is not ok, show the errors and stop. `missing` lists the stills that still have to be made. If nothing is missing, go to Step 4.

## Step 2: Choose the camera (once)

Ask with **AskUserQuestion** "How do you want to generate the stills?":
- **I will generate them myself (Recommended)**: any image tool. You get the prompts and the file names.
- **Use my browser**: only offer this when the session has a browser tool. Claude operates the image tool the user names, in their signed-in browser.

Before either, remind the user of one thing: check the image model's licence. Skip models marked non-commercial if the film will be published or monetised.

### I will generate them myself

Give the user the path of `prompts.md` and the `stills/` folder. Say: generate the FIRST shot only, save it under its exact file name, and tell me. Wait.

### Use my browser

Follow the browser's own skill for every browser step. Ask which image tool to open (a URL the user gives; do not pick one for them). Generate the first shot only, with the prompt exactly as written in `shots.json` and the aspect ratio of the production. Downloading a file needs the user's explicit yes each time: state the file name and where it comes from. Save it into `stills/` under its exact name. If the tool reports a quota or a limit, stop and say how many stills are done; never try another account or another route.

## Step 3: The hero gate

When the first still exists, look at it yourself (Read the image) and show the user where it is. Ask: **This is the character and the look, continue** · **Regenerate with changes** · **Change the look** (back to the cinematographer, which rewrites every prompt).

Do not make the remaining stills until the user approves the hero. Changing the character later means redoing every shot.

Then get the remaining stills the same way, one file per shot, exact file names.

## Step 4: Dailies and continuity

Run `P dailies <id>`. Dispatch ONE `premiere:continuity` with `model: "sonnet"`. Brief: the paths of `shots.json`, `look.md`, `dailies.jpg` and the `stills/` folder, and the output path `<dir>/continuity.md`.

Read `continuity.md` and show the user a table: shot, verdict (KEEP or RESHOOT), reason. For each RESHOOT, give the corrected prompt the report suggests. At most two reshoots per shot; after that the user decides to keep it or cut the shot.

When every still is KEEP, tell the user the next step is `/premiere:cut <id>`.
