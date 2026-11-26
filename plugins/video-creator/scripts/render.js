'use strict';
/* Rendering: ffmpeg runs without a shell, inside the project folder, on relative paths this script chose. */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { isLink } = require('./state');
const E = require('./edit');
const P = require('./project');

const fail = (error, message, extra) => ({ ok: false, error, message, ...extra });

function ff(bin, args, cwd) {
  const r = spawnSync(bin, args, { cwd, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout: 15 * 60 * 1000 });
  if (r.error) return r.error.code === 'ENOENT' ? 'ffmpeg not found' : String(r.error.message);
  return r.status === 0 ? null : (r.stderr || `ffmpeg exited ${r.status}`).trim().split('\n').slice(-6).join('\n');
}

function doctor(bin) {
  const r = spawnSync(bin, ['-hide_banner', '-filters'], { encoding: 'utf8' });
  if (r.error || r.status !== 0) return fail('no-ffmpeg', 'ffmpeg is not installed or not on PATH. Planning and prompts still work; rendering needs ffmpeg.');
  const has = (f) => new RegExp(`\\s${f}\\s`).test(r.stdout);
  const need = ['xfade', 'zoompan', 'aevalsrc', 'loudnorm'];
  const missing = need.filter((f) => !has(f));
  if (missing.length) return fail('old-ffmpeg', `this ffmpeg lacks ${missing.join(', ')}; install ffmpeg 4.4 or later`);
  return { ok: true, ffmpeg: bin, captionsBurn: has('subtitles'), animaticText: has('drawtext') };
}

function workDir(dir) {
  const w = path.join(dir, '.work');
  if (isLink(w)) return null;
  fs.mkdirSync(w, { recursive: true });
  return w;
}

function wrap(text, width) {
  const words = String(text).replace(/\s+/g, ' ').trim().split(' '); const lines = []; let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > width) { if (cur) lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim();
    if (lines.length >= 7) break;
  }
  if (cur && lines.length < 8) lines.push(cur);
  return lines.join('\n');
}

