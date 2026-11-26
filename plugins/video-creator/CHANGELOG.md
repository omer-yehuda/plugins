# Changelog

## 1.1.0 (2026-11-26)

Cheaper on tokens, faster to render.

- **Always-loaded context cut by 86%** (6,364 to 909 characters, about 1,600 to 230 tokens in every session). The 14 style commands and `shoot`, `render`, `mix`, `restyle`, `new-style` are now typed-only (`disable-model-invocation: true`); they still work as slash commands. Spoken requests go through the one visible skill, `make`, which routes shoot, render, restyle and new-style requests.
- **One writer instead of two** for a new video: the screenwriter writes the story in the style directly, following the shared `skills/make/style-writing.md`. The style artist is now used only by `restyle`.
- **Agents read files, not pasted briefs**: `init`, `restyle` and `build` save `style.json` next to `project.json`.
- **`V build <id>`**: check, `prompts.md`, style snapshot and animatic in one call (was three).
- **Compact helper output**: one line of JSON per command (`--pretty` for humans); `styles` prints only id, name and tagline.
- **Frame check from one labelled contact sheet**: each thumbnail carries its shot number and id; full-size images are opened only when a thumbnail is not enough (at most three), instead of every image.
- **Faster renders**: shots are encoded in parallel, unchanged shots are reused on re-render (`shotsReused`), the per-shot pass is a fast near-lossless intermediate, and the final encode uses x264 `faster`. Six 4-second 1080x1920 shots: first render 132 s to 65 s, re-render after one edit 129 s to 38 s (4-core machine).
- Style command bodies are one line; the style details come from `style.json` instead of being repeated in each command.

## 1.0.0 (2026-11-26)

- 14 style commands generated from one style-pack file: `voxel` (blocky voxel world), `3d-realistic`, `3d-cartoon`, `anime`, `claymation`, `pixel-art`, `low-poly`, `comic`, `watercolor`, `cyberpunk`, `paper-cutout`, `documentary`, `noir`, `horror`.
- `/video-creator:make <style> <idea>`: a screenwriter writes a hook-first, looping shot list; a style artist writes the character and world and translates every shot into the style's vocabulary. The style blocks are joined into each prompt by code, word for word.
- `/video-creator:mix a+b`, `/video-creator:restyle <id> <style>`, `/video-creator:new-style <description>` (custom packs in `.video-creator/styles/`).
- Free animatic: palette cards with the real timing, moves, transitions, captions and music bed, rendered in seconds with no model.
- `/video-creator:shoot`: stills and clips from the model you choose (yourself, a connected generator tool, or your browser), hero gate, contact sheet and a frame checker that rules KEEP or REDO.
- `/video-creator:render [--draft] [--burn]`: per-style fps (12 for claymation and pixel art), grade, texture filters (pixelate, scanlines, glitch, posterize, grain, handheld, jitter, paper, bars), 16 transition types, synthesized royalty-free music bed per style, voice and music files, loudness for social, captions burned in or as SRT. Platforms: Shorts/TikTok/Reels 9:16, YouTube 16:9, square 1:1, feed 4:5.
- Security: no user text on any command line, ffmpeg run without a shell on relative paths inside the project, media names derived from validated shot ids, planted-state and symlink checks, no network calls.
