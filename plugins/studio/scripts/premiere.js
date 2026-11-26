#!/usr/bin/env node
/*
 * Premiere helper. Zero npm dependencies (Node 18+). Needs ffmpeg on PATH for `dailies` and `cut`. No network.
 *
 *   premiere.js doctor                                  is ffmpeg here, and which version
 *   premiere.js prep [--project DIR]                    make a fresh temp folder, print {"input": "<tmp>/input.json"}
 *   premiere.js init --input-file F [--project DIR]     F is that prep path, JSON {"title": "...", "format": "wide" | "vertical"}
 *   premiere.js check <id>                              validate shots.json, list the stills that are still missing
 *   premiere.js shots <id>                              the director's shot table (size, angle, move) and flow notes
 *   premiere.js prompts <id>                            write prompts.md: one prompt and one file name per shot
 *   premiere.js dailies <id>                            write dailies.jpg, a contact sheet of the stills that exist
 *   premiere.js cut <id> [--draft]                      render film.mp4, captions.srt and metadata.md
 *   premiere.js list
 *
 * Premiere does not generate images. Stills come from an image model you choose and are saved into the
 * production's stills/ folder. This script turns them into a graded, scored film with camera moves.
 * ffmpeg is run with argument arrays, never through a shell, and only on files inside the production folder.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const inputfile = require('./inputfile');
const { make, isLink, parseArgs } = require('./state');
const film = require('./film');
const direct = require('./direct');

const store = make('.premiere', 'productions', 'planted-premiere');
const fail = (error, message, extra) => ({ ok: false, error, message, ...extra });

function doctor(bin) {
  const r = spawnSync(bin, ['-hide_banner', '-version'], { encoding: 'utf8' });
  if (r.error || r.status !== 0) return fail('no-ffmpeg', 'ffmpeg was not found on PATH. Install it (ffmpeg.org) and try again.');
  return { ok: true, ffmpeg: (r.stdout.split('\n')[0] || '').trim() };
}

function init(project, title, format) {
  if (!(format in film.FORMATS)) return fail('bad-format', 'format must be "wide" or "vertical"');
  const made = store.create(project, title);
  if (!made.ok) return made;
  const file = (n) => path.join(made.dir, n);
  fs.mkdirSync(file('stills'));
  fs.writeFileSync(file('production.json'), JSON.stringify({ title: String(title).slice(0, 120), format }, null, 2) + '\n');
  return { ok: true, id: made.id, dir: made.dir, format, size: film.FORMATS[format],
    files: { shots: file('shots.json'), look: file('look.md'), prompts: file('prompts.md'), stills: file('stills'), dailies: file('dailies.jpg'), continuity: file('continuity.md'), film: file('film.mp4'), captions: file('captions.srt'), metadata: file('metadata.md') } };
}

function load(project, id) {
  const p = store.planted(project) || store.pathOf(project, id);
  if (!p.ok) return p;
  const read = (n) => { const f = path.join(p.dir, n); if (isLink(f)) throw new Error('link'); return JSON.parse(fs.readFileSync(f, 'utf8')); };
  let prod; let doc;
  try { prod = read('production.json'); } catch { return fail('not-a-production', 'this folder has no production.json'); }
  if (!(prod.format in film.FORMATS)) return fail('not-a-production', 'production.json has no valid format');
  if (isLink(path.join(p.dir, 'stills'))) return fail('planted-premiere', 'the stills folder is a symlink; refusing to use it');
  try { doc = read('shots.json'); } catch { return fail('no-shots', 'shots.json is missing or is not valid JSON. The director writes it during the pitch.'); }
  return { ok: true, id, dir: p.dir, doc, format: prod.format, size: film.FORMATS[prod.format], v: film.validate(doc, p.dir) };
}

function check(project, id) {
  const l = load(project, id);
  if (!l.ok) return l;
  return { ok: l.v.ok, id, format: l.format, ...l.v, ready: l.v.ok && l.v.missing.length === 0 };
}

function shots(project, id) {
  const l = load(project, id);
  if (!l.ok) return l;
  if (!l.v.ok) return fail('bad-shots', 'shots.json has errors', { errors: l.v.errors });
  return { ok: true, id, table: direct.table(l.doc.shots), flow: l.v.flow, flowOk: l.v.flow.length === 0 };
}

function prompts(project, id) {
  const l = load(project, id);
  if (!l.ok) return l;
  if (!l.v.ok) return fail('bad-shots', 'shots.json has errors', { errors: l.v.errors });
  const out = path.join(l.dir, 'prompts.md');
  fs.writeFileSync(out, film.promptsDoc(l.doc, l.size));
  return { ok: true, id, prompts: out, shots: l.v.shots, missing: l.v.missing };
}

function ff(bin, args) {
  const r = spawnSync(bin, args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  return r.error ? `could not start ffmpeg: ${r.error.message}` : r.status === 0 ? null : (r.stderr || '').trim().split('\n').slice(-3).join(' | ') || `ffmpeg exited with ${r.status}`;
}

function dailies(project, id, bin) {
  const l = load(project, id);
  if (!l.ok) return l;
  if (!l.v.ok) return fail('bad-shots', 'shots.json has errors', { errors: l.v.errors });
  const have = l.doc.shots.filter((s) => !l.v.missing.includes(s.still));
  if (!have.length) return fail('no-stills', 'no stills yet: generate them and save them under the names in prompts.md');
  const d = doctor(bin); if (!d.ok) return d;
  const out = path.join(l.dir, 'dailies.jpg');
  const err = ff(bin, film.dailiesArgs(have.map((s) => path.join(l.dir, s.still)), out, l.size));
  return err ? fail('ffmpeg-failed', err) : { ok: true, id, dailies: out, order: have.map((s) => s.id), missing: l.v.missing };
}

function cut(project, id, bin, draft) {
  const l = load(project, id);
  if (!l.ok) return l;
  if (!l.v.ok) return fail('bad-shots', 'shots.json has errors', { errors: l.v.errors });
  if (l.v.missing.length) return fail('missing-stills', `${l.v.missing.length} still(s) are missing`, { missing: l.v.missing });
  const d = doctor(bin); if (!d.ok) return d;
  const size = draft ? l.size.map((x) => x / 2) : l.size;
  const work = path.join(l.dir, 'shots');
  if (isLink(work)) return fail('planted-premiere', 'the shots folder is a symlink; refusing to use it');
  fs.mkdirSync(work, { recursive: true });
  const shots = l.doc.shots; const names = [];
  for (let i = 0; i < shots.length; i++) {
    const name = `${String(i + 1).padStart(2, '0')}-${shots[i].id}.mp4`;
    const tmp = path.join(work, `${name}.tmp.mp4`);
    const filter = film.shotFilter(shots[i], { size, look: l.doc.look, first: i === 0, last: i === shots.length - 1 });
    const err = ff(bin, film.shotArgs(path.join(l.dir, shots[i].still), tmp, filter));
    if (err) return fail('ffmpeg-failed', `shot ${shots[i].id}: ${err}`);
    fs.renameSync(tmp, path.join(work, name)); // a stopped render never leaves a short file under the final name
    names.push(name);
    process.stderr.write(`shot ${i + 1}/${shots.length} done\n`);
  }
  fs.writeFileSync(path.join(work, 'list.txt'), names.map((n) => `file '${n}'`).join('\n') + '\n');
  const silent = path.join(work, 'silent.mp4');
  let err = ff(bin, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(work, 'list.txt'), '-c', 'copy', silent]);
  if (err) return fail('ffmpeg-failed', `join: ${err}`);
  const seconds = shots.reduce((n, s) => n + Math.round(s.seconds * film.FPS), 0) / film.FPS;
  const out = path.join(l.dir, draft ? 'draft.mp4' : 'film.mp4');
  const tmpOut = path.join(work, 'final.tmp.mp4');
  err = ff(bin, film.soundArgs(silent, tmpOut, seconds, l.doc.voice ? path.join(l.dir, l.doc.voice) : null));
  if (err) return fail('ffmpeg-failed', `sound: ${err}`);
  fs.renameSync(tmpOut, out);
  fs.writeFileSync(path.join(l.dir, 'captions.srt'), film.srt(shots));
  fs.writeFileSync(path.join(l.dir, 'metadata.md'), [`# ${l.doc.title || id}`, '', `- Length: ${seconds.toFixed(1)}s, ${shots.length} shots, ${size[0]}x${size[1]}, ${film.FPS} fps`,
    `- Voice: ${l.doc.voice ? 'yes' : 'none (score only)'}`, '- Images: generated by an AI model. Declare altered or synthetic content when you upload.',
    l.doc.voice ? '- If the voice is an AI voice, say so in the description.' : '', '', '## Lines', '', ...shots.filter((s) => s.line).map((s) => `- ${s.line.trim()}`), ''].filter((x) => x !== '').join('\n') + '\n');
  return { ok: true, id, film: out, seconds, shots: shots.length, size, draft: !!draft, captions: path.join(l.dir, 'captions.srt'), metadata: path.join(l.dir, 'metadata.md') };
}

function list(project) {
  return store.listIds(project).map((id) => {
    const dir = path.join(store.items(project), id);
    const has = (n) => fs.existsSync(path.join(dir, n));
    return { id, status: has('film.mp4') ? 'rendered' : has('shots.json') ? 'pitched' : 'new', dir };
  });
}

function readInput(file) {
  const r = inputfile.readPrepFile(file);
  if (!r.ok) return { error: r.message };
  let j;
  try { j = JSON.parse(r.text); } catch { return { error: 'input file is not valid JSON' }; }
  if (!j || typeof j !== 'object') return { error: 'input file is not valid JSON' };
  r.done();
  return { title: String(j.title || ''), format: String(j.format || 'wide') };
}

function main(argv) {
  const { _, flags } = parseArgs(argv, ['project', 'input-file', 'ffmpeg']);
  const project = path.resolve(flags.project || process.cwd());
  const bin = typeof flags.ffmpeg === 'string' ? flags.ffmpeg : 'ffmpeg';
  const [cmd, arg] = _;
  let res;
  if (cmd === 'doctor') res = doctor(bin);
  else if (cmd === 'prep') res = store.planted(project) || inputfile.prep('input.json');
  else if (cmd === 'init') {
    const inp = readInput(flags['input-file']);
    res = inp.error ? fail('bad-input', inp.error) : init(project, inp.title, inp.format);
  } else if (cmd === 'check') res = check(project, arg);
  else if (cmd === 'shots') res = shots(project, arg);
  else if (cmd === 'prompts') res = prompts(project, arg);
  else if (cmd === 'dailies') res = dailies(project, arg, bin);
  else if (cmd === 'cut') res = cut(project, arg, bin, !!flags.draft);
  else if (cmd === 'list') res = store.planted(project) || { ok: true, productions: list(project) };
  else { process.stderr.write('usage: premiere.js doctor | prep | init --input-file F | check <id> | shots <id> | prompts <id> | dailies <id> | cut <id> [--draft] | list\n'); return 2; }
  process.stdout.write(JSON.stringify(res, null, 2) + '\n');
  return res.ok ? 0 : 1;
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));
module.exports = { doctor, init, check, shots, prompts, dailies, cut, list };
