'use strict';
/* Shot list schema and ffmpeg argument builders for Premiere. Pure functions except for file-existence checks. */
const fs = require('fs');
const path = require('path');
const { isLink } = require('./state');
const direct = require('./direct');

const NAME_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;
const STILL_RE = /^stills\/[a-z0-9][a-z0-9-]{0,39}\.(png|jpe?g|webp)$/;
const VOICE_RE = /^[a-z0-9][a-z0-9-]{0,39}\.(wav|mp3|m4a)$/;
const MOVES = ['push-in', 'pull-out', 'pan-left', 'pan-right', 'tilt-up', 'tilt-down', 'hold'];
const GRADES = {
  'teal-amber': 'colorbalance=rs=-0.06:bs=0.08:rh=0.08:bh=-0.08,eq=contrast=1.08:saturation=1.05',
  warm: 'colorbalance=rm=0.06:bm=-0.06:rh=0.04:bh=-0.04,eq=contrast=1.05',
  cold: 'colorbalance=rm=-0.05:bm=0.06:rs=-0.04:bs=0.06,eq=contrast=1.06:saturation=0.92',
  mono: 'hue=s=0,eq=contrast=1.12',
  none: null,
};
const FORMATS = { wide: [1920, 1080], vertical: [1080, 1920] };
const FPS = 30;
const LIMITS = { minShots: 3, maxShots: 12, minSeconds: 1.5, maxSeconds: 12, maxTotal: 120 };

function validate(doc, prodDir) {
  const errors = []; const missing = [];
  const shots = doc && Array.isArray(doc.shots) ? doc.shots : null;
  if (!shots) return { ok: false, errors: ['shots.json needs a "shots" array'], missing };
  if (shots.length < LIMITS.minShots || shots.length > LIMITS.maxShots) errors.push(`a film has ${LIMITS.minShots} to ${LIMITS.maxShots} shots (found ${shots.length})`);
  const look = doc.look || {};
  if (look.grade !== undefined && !(look.grade in GRADES)) errors.push(`look.grade must be one of ${Object.keys(GRADES).join(', ')}`);
  if (look.grain !== undefined && !(typeof look.grain === 'number' && look.grain >= 0 && look.grain <= 1)) errors.push('look.grain must be a number from 0 to 1');
  if (look.letterbox !== undefined && typeof look.letterbox !== 'boolean') errors.push('look.letterbox must be true or false');
  if (doc.voice !== undefined && doc.voice !== null) {
    const v = path.join(prodDir, String(doc.voice));
    if (!VOICE_RE.test(String(doc.voice))) errors.push('voice must be a file name in the production folder ending in .wav, .mp3 or .m4a');
    else if (isLink(v) || !fs.existsSync(v)) errors.push(`voice file ${doc.voice} is not in the production folder`);
  }
  const seen = new Set(); let total = 0;
  shots.forEach((s, i) => {
    const at = `shot ${i + 1}`;
    if (!s || typeof s !== 'object') return errors.push(`${at}: not an object`);
    if (!NAME_RE.test(String(s.id || ''))) errors.push(`${at}: id must be lowercase letters, digits and dashes`);
    else if (seen.has(s.id)) errors.push(`${at}: duplicate id ${s.id}`);
    seen.add(s.id);
    if (!STILL_RE.test(String(s.still || ''))) errors.push(`${at}: still must look like stills/<name>.png (png, jpg or webp)`);
    else { const f = path.join(prodDir, s.still); if (isLink(f) || !fs.existsSync(f)) missing.push(s.still); }
    if (!(typeof s.seconds === 'number' && s.seconds >= LIMITS.minSeconds && s.seconds <= LIMITS.maxSeconds)) errors.push(`${at}: seconds must be ${LIMITS.minSeconds} to ${LIMITS.maxSeconds}`);
    else total += s.seconds;
    if (!MOVES.includes(s.move)) errors.push(`${at}: move must be one of ${MOVES.join(', ')}`);
    if (typeof s.prompt !== 'string' || s.prompt.trim().length < 20 || s.prompt.length > 1200) errors.push(`${at}: prompt must be 20 to 1200 characters`);
    if (s.line !== undefined && (typeof s.line !== 'string' || s.line.length > 200)) errors.push(`${at}: line must be text of at most 200 characters`);
    errors.push(...direct.fieldErrors(s, at));
  });
  if (total > LIMITS.maxTotal) errors.push(`the film is ${total}s long (limit ${LIMITS.maxTotal}s)`);
  return { ok: errors.length === 0, errors, missing, shots: shots.length, seconds: Math.round(total * 10) / 10, flow: errors.length ? [] : direct.flow(shots) };
}

function zoompan(move, n) {
  const cx = "x='iw/2-(iw/zoom/2)'"; const cy = "y='ih/2-(ih/zoom/2)'";
  const t = `on/${n}`;
  const z = { 'push-in': `z='1+0.12*${t}'`, 'pull-out': `z='1.12-0.12*${t}'`, hold: "z='1'" }[move] || "z='1.12'";
  const x = { 'pan-right': `x='(iw-iw/zoom)*${t}'`, 'pan-left': `x='(iw-iw/zoom)*(1-${t})'` }[move] || cx;
  const y = { 'tilt-down': `y='(ih-ih/zoom)*${t}'`, 'tilt-up': `y='(ih-ih/zoom)*(1-${t})'` }[move] || cy;
  return `${z}:${x}:${y}`;
}

