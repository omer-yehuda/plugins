'use strict';
/* The project file (project.json): schema, platform sizes, media lookup, captions and the prompt sheet. */
const fs = require('fs');
const path = require('path');
const { isLink } = require('./state');
const S = require('./styles');

const PLATFORMS = {
  shorts: { size: [1080, 1920], aspect: '9:16', label: 'YouTube Shorts, TikTok, Reels' },
  youtube: { size: [1920, 1080], aspect: '16:9', label: 'YouTube, wide' },
  square: { size: [1080, 1080], aspect: '1:1', label: 'Square feed post' },
  feed: { size: [1080, 1350], aspect: '4:5', label: 'Instagram and Facebook feed' },
};
const ALIASES = { tiktok: 'shorts', reels: 'shorts', vertical: 'shorts', wide: 'youtube', instagram: 'feed' };
const SHOT_ID = /^[a-z0-9][a-z0-9-]{0,39}$/;
const STILL_EXT = ['png', 'jpg', 'jpeg', 'webp'];
const CLIP_EXT = ['mp4', 'mov', 'webm'];
const AUDIO_RE = /^[a-z0-9][a-z0-9-]{0,39}\.(wav|mp3|m4a)$/;
const LIMITS = { minShots: 2, maxShots: 16, minSeconds: 1, maxSeconds: 12, maxTotal: 180 };

const platformOf = (p) => PLATFORMS[ALIASES[p] || p] ? (ALIASES[p] || p) : null;
const safeFile = (f) => !isLink(f) && fs.existsSync(f) && fs.statSync(f).isFile();

// media/<shot-id>.<ext>: a clip beats a still when both exist.
function findMedia(dir, id) {
  for (const ext of [...CLIP_EXT, ...STILL_EXT]) {
    const rel = `media/${id}.${ext}`;
    if (safeFile(path.join(dir, rel))) return { rel, kind: CLIP_EXT.includes(ext) ? 'clip' : 'still' };
  }
  return null;
}

function validate(doc, dir, styles) {
  const errors = []; const missing = []; const media = {};
  if (!doc || typeof doc !== 'object') return { ok: false, errors: ['project.json is not a JSON object'], missing };
  const r = S.resolve(doc.style, styles);
  if (r.error) errors.push(`style "${doc.style}" is not known; run "styles" to list them, or mix two with "a+b"`);
  if (!platformOf(doc.platform)) errors.push(`platform must be one of ${Object.keys(PLATFORMS).join(', ')}`);
  for (const k of ['character', 'world', 'logline']) if (doc[k] !== undefined && (typeof doc[k] !== 'string' || doc[k].length > 600)) errors.push(`${k} must be text of at most 600 characters`);
  for (const k of ['voice', 'music']) {
    if (doc[k] === undefined || doc[k] === null) continue;
    if (!AUDIO_RE.test(String(doc[k]))) errors.push(`${k} must be a file name in the project folder ending in .wav, .mp3 or .m4a`);
    else if (!safeFile(path.join(dir, doc[k]))) errors.push(`${k} file ${doc[k]} is not in the project folder`);
  }
  const shots = Array.isArray(doc.shots) ? doc.shots : null;
  if (!shots) return { ok: false, errors: [...errors, 'project.json needs a "shots" array'], missing };
  if (shots.length < LIMITS.minShots || shots.length > LIMITS.maxShots) errors.push(`a video has ${LIMITS.minShots} to ${LIMITS.maxShots} shots (found ${shots.length})`);
  const seen = new Set(); let total = 0;
  shots.forEach((s, i) => {
    const at = `shot ${i + 1}`;
    if (!s || typeof s !== 'object') return errors.push(`${at}: not an object`);
    if (!SHOT_ID.test(String(s.id || ''))) errors.push(`${at}: id must be lowercase letters, digits and dashes`);
    else if (seen.has(s.id)) errors.push(`${at}: duplicate id ${s.id}`);
    else { const m = findMedia(dir, s.id); if (m) media[s.id] = m; else missing.push(s.id); }
    seen.add(s.id);
    if (!(typeof s.seconds === 'number' && s.seconds >= LIMITS.minSeconds && s.seconds <= LIMITS.maxSeconds)) errors.push(`${at}: seconds must be ${LIMITS.minSeconds} to ${LIMITS.maxSeconds}`);
    else total += s.seconds;
    if (!S.MOVES.includes(s.move)) errors.push(`${at}: move must be one of ${S.MOVES.join(', ')}`);
    if (typeof s.prompt !== 'string' || s.prompt.trim().length < 10 || s.prompt.length > 800) errors.push(`${at}: prompt must be 10 to 800 characters`);
    for (const k of ['line', 'motion']) if (s[k] !== undefined && (typeof s[k] !== 'string' || s[k].length > 300)) errors.push(`${at}: ${k} must be text of at most 300 characters`);
    if (s.cast !== undefined && typeof s.cast !== 'boolean') errors.push(`${at}: cast must be true or false`);
    if (s.transition !== undefined && !S.TRANSITIONS.includes(s.transition)) errors.push(`${at}: transition must be one of ${S.TRANSITIONS.join(', ')}`);
  });
  if (total > LIMITS.maxTotal) errors.push(`the video is ${total}s long (limit ${LIMITS.maxTotal}s)`);
  return { ok: errors.length === 0, errors, missing, media, style: r.style, shots: shots.length, seconds: Math.round(total * 10) / 10 };
}

