---
name: shoot
description: Get one image or clip per shot into a Video Creator project from your model, hero shot first, then a frame check.
disable-model-invocation: true
argument-hint: "<project-id>"
---

# Video Creator: shoot

**Project:** $ARGUMENTS

Helper: `node "${CLAUDE_PLUGIN_ROOT}/scripts/vc.js"` (`V`). The house rules in `${CLAUDE_PLUGIN_ROOT}/skills/make/SKILL.md` apply.

Video Creator has no image or video model inside. The media comes from the model the user chooses. Your job is to get the right file into the right place and to stop bad frames.

## Step 1: Where are we

Run `V list` and match the id the user gave against the printed ids; use only an id the script printed. Run `V check <id>`. If there are `errors`, show them and stop. `missing` lists the shots that still need an image or clip. If nothing is missing, go to Step 4.

## Step 2: Choose the camera (once)

Ask with AskUserQuestion "How do you want to make the images and clips?":
- **I will make them myself (Recommended)**: any image or video tool. You get `prompts.md` and the file names.
- **Use a connected generator**: offer this only when the session has an MCP tool that generates images or video (for example a Hugging Face Space tool). Use the image prompt from `prompts.md` exactly, at the platform's aspect ratio.
- **Use my browser**: offer this only when the session has a browser tool. Claude operates the image or video site the user names, in their signed-in browser.

Before any of them, remind the user once: check the model's licence and skip models marked non-commercial if the video will be published or monetised.

Stills and clips can be mixed freely. A clip (`media/<id>.mp4`) beats a still with the same id. A good path for motion: make the still first, approve it, then feed it to an image-to-video model with the shot's video prompt.

- **Myself:** give the path of `prompts.md` and the `media/` folder. Say: make the FIRST shot only, save it under its exact name, and tell me. Wait.
- **Connected generator:** generate the first shot only, then save the result into `media/` under its exact name.
- **Browser:** follow the browser's own skill for every browser step. Ask which site to open (a URL the user gives; do not pick one). Every download needs the user's explicit yes, with the file name and where it comes from. If the site reports a quota or a limit, stop and say how many shots are done; never try another account or another route.

## Step 3: The hero gate

When the first shot exists, look at it yourself (Read the image; for a clip, run `V sheet <id>` and read `sheet.jpg`). Ask: **This is the look, continue** · **Regenerate with changes** · **Change the style** (follow `${CLAUDE_PLUGIN_ROOT}/skills/restyle/SKILL.md`).

Do not make the remaining shots until the user approves the hero. Then make them the same way, one file per shot, exact names.

## Step 4: The frame check

Run `V sheet <id>` (one labelled contact sheet of every shot). Dispatch ONE `video-creator:frame-checker` with `model: "sonnet"`. Brief: the project folder path and the output path `<dir>/frames.md`; it reads `style.json`, `project.json` and `sheet.jpg` there.

Read `frames.md` and show a table: shot, verdict (KEEP or REDO), reason. For each REDO give the corrected prompt it suggests. At most two redos per shot; after that the user keeps it or cuts the shot.

When every shot is KEEP, tell the user the next step is `/video-creator:render <id>`.