// Animatic cards: one picture per shot in the style's palette, with the shot written on it. No model needed.
function makeCards(bin, dir, doc, style, size, text) {
  const w = workDir(dir); if (!w) return fail('planted-state', '.work is a symlink; refusing it');
  fs.copyFileSync(path.join(__dirname, '..', 'assets', 'fonts', 'Rubik.ttf'), path.join(w, 'font.ttf'));
  const [W, H] = size; const media = {};
  for (let i = 0; i < doc.shots.length; i++) {
    const s = doc.shots[i]; const bg = style.palette[i % 3].slice(1); const band = style.palette[(i + 1) % 3].slice(1);
    const rel = `.work/card-${s.id}.png`;
    const vf = [`drawbox=x=0:y=ih*0.78:w=iw:h=ih*0.22:color=0x${band}@0.85:t=fill`, 'drawgrid=w=iw/8:h=ih/8:t=1:c=white@0.08'];
    if (text) {
      fs.writeFileSync(path.join(w, `card-${s.id}.txt`), `${i + 1}/${doc.shots.length}  ${s.id}  (${s.seconds}s, ${s.move})\n\n${wrap(s.prompt, W > H ? 34 : 20)}`);
      vf.push(`drawtext=fontfile=.work/font.ttf:textfile=.work/card-${s.id}.txt:fontsize=${Math.round(W / 17)}:fontcolor=white:borderw=3:bordercolor=black:x=w*0.07:y=h*0.12:line_spacing=10`);
    }
    const err = ff(bin, ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', `color=c=0x${bg}:s=${W}x${H}`, '-vf', vf.join(','), '-frames:v', '1', rel], dir);
    if (err) return fail('ffmpeg-failed', `card ${s.id}: ${err}`);
    media[s.id] = { rel, kind: 'still' };
  }
  return { ok: true, media };
}

function metadata(doc, style, seconds, size, kind) {
  const tags = ['#shorts', `#${style.id.replace(/[^a-z0-9]/g, '')}`, '#aivideo', '#animation'].join(' ');
  return [`# ${doc.title || 'Untitled'}`, '', doc.logline ? `${doc.logline}\n` : '', `- Style: ${style.name} (${style.id})`,
    `- Length: ${seconds.toFixed(1)}s, ${doc.shots.length} shots, ${size[0]}x${size[1]}`, `- Render: ${kind}`,
    `- Sound: ${doc.music ? 'your music file' : style.score === 'none' ? 'silent' : `synthesized ${style.score} bed`}${doc.voice ? ' + your voice file' : ''}`, '',
    '## Upload checklist', '', '- Images or clips were made by an AI model: tick the "altered or synthetic content" box where the platform has one.',
    doc.voice ? '- If the voice is an AI voice, say so in the description.' : '- No voice: the captions carry the story.',
    '- The synthesized bed is royalty-free. If you add music, use music you have the rights to.', '', `Suggested tags: ${tags}`, '',
    '## Lines', '', ...doc.shots.filter((s) => s.line).map((s) => `- ${s.line.trim()}`), ''].filter((x) => x !== '').join('\n') + '\n';
}

// kind: final | draft | animatic
function render(bin, dir, doc, v, kind, opts) {
  const d = doctor(bin); if (!d.ok) return d;
  const burn = !!(opts.burn || kind === 'animatic') && d.captionsBurn;
  const plat = P.PLATFORMS[P.platformOf(doc.platform)];
  const size = kind === 'final' ? plat.size : plat.size.map((x) => Math.round(x / 4) * 2);
  let media = v.media;
  if (kind === 'animatic') { const c = makeCards(bin, dir, doc, v.style, size, d.animaticText); if (!c.ok) return c; media = c.media; }
  else if (v.missing.length) return fail('missing-media', `${v.missing.length} shot(s) have no image or clip yet`, { missing: v.missing });
  const w = workDir(dir); if (!w) return fail('planted-state', '.work is a symlink; refusing it');
  const look = kind === 'animatic' ? { ...v.style, fx: [] } : v.style; // texture filters would smear the card text
  const shots = doc.shots; const ov = E.overlaps(shots, v.style); const segLen = E.segSeconds(shots, ov); const segs = [];
  for (let i = 0; i < shots.length; i++) {
    const m = media[shots[i].id]; const rel = `.work/seg-${String(i + 1).padStart(2, '0')}.mp4`;
    const err = ff(bin, E.segmentArgs({ input: m.rel, kind: m.kind, move: shots[i].move, seconds: segLen[i], style: look, size, draft: kind !== 'final', out: rel }), dir);
    if (err) return fail('ffmpeg-failed', `shot ${shots[i].id} (${m.rel}): ${err}`);
    segs.push(rel);
    process.stderr.write(`shot ${i + 1}/${shots.length} done\n`);
  }
  const total = shots.reduce((n, s) => n + s.seconds, 0);
  fs.writeFileSync(path.join(dir, 'captions.srt'), P.srt(shots, E.starts(shots)));
  const name = { final: 'video.mp4', draft: 'draft.mp4', animatic: 'animatic.mp4' }[kind];
  const j = E.joinArgs({ segs, shots, style: v.style, total, voice: doc.voice || null, music: doc.music || null, burn, out: '.work/out.tmp.mp4', draft: kind !== 'final', size });
  const err = ff(bin, j.args, dir);
  if (err) return fail('ffmpeg-failed', `join: ${err}`);
  fs.renameSync(path.join(w, 'out.tmp.mp4'), path.join(dir, name)); // a stopped render never leaves a short file under the final name
  fs.writeFileSync(path.join(dir, 'metadata.md'), metadata(doc, v.style, total, size, kind));
  return { ok: true, video: path.join(dir, name), kind, seconds: Math.round(total * 10) / 10, size, style: v.style.id, captionsBurned: burn,
    captions: path.join(dir, 'captions.srt'), metadata: path.join(dir, 'metadata.md') };
}

function sheet(bin, dir, doc, v) {
  const d = doctor(bin); if (!d.ok) return d;
  const have = doc.shots.filter((s) => v.media[s.id]);
  if (!have.length) return fail('missing-media', 'no images or clips yet: make them and save them under the names in prompts.md');
  const size = P.PLATFORMS[P.platformOf(doc.platform)].size;
  const err = ff(bin, E.sheetArgs(have.map((s) => v.media[s.id].rel), size, 'sheet.jpg'), dir);
  return err ? fail('ffmpeg-failed', err) : { ok: true, sheet: path.join(dir, 'sheet.jpg'), order: have.map((s) => s.id), missing: v.missing };
}

module.exports = { doctor, render, sheet, makeCards, metadata, wrap, ff };