function stamp(t) {
  const ms = Math.max(0, Math.round(t * 1000));
  const p = (n, w) => String(n).padStart(w, '0');
  return `${p(Math.floor(ms / 3600000), 2)}:${p(Math.floor(ms / 60000) % 60, 2)}:${p(Math.floor(ms / 1000) % 60, 2)},${p(ms % 1000, 3)}`;
}

// starts[i] is when shot i begins in the cut (transitions overlap shots).
function srt(shots, starts) {
  const out = []; let k = 0;
  shots.forEach((s, i) => {
    if (s.line && s.line.trim()) out.push(`${++k}\n${stamp(starts[i] + 0.15)} --> ${stamp(starts[i] + s.seconds - 0.15)}\n${s.line.trim().replace(/\s+/g, ' ')}\n`);
  });
  return out.join('\n');
}

function promptSheet(doc, style) {
  const plat = PLATFORMS[platformOf(doc.platform)];
  const out = [`# ${doc.title || 'Untitled'}: prompts`, '', `Style: **${style.name}** (\`${style.id}\`). Format: ${plat.aspect} for ${plat.label}.`, '',
    'For each shot, make ONE still image or ONE video clip with the model you choose, then save it in `media/` under the exact name shown.',
    'Clips (.mp4, .mov, .webm) are used as they are; stills get the camera move in the edit. Never ask the model for words or logos.', '',
    `**Negative prompt (every shot):** ${style.negative}`, '', `**Tip:** ${style.tips || 'Generate the first shot, approve it, then reuse its seed or reference for the rest.'}`, ''];
  doc.shots.forEach((s, i) => {
    out.push(`## ${i + 1}. ${s.id} (${s.seconds}s, ${s.move})`, '', `Save as \`media/${s.id}.png\` (still) or \`media/${s.id}.mp4\` (clip)`, '',
      'Image prompt:', '```', S.imagePrompt(style, doc, s, plat.aspect), '```', '', 'Video prompt (image-to-video or text-to-video):', '```', S.motionPrompt(style, s), '```', '');
    if (s.line) out.push(`Line: "${s.line.trim()}"`, '');
  });
  return out.join('\n');
}

module.exports = { validate, findMedia, srt, stamp, promptSheet, platformOf, PLATFORMS, LIMITS, AUDIO_RE, SHOT_ID };
