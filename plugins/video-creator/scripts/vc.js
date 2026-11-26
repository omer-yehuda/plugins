#!/usr/bin/env node
'use strict';
/*
 * Video Creator helper. Zero npm dependencies (Node 18+), ffmpeg for rendering, no network.
 * Projects live in <project>/.video-creator/projects/<id>/; custom styles in <project>/.video-creator/styles/.
 * Every command prints JSON. Free text from the user arrives only through prep + --input-file.
 */
const fs = require('fs');
const path = require('path');
const { make, parseArgs, isLink } = require('./state');
const inputfile = require('./inputfile');
const S = require('./styles');
const P = require('./project');
const R = require('./render');

const store = make('.video-creator', 'projects', 'planted-state');
const fail = (error, message, extra) => ({ ok: false, error, message, ...extra });
const stylesOf = (project) => S.loadAll(path.join(store.root(project), 'styles'));

function styles(project) {
  const { styles: all, problems } = stylesOf(project);
  return { ok: true, styles: Object.values(all).map((s) => ({ id: s.id, name: s.name, tagline: s.tagline, custom: s.custom, fps: s.fps, transition: s.transition })), problems };
}

function style(project, spec) {
  const r = S.resolve(spec, stylesOf(project).styles);
  return r.error ? fail(r.error, `unknown style "${spec}"`, { known: r.known }) : { ok: true, style: r.style };
}

function init(project, inp) {
  const all = stylesOf(project).styles;
  const r = S.resolve(inp.style, all);
  if (r.error) return fail('unknown-style', `unknown style "${inp.style}"`, { known: Object.keys(all) });
  const platform = P.platformOf(inp.platform || 'shorts');
  if (!platform) return fail('bad-platform', `platform must be one of ${Object.keys(P.PLATFORMS).join(', ')}`);
  const c = store.create(project, inp.title);
  if (!c.ok) return c;
  fs.mkdirSync(path.join(c.dir, 'media'));
  const doc = { title: inp.title, style: r.style.id, platform, logline: '', character: '', world: '', shots: [] };
  fs.writeFileSync(path.join(c.dir, 'project.json'), JSON.stringify(doc, null, 2) + '\n');
  return { ok: true, id: c.id, dir: c.dir, style: r.style.id, platform, size: P.PLATFORMS[platform].size,
    files: { project: path.join(c.dir, 'project.json'), media: path.join(c.dir, 'media'), prompts: path.join(c.dir, 'prompts.md') } };
}

function load(project, id) {
  const bad = store.planted(project); if (bad) return bad;
  const p = store.pathOf(project, id); if (!p.ok) return p;
  const file = path.join(p.dir, 'project.json');
  if (isLink(file) || isLink(path.join(p.dir, 'media'))) return fail('planted-state', 'project.json or media/ is a symlink; refusing it');
  let doc;
  try { doc = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fail('bad-project', 'project.json is missing or not valid JSON'); }
  return { ok: true, id, dir: p.dir, doc, v: P.validate(doc, p.dir, stylesOf(project).styles) };
}

function check(project, id) {
  const l = load(project, id); if (!l.ok) return l;
  const { errors, missing, shots, seconds } = l.v;
  return { ok: l.v.ok, id, dir: l.dir, style: l.v.style && l.v.style.id, shots, seconds, errors, missing,
    ready: l.v.ok && !missing.length, media: Object.fromEntries(Object.entries(l.v.media || {}).map(([k, m]) => [k, m.kind])) };
}

function prompts(project, id) {
  const l = load(project, id); if (!l.ok) return l;
  if (!l.v.ok) return fail('bad-project', 'project.json has errors', { errors: l.v.errors });
  const out = path.join(l.dir, 'prompts.md');
  fs.writeFileSync(out, P.promptSheet(l.doc, l.v.style));
  return { ok: true, id, prompts: out, media: path.join(l.dir, 'media'), missing: l.v.missing };
}

function render(project, id, bin, kind, flags) {
  const l = load(project, id); if (!l.ok) return l;
  if (!l.v.ok) return fail('bad-project', 'project.json has errors', { errors: l.v.errors });
  return { id, ...R.render(bin, l.dir, l.doc, l.v, kind, { burn: !!flags.burn }) };
}

function sheet(project, id, bin) {
  const l = load(project, id); if (!l.ok) return l;
  if (!l.v.ok) return fail('bad-project', 'project.json has errors', { errors: l.v.errors });
  return { id, ...R.sheet(bin, l.dir, l.doc, l.v) };
}

