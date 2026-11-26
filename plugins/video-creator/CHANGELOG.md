# Changelog

## 1.0.0 (2026-11-26)

- 14 style commands generated from one style-pack file: `minecraft` (blocky voxel fan style), `3d-realistic`, `3d-cartoon`, `anime`, `claymation`, `pixel-art`, `low-poly`, `comic`, `watercolor`, `cyberpunk`, `paper-cutout`, `documentary`, `noir`, `horror`.
- `/video-creator:make <style> <idea>`: a screenwriter writes a hook-first, looping shot list; a style artist writes the character and world and translates every shot into the style's vocabulary. The style blocks are joined into each prompt by code, word for word.
- `/video-creator:mix a+b`, `/video-creator:restyle <id> <style>`, `/video-creator:new-style <description>` (custom packs in `.video-creator/styles/`).
- Free animatic: palette cards with the real timing, moves, transitions, captions and music bed, rendered in seconds with no model.
- `/video-creator:shoot`: stills and clips from the model you choose (yourself, a connected generator tool, or your browser), hero gate, contact sheet and a frame checker that rules KEEP or REDO.
- `/video-creator:render [--draft] [--burn]`: per-style fps (12 for claymation and pixel art), grade, texture filters (pixelate, scanlines, glitch, posterize, grain, handheld, jitter, paper, bars), 16 transition types, synthesized royalty-free music bed per style, voice and music files, loudness for social, captions burned in or as SRT. Platforms: Shorts/TikTok/Reels 9:16, YouTube 16:9, square 1:1, feed 4:5.
- Security: no user text on any command line, ffmpeg run without a shell on relative paths inside the project, media names derived from validated shot ids, planted-state and symlink checks, no network calls.
