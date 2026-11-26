---
name: crew
description: Show the Studio film crew and the production pipeline on one screen. Use ONLY when the user runs /studio:crew.
disable-model-invocation: true
---

Show this screen and add nothing else. If the user wants to make a video, point them to `/studio:produce <topic>`.

```
STUDIO: an AI film crew
  topic in  ->  finished 1080x1920 explainer video out

  SHOWRUNNER (the main session)  asks 3 quick questions, runs the crew, makes the final cut
    1. WRITER    researches, verifies facts with URLs, writes a 30-60 s retention script
    2. DIRECTOR  turns the script into storyboard.json and makes the checker pass
    3. VOICE     optional: your own audio file, or none (captions-only is the default)
    4. EDITOR    renders a contact sheet of key frames
    5. SCREENER  test-screening critic reads the sheet, reports readability, pacing, hook
                 -> showrunner applies fixes (at most 2 loops)
    6. RENDER    video.mp4 (1080x1920, 30 fps, H.264) + captions.srt + metadata.md

Files: .studio/productions/<date>-<slug>/  (git-ignored)
Needs: Python 3.11+, ffmpeg on PATH. First run asks before creating a private venv with pinned Pillow.
Cartoon story with characters? Use /studio:toon. A realistic short film? Use /studio:pitch.
```