// Same story, another look. The style blocks are added by code, so the shot prompts carry over as they are.
function restyle(project, id, spec) {
  const l = load(project, id); if (!l.ok) return l;
  const r = S.resolve(spec, stylesOf(project).styles);
  if (r.error) return fail('unknown-style', `unknown style "${spec}"`);
  const c = store.create(project, `${l.doc.title || id} ${r.style.id.replace('+', ' ')}`);
  if (!c.ok) return c;
  fs.mkdirSync(path.join(c.dir, 'media'));
  const doc = { ...l.doc, style: r.style.id, character: '', world: '' };
  delete doc.voice; delete doc.music;
  fs.writeFileSync(path.join(c.dir, 'project.json'), JSON.stringify(doc, null, 2) + '\n');
  return { ok: true, from: id, id: c.id, dir: c.dir, style: r.style.id, files: { project: path.join(c.dir, 'project.json'), media: path.join(c.dir, 'media') },
    note: 'character and world were cleared so the style-artist can redraw them in the new style' };
}

function addStyle(project, j) {
  const id = String(j.id || '');
  const all = stylesOf(project).styles;
  if (all[id] && !all[id].custom) return fail('builtin-style', `"${id}" is a built-in style; pick another name`);
  const s = { ...j }; delete s.id;
  const errors = S.validateStyle(id, s);
  if (errors.length) return fail('bad-style', 'the style has errors', { errors });
  const bad = store.planted(project); if (bad) return bad;
  const dir = path.join(store.root(project), 'styles');
  if (isLink(dir)) return fail('planted-state', 'the styles folder is a symlink; refusing it');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(store.root(project), '.gitignore'), '*\n');
  fs.writeFileSync(path.join(dir, `${id}.json`), JSON.stringify(s, null, 2) + '\n');
  return { ok: true, id, file: path.join(dir, `${id}.json`), use: `/video-creator:make ${id} <idea>` };
}

function list(project) {
  const bad = store.planted(project); if (bad) return bad;
  return { ok: true, projects: store.listIds(project).map((id) => {
    const dir = path.join(store.items(project), id); const has = (n) => fs.existsSync(path.join(dir, n));
    let st = 'new';
    try { st = JSON.parse(fs.readFileSync(path.join(dir, 'project.json'), 'utf8')).style; } catch { /* unreadable */ }
    return { id, style: st, status: has('video.mp4') ? 'rendered' : has('animatic.mp4') ? 'animatic' : has('prompts.md') ? 'prompted' : 'new', dir };
  }) };
}

function readInput(file) {
  const r = inputfile.readPrepFile(file);
  if (!r.ok) return r;
  let j;
  try { j = JSON.parse(r.text); } catch { return fail('bad-input', 'input file is not valid JSON'); }
  if (!j || typeof j !== 'object' || Array.isArray(j)) return fail('bad-input', 'input file must hold a JSON object');
  r.done();
  return { ok: true, j };
}

const USAGE = 'usage: vc.js doctor | styles | style <id|a+b> | prep | init --input-file F | check <id> | prompts <id> | animatic <id> | sheet <id> | render <id> [--draft] [--burn] | restyle <id> --style S | add-style --input-file F | list\n';

function main(argv) {
  const { _, flags } = parseArgs(argv, ['project', 'input-file', 'ffmpeg', 'style']);
  const project = path.resolve(flags.project || process.cwd());
  const bin = typeof flags.ffmpeg === 'string' ? flags.ffmpeg : 'ffmpeg';
  const [cmd, arg] = _;
  const withInput = (fn) => { const r = readInput(flags['input-file']); return r.ok ? fn(r.j) : r; };
  const cmds = {
    doctor: () => R.doctor(bin),
    styles: () => styles(project),
    style: () => style(project, arg),
    prep: () => store.planted(project) || inputfile.prep('input.json'),
    init: () => withInput((j) => init(project, { title: String(j.title || ''), style: String(j.style || ''), platform: String(j.platform || 'shorts') })),
    check: () => check(project, arg),
    prompts: () => prompts(project, arg),
    animatic: () => render(project, arg, bin, 'animatic', flags),
    sheet: () => sheet(project, arg, bin),
    render: () => render(project, arg, bin, flags.draft ? 'draft' : 'final', flags),
    restyle: () => restyle(project, arg, String(flags.style || '')),
    'add-style': () => withInput((j) => addStyle(project, j)),
    list: () => list(project),
  };
  if (!cmds[cmd]) { process.stderr.write(USAGE); return 2; }
  const res = cmds[cmd]();
  process.stdout.write(JSON.stringify(res, null, 2) + '\n');
  return res.ok ? 0 : 1;
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));
module.exports = { styles, style, init, check, prompts, render, sheet, restyle, addStyle, list, load, main };
