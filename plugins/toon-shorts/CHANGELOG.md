# Changelog

## 1.2.0 (2026-11-23)

- Deprecated. Toon Shorts moved into **studio 2.0.0** (/studio:toon) with the same engine and crew. The commands here only point there. This plugin will be removed in the next release.

## 1.1.0 (2026-11-21)

### Added
- `cuts`: split one spoken line into several shots, each with its own camera move and focus, on the same set. Fast story Shorts cut about 27 times a minute in the opening; one shot per sentence was about 15.
- Pacing checks: `check` estimates shots per minute from word counts and flags a slow opening (fewer than 4 shots in the first 10 s), a whole video under 20 shots a minute, and any shot over 4 s. `preview` and `render` print the real numbers (`PACE:` lines) from the voice timing.
- Cold open checks: the hook line should be 9 words or fewer, and the first frame should already show the payoff (no late props or entrances in scene 0).
- Consistent characters: `check` flags a scene that changes a character's skin, hair, outfit colour or glasses from the character sheet, unless that cast entry says `"costume": true`.
- Action sounds: every on-screen action gets its own short synthesized sound on the frame it happens: pop-in, slide-in whoosh, a sting when someone turns shocked or scared, a thud on anger, soft footsteps for walk and run. A scene's `sfx` list adds `pop`, `whoosh`, `sting`, `thud`, `ding` or `tap` at any point. All sounds have faded edges and no noise floor.
- `render --draft`: 540x960, 15 fps (about 40% faster on the bundled example), for checking timing and sound before the full render.
- `references/checklist.md`: the 11-point still checklist Claude uses on every preview tile.
- OpenCode support: `opencode/commands/toon-short.md` runs the skill in OpenCode on a free model (README, "Run it free with OpenCode").

### Fixed
- Each trimmed voice line now fades in and out over 6 ms, so lines never start or stop on a hard edge.
- Quieter pauses: cut whooshes, prop pops and entrance sounds are softer, and reaction sounds start on the line's first word instead of in the gap before it. On the bundled example the loudest pause went from -32.9 to -37.4 dBFS (the channel check wants under -35).
- The final mix gets a declick and 12 kHz low-pass safety pass (Kokoro has nothing above 12 kHz), which takes the bundled example from about 20 to about 8 detected clicks a minute. The rest are inside spoken words and show up the same with Studio's mastering; still open.

### Changed
- The bundled examples use cuts and a cold open (English hook shortened to 9 words), and pass every new check.

### Tests
- New tests for cuts, pacing reports, the new checker notes and errors, action-sound events and silent edges, a frame change across a cut, and the draft render size and frame rate.

## 1.0.2 (2026-11-19)

### Fixed
- Clicks and crackle in the soundtrack. Every sound (voice, whooshes, pops) now fades in and out over a few milliseconds instead of starting and stopping on a loud sample, and a music file shorter than the video loops with an equal-power crossfade instead of a hard jump at each seam.
- Music bed: fades in over 0.5 s, DC offset removed, low rumble under about 60 Hz filtered out, and the ducking envelope is smoothed so it never pumps.
- Whooshes on cuts are darker and a little quieter, a soft air sweep instead of bright hiss.

### Tests
- New tests for silent sound edges, a click-free music loop seam, the music fade-in and rumble filter, and click-free voice edges.

## 1.0.1 (2026-11-19)

### Fixed
- Hebrew captions rendered backwards when Pillow is built with libraqm (the standard Linux wheels): `bidi.py` already puts the text in visual order, and raqm reversed it a second time. Caption fonts now load with Pillow's BASIC layout engine, so the result is the same on every platform.

## 1.0.0 (2026-11-19)

First release. A clean-room rewrite of the idea behind an unlicensed "viral shorts" skill, which was audited and not installed (CAUTION: silent pip installs, an unverified model download, written for claude.ai paths). None of its code or prompts are reused.

### Added
- Full flow from questions to MP4: 10 ideas, retention script, voice, storyboard, a preview Claude reviews itself, then the render.
- Toon characters: 12 moods, 11 poses, 6 skin tones, 8 hair styles, 12 hats, 7 outfits, 28 props.
- 20 parallax sets (11 outdoor, 9 indoor), 5 times of day, 6 landmarks, 4 foreground overlays, 9 camera moves with automatic framing.
- Karaoke captions with Hebrew right-to-left layout.
- Timing from exact AI-voice line spans, the user's own recording (cuts snap to pauses), or reading pace.
- Storyboard checker that suggests corrections and flags pacing problems.

### Security
- Explicit, consent-first `setup` into a private venv. Nothing installs implicitly, and ffmpeg is found but never installed.
- Pinned dependencies. Kokoro model files are verified against SHA-256 digests, and a mismatch deletes the file.
- No network access outside setup. No filesystem sweeps.

### Tests
- 162 pytest tests, 97% coverage, run in CI.
