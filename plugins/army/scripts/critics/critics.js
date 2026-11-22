#!/usr/bin/env node
/*
 * Critics helper script. Zero dependencies, no network, Node 18+.
 *
 *   critics.js prep [--project DIR]         make a fresh temp folder, print {"input": "<tmp>/input.txt"}
 *   critics.js open --input-file F [--project DIR]  F is a text file HQ wrote (what is being tasted); the script
 *                                            derives the id itself ([a-z0-9-]), deletes F, creates
 *                                            .critics/tastings/<id>/ (with .gitignore "*"), prints JSON
 *   critics.js open <slug>                   legacy form (slug is sanitized), for tests and humans
 *   critics.js list [--project DIR]          list tastings with overall stars
 *   critics.js stars <id> [--project DIR]    star table for one tasting (robust to missing cards)
 *
 * No free text goes on a command line; pass only ids printed by open or list.
 * Tasting files never contain code from the project, only notes, so they are safe to read as data.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const inputfile = require('./inputfile');

const CRITICS = ['presentation', 'kitchen', 'recipe'];
const ID_RE = /^[a-z0-9][a-z0-9-]{0,80}$/;

function slugify(s) {
  const slug = String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/g, '');
  return slug || 'dish';
}

function isTracked(project, rel) {
  try {
    const out = execFileSync('git', ['-C', project, 'ls-files', '--', rel], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return out.trim().length > 0;
  } catch {
    return false; // not a git repo, or git missing: nothing can be tracked
  }
}

function isLink(p) { try { return fs.lstatSync(p).isSymbolicLink(); } catch { return false; } }

// Planted state: .critics tracked in git, or .critics / .critics/tastings symlinked or resolving outside the project.
function plantedCheck(project) {
  if (isTracked(project, '.critics')) {
    const e = new Error('critics-tracked: .critics/ is tracked in git. Remove it from the index (git rm -r --cached .critics) before tasting.');
    e.code = 'critics-tracked';
    throw e;
  }
  const real = fs.realpathSync(project);
  for (const p of [path.join(project, '.critics'), path.join(project, '.critics', 'tastings')]) {
    if (!fs.existsSync(p) && !isLink(p)) continue;
    if (isLink(p) || !(fs.realpathSync(p) + path.sep).startsWith(real + path.sep)) {
      const e = new Error(`critics-tracked: ${path.relative(project, p)} is a symlink or points outside the project; refusing to use it.`);
      e.code = 'critics-tracked';
      throw e;
    }
  }
}

function stamp(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function openTasting(project, slug, now = new Date()) {
  const root = path.join(project, '.critics');
  plantedCheck(project);
  fs.mkdirSync(path.join(root, 'tastings'), { recursive: true });
  fs.writeFileSync(path.join(root, '.gitignore'), '*\n');
  let id = `${stamp(now)}-${slugify(slug)}`;
  let n = 1;
  while (fs.existsSync(path.join(root, 'tastings', id))) id = `${stamp(now)}-${slugify(slug)}-${++n}`;
  const dir = path.join(root, 'tastings', id);
  fs.mkdirSync(dir);
  return { id, dir, menu: path.join(dir, 'menu.md') };
}

// "Stars: 2/3", "**Stars:** 2", "OVERALL: 3" (with or without star glyphs). Returns 0-3 or null.
function parseStars(text, key) {
  if (typeof text !== 'string') return null;
  const re = new RegExp(`^[ \\t>*_#-]*${key}[ \\t*_]*:[ \\t*_]*([0-3])(?![0-9])`, 'im');
  const m = text.match(re);
  return m ? Number(m[1]) : null;
}

function readIf(file) {
  try {
    if (isLink(file)) return null; return fs.readFileSync(file, 'utf8'); } catch { return null; }
}

function summarize(tastingDir) {
  const rows = CRITICS.map((c) => {
    const text = readIf(path.join(tastingDir, `card-${c}-critic.md`));
    return { critic: c, present: text !== null, stars: parseStars(text, 'Stars'), before: parseStars(text, 'Previous') };
  });
  const review = readIf(path.join(tastingDir, 'review.md'));
  return {
    rows,
    review: review !== null,
    overall: parseStars(review, 'Overall'),
    overallBefore: parseStars(review, 'Previous'),
    menu: fs.existsSync(path.join(tastingDir, 'menu.md')),
  };
}

const glyph = (n) => (n === null || n === undefined ? '?' : '*'.repeat(n) + '.'.repeat(3 - n));
const cell = (before, after) => {
  if (after === null) return 'pending';
  return before !== null && before !== after ? `${glyph(before)} -> ${glyph(after)}` : glyph(after);
};

function renderTable(id, s) {
  const lines = [`Tasting ${id}`, ''];
  for (const r of s.rows) {
    lines.push(`  ${(r.critic + ' critic').padEnd(20)} ${r.present ? cell(r.before, r.stars) : 'no card'}`);
  }
  lines.push(`  ${'HEAD CRITIC'.padEnd(20)} ${s.review ? cell(s.overallBefore, s.overall) : 'no review yet'}`);
  return lines.join('\n');
}

function validId(id) { return typeof id === 'string' && ID_RE.test(id); }

function tastingsDir(project) { return path.join(project, '.critics', 'tastings'); }

function listTastings(project) {
  const base = tastingsDir(project);
  let names = [];
  try { names = fs.readdirSync(base).filter((n) => validId(n) && !isLink(path.join(base, n)) && fs.statSync(path.join(base, n)).isDirectory()).sort(); } catch { /* none */ }
  return names.map((id) => ({ id, ...summarize(path.join(base, id)) }));
}

function parseArgs(argv) {
  const out = { _: [], project: process.cwd() };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--project') out.project = path.resolve(argv[++i] || '.');
    else if (argv[i] === '--input-file') out.input = argv[++i];
    else out._.push(argv[i]);
  }
  return out;
}

function main(argv) {
  const a = parseArgs(argv);
  const [cmd, arg] = a._;
  try {
    if (cmd === 'prep') {
      plantedCheck(a.project);
      console.log(JSON.stringify(inputfile.prep('input.txt')));
    } else if (cmd === 'open') {
      let text = arg;
      if (a.input) {
        const r = inputfile.readPrepFile(a.input);
        if (!r.ok) throw new Error(r.message);
        text = r.text.slice(0, 2000);
        plantedCheck(a.project);
        r.done();
      }
      if (!text) throw new Error('usage: critics.js open --input-file F');
      console.log(JSON.stringify(openTasting(a.project, text)));
    } else if (cmd === 'list') {
      plantedCheck(a.project);
      const all = listTastings(a.project);
      if (!all.length) return console.log('No tastings yet. Run /army:taste.');
      for (const t of all) console.log(`${t.id.padEnd(48)} ${t.review ? glyph(t.overall) : 'in progress'}`);
    } else if (cmd === 'stars') {
      plantedCheck(a.project);
      if (!validId(arg)) throw new Error('usage: critics.js stars <id> (id as printed by open or list)');
      const dir = path.join(tastingsDir(a.project), arg);
      if (!fs.existsSync(dir)) throw new Error(`no such tasting: ${arg}`);
      console.log(renderTable(arg, summarize(dir)));
    } else {
      console.log('usage: critics.js prep | open --input-file F | list | stars <id> [--project DIR]');
      return 1;
    }
  } catch (e) {
    console.error(e.message);
    return 2;
  }
  return 0;
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));
module.exports = { plantedCheck, slugify, openTasting, parseStars, summarize, renderTable, listTastings, validId, glyph };
