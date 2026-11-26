'use strict';
// Style packs: load the built-in packs and the project's own, validate them, mix two, compose prompts.
const fs = require('fs');
const path = require('path');

const BUILTIN = path.join(__dirname, '..', 'styles', 'styles.json');
const ID = /^[a-z0-9][a-z0-9-]{0,30}$/;
const GRADES = ['none', 'vivid', 'warm', 'cold', 'teal-amber', 'pastel', 'neon', 'mono', 'sepia', 'natural', 'sickly'];
const FX = ['grain', 'grain-heavy', 'vignette', 'vignette-soft', 'pixelate', 'pixelate-soft', 'scanlines', 'glitch', 'posterize', 'sharpen', 'paper', 'jitter', 'handheld', 'bars'];
const TRANSITIONS = ['cut', 'fade', 'fadeblack', 'fadewhite', 'dissolve', 'pixelize', 'wipeleft', 'wiperight', 'slideleft', 'slideright', 'smoothleft', 'smoothright', 'circleopen', 'circleclose', 'hblur', 'radial', 'zoomin'];
const MOVES = ['push-in', 'pull-out', 'pan-left', 'pan-right', 'tilt-up', 'tilt-down', 'orbit', 'shake', 'hold'];
const SCORES = ['none', 'chiptune', 'cinematic', 'playful', 'anthem', 'ambient', 'action', 'lullaby', 'synthwave', 'noir', 'dread'];
const TEXT = ['name', 'tagline', 'look', 'character', 'finish', 'negative', 'motion'];

function validateStyle(id, s) {
  const e = [];
  if (!ID.test(id)) e.push(`style id "${id}" must be lowercase letters, digits and hyphens`);
  if (!s || typeof s !== 'object' || Array.isArray(s)) return [`style ${id} must be an object`];
  for (const k of TEXT) if (typeof s[k] !== 'string' || !s[k].trim() || s[k].length > 600) e.push(`${id}.${k} must be text up to 600 characters`);
  if (!Array.isArray(s.palette) || s.palette.length !== 3 || !s.palette.every((c) => /^#[0-9A-Fa-f]{6}$/.test(c))) e.push(`${id}.palette must be three #RRGGBB colours`);
  if (!GRADES.includes(s.grade)) e.push(`${id}.grade must be one of ${GRADES.join(', ')}`);
  if (!Array.isArray(s.fx) || !s.fx.every((f) => FX.includes(f))) e.push(`${id}.fx entries must be from ${FX.join(', ')}`);
  if (![12, 15, 24, 30].includes(s.fps)) e.push(`${id}.fps must be 12, 15, 24 or 30`);
  if (!TRANSITIONS.includes(s.transition)) e.push(`${id}.transition must be one of ${TRANSITIONS.join(', ')}`);
  if (!(s.transitionSeconds >= 0 && s.transitionSeconds <= 1.5)) e.push(`${id}.transitionSeconds must be 0 to 1.5`);
  const r = s.shotSeconds;
  if (!Array.isArray(r) || r.length !== 2 || !(r[0] >= 1 && r[1] >= r[0] && r[1] <= 12)) e.push(`${id}.shotSeconds must be [min, max] within 1 to 12`);
  if (!Array.isArray(s.moves) || !s.moves.length || !s.moves.every((m) => MOVES.includes(m))) e.push(`${id}.moves entries must be from ${MOVES.join(', ')}`);
  if (!SCORES.includes(s.score)) e.push(`${id}.score must be one of ${SCORES.join(', ')}`);
  return e;
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

// customDir: <project>/.video-creator/styles, one <id>.json per style. Custom packs cannot shadow built-ins.
function loadAll(customDir) {
  const all = {};
  for (const [id, s] of Object.entries(readJson(BUILTIN) || {})) all[id] = { ...s, id, custom: false };
  const problems = [];
  if (customDir && fs.existsSync(customDir) && !fs.lstatSync(customDir).isSymbolicLink()) {
    for (const f of fs.readdirSync(customDir).sort()) {
      const m = /^([a-z0-9][a-z0-9-]{0,30})\.json$/.exec(f);
      if (!m) continue;
      const id = m[1];
      const file = path.join(customDir, f);
      if (fs.lstatSync(file).isSymbolicLink()) { problems.push(`${f}: symlinks are ignored`); continue; }
      if (all[id]) { problems.push(`${f}: "${id}" is a built-in style name`); continue; }
      const s = readJson(file);
      const e = validateStyle(id, s);
      if (e.length) { problems.push(...e.map((x) => `${f}: ${x}`)); continue; }
      all[id] = { ...s, id, custom: true };
    }
  }
  return { styles: all, problems };
}

// "a" or "a+b". A mix takes the look of both, the grade, fx and fps of the first, the transition and score of the second.
function resolve(spec, all) {
  if (typeof spec !== 'string') return { error: 'bad-style' };
  const parts = spec.split('+');
  if (parts.length > 2 || parts.some((p) => !all[p])) return { error: 'unknown-style', known: Object.keys(all) };
  if (parts.length === 1) return { style: all[parts[0]] };
  const [a, b] = parts.map((p) => all[p]);
  if (a.id === b.id) return { error: 'same-style' };
  return { style: {
    id: spec, name: `${a.name} x ${b.name}`, tagline: `${a.name} worlds drawn with ${b.name} technique.`,
    look: `${a.look}, rendered in the manner of ${b.look}`, character: `${a.character}, with the surface treatment of ${b.character}`,
    finish: `${a.finish}; ${b.finish}`, negative: [...new Set(`${a.negative}, ${b.negative}`.split(/,\s*/))].join(', '),
    motion: `${a.motion}; ${b.motion}`, palette: [a.palette[0], b.palette[1], a.palette[2]],
    grade: a.grade, fx: [...new Set([...a.fx, ...b.fx])].slice(0, 4), fps: a.fps, transition: b.transition,
    transitionSeconds: b.transitionSeconds, shotSeconds: [Math.min(a.shotSeconds[0], b.shotSeconds[0]), Math.max(a.shotSeconds[1], b.shotSeconds[1])],
    moves: [...new Set([...a.moves, ...b.moves])], score: b.score, tips: `${a.tips} ${b.tips}`, mix: [a.id, b.id], custom: a.custom || b.custom,
  } };
}

const clean = (t) => String(t || '').replace(/\s+/g, ' ').trim().replace(/[.;,\s]+$/, '');

// The style blocks are added by code, word for word, so every shot in a video shares one look.
function imagePrompt(style, doc, shot, aspect) {
  const cast = shot.cast === false ? '' : clean(doc.character) || clean(style.character);
  const parts = [clean(style.look), cast, clean(shot.prompt), clean(doc.world), clean(style.finish)];
  return `${parts.filter(Boolean).join('. ')}. Aspect ratio ${aspect}.`;
}
function motionPrompt(style, shot) {
  return [clean(shot.motion) || clean(shot.prompt), `Camera: ${shot.move}`, clean(style.motion)].filter(Boolean).join('. ') + '.';
}

module.exports = { loadAll, resolve, validateStyle, imagePrompt, motionPrompt, GRADES, FX, TRANSITIONS, MOVES, SCORES, ID };