// The filter chain for one shot: cover-fit at double size (smooth sub-pixel moves), camera move, grade, grain, vignette, bars, fades.
function shotFilter(shot, opts) {
  const [W, H] = opts.size;
  const n = Math.max(1, Math.round(shot.seconds * FPS));
  const look = opts.look || {};
  const f = [`scale=${W * 2}:${H * 2}:force_original_aspect_ratio=increase`, `crop=${W * 2}:${H * 2}`, 'setsar=1',
    `zoompan=${zoompan(shot.move, n)}:d=${n}:s=${W}x${H}:fps=${FPS}`];
  const grade = GRADES[look.grade === undefined ? 'teal-amber' : look.grade];
  if (grade) f.push(grade);
  const grain = look.grain === undefined ? 0.4 : look.grain;
  if (grain > 0) f.push(`noise=alls=${Math.round(grain * 18)}:allf=t`);
  f.push('vignette=PI/5');
  if (W > H && look.letterbox !== false) {
    const bar = Math.max(0, Math.round((H - W / 2.39) / 2));
    f.push(`drawbox=x=0:y=0:w=iw:h=${bar}:color=black:t=fill`, `drawbox=x=0:y=ih-${bar}:w=iw:h=${bar}:color=black:t=fill`);
  }
  if (opts.first) f.push('fade=t=in:st=0:d=0.4');
  if (opts.last) f.push(`fade=t=out:st=${Math.max(0, shot.seconds - 0.6).toFixed(2)}:d=0.6`);
  f.push('format=yuv420p');
  return { vf: f.join(','), frames: n };
}

function shotArgs(still, out, filter) {
  return ['-y', '-loglevel', 'error', '-i', still, '-vf', filter.vf, '-frames:v', String(filter.frames),
    '-c:v', 'libx264', '-crf', '18', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-r', String(FPS), out];
}

// A synthesized score (low drone and a soft noise bed), ducked under the voice when there is one. No samples, no downloads.
function soundArgs(silent, out, seconds, voice) {
  const T = seconds.toFixed(2);
  const drone = `aevalsrc='0.20*sin(2*PI*55*t)*(0.75+0.25*sin(2*PI*0.11*t))+0.12*sin(2*PI*82.41*t)+0.10*sin(2*PI*110*t)*(0.6+0.4*sin(2*PI*0.07*t))+0.05*sin(2*PI*164.81*t)':s=48000:d=${T}`;
  const args = ['-y', '-loglevel', 'error', '-i', silent, '-f', 'lavfi', '-i', drone, '-f', 'lavfi', '-i', `anoisesrc=d=${T}:c=pink:r=48000:a=0.05`];
  let graph = `[1:a]aformat=channel_layouts=stereo[d];[2:a]lowpass=f=500,aformat=channel_layouts=stereo[n];[d][n]amix=inputs=2:normalize=0,afade=t=in:d=1.5,afade=t=out:st=${Math.max(0, seconds - 2).toFixed(2)}:d=2[m];`;
  if (voice) {
    args.push('-i', voice);
    graph += '[3:a]aformat=sample_rates=48000:channel_layouts=stereo,asplit[v1][v2];[m][v1]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=400[duck];[duck][v2]amix=inputs=2:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=11[a]';
  } else graph += '[m]loudnorm=I=-18:TP=-1.5:LRA=11[a]';
  args.push('-filter_complex', graph, '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-t', T, '-movflags', '+faststart', out);
  return args;
}

function dailiesArgs(stills, out, size) {
  const [w, h] = size[0] > size[1] ? [480, 270] : [270, 480];
  const cols = Math.min(4, stills.length);
  const rows = Math.ceil(stills.length / cols);
  const args = ['-y', '-loglevel', 'error'];
  stills.forEach((s) => args.push('-i', s));
  const parts = stills.map((_, i) => `[${i}:v]scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,format=yuv420p[s${i}]`);
  const join = stills.map((_, i) => `[s${i}]`).join('');
  args.push('-filter_complex', `${parts.join(';')};${join}concat=n=${stills.length}:v=1:a=0,tile=${cols}x${rows}[o]`, '-map', '[o]', '-frames:v', '1', '-q:v', '3', out);
  return args;
}

function stamp(t) {
  const ms = Math.round(t * 1000);
  const p = (n, w) => String(n).padStart(w, '0');
  return `${p(Math.floor(ms / 3600000), 2)}:${p(Math.floor(ms / 60000) % 60, 2)}:${p(Math.floor(ms / 1000) % 60, 2)},${p(ms % 1000, 3)}`;
}

function srt(shots) {
  let t = 0; let k = 0; const out = [];
  for (const s of shots) {
    if (s.line && s.line.trim()) out.push(`${++k}\n${stamp(t + 0.15)} --> ${stamp(t + s.seconds - 0.1)}\n${s.line.trim().replace(/\s+/g, ' ')}\n`);
    t += s.seconds;
  }
  return out.join('\n');
}

function promptsDoc(doc, size) {
  const ratio = size[0] > size[1] ? '16:9 (wide)' : '9:16 (vertical)';
  const out = [`# Prompts: ${doc.title || 'untitled'}`, '', `Generate each still at ${ratio}, then save it under the exact file name shown. Do not ask the model to draw words, logos or code.`, ''];
  doc.shots.forEach((s, i) => out.push(`## ${i + 1}. ${s.id}`, '', `Save as: \`${s.still}\``, '', '```', s.prompt.trim(), '```', ''));
  return out.join('\n');
}

module.exports = { validate, shotFilter, shotArgs, soundArgs, dailiesArgs, srt, promptsDoc, zoompan, MOVES, GRADES, FORMATS, FPS, LIMITS };
