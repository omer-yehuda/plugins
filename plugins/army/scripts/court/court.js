#!/usr/bin/env node
/*
 * Code Court helper. Zero dependencies (Node 18+), no network.
 *
 *   court.js prep [--project DIR]                  make a fresh temp folder, print {"input": "<tmp>/input.json"}
 *   court.js open --input-file F [--project DIR]   F is that prep path, JSON {"title": "...", "options": ["A","B"]}
 *                                                  (written by HQ with the Write tool; deleted after a good parse)
 *   court.js open <slug> --options "A|B|C"         legacy form, for tests and humans only
 *   court.js list [--project DIR]                  list cases and their rulings (JSON)
 *   court.js path <id> [--project DIR]             print the absolute path of a case folder
 *
 * No free text ever goes on a command line: ids are made by this script ([a-z0-9-], max 48 chars)
 * and every id passed back in is validated against ID_RE.
 *
 * .court/ is local state. `open` writes .court/.gitignore ("*") and refuses to run when .court/ is
 * tracked in git (a repository could otherwise plant fake cases or verdicts).
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const inputfile = require('./inputfile');

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 4;
const MAX_SLUG = 40; // plus 4 chars of number prefix: ids stay under 48
const ID_RE = /^\d{3}-[a-z0-9]+(?:-[a-z0-9]+)*$/;

function parseArgs(argv) {
  const out = { _: [], flags: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--options' || a === '--project' || a === '--input-file') out.flags[a.slice(2)] = argv[++i];
    else out._.push(a);
  }
  return out;
}

function slugify(text) {
  return String(text || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '').slice(0, MAX_SLUG).replace(/-+$/g, '');
}

function parseOptions(raw) {
  const seen = new Set();
  const options = [];
  for (const part of String(raw || '').split('|')) {
    const name = part.trim();
    if (name && !seen.has(name.toLowerCase())) { seen.add(name.toLowerCase()); options.push(name); }
  }
  return options;
}

function isTracked(project) {
  try {
    const out = execFileSync('git', ['ls-files', '--', '.court'], { cwd: project, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return out.split('\n').filter(Boolean);
  } catch { return []; } // not a git repo, or git missing
}

function isLink(p) { try { return fs.lstatSync(p).isSymbolicLink(); } catch { return false; } }

// Refuse planted state: tracked in git, or state folders that are symlinks / resolve outside the project.
function plantedCheck(project) {
  const tracked = isTracked(project);
  if (tracked.length) {
    return { ok: false, error: 'planted-court', message: '.court/ is tracked in this git repository, so it came from the repository, not from your trials. Remove it from git before using Code Court.', trackedFiles: tracked.slice(0, 10) };
  }
  const real = fs.existsSync(project) ? fs.realpathSync(project) : project;
  for (const p of [courtDir(project), casesDir(project)]) {
    if (!fs.existsSync(p) && !isLink(p)) continue;
    if (isLink(p) || !(fs.realpathSync(p) + path.sep).startsWith(real + path.sep)) {
      return { ok: false, error: 'planted-court', message: `${path.relative(project, p)} is a symlink or points outside the project; refusing to use it.` };
    }
  }
  return null;
}

const courtDir = (project) => path.join(project, '.court');
const casesDir = (project) => path.join(courtDir(project), 'cases');

function listIds(project) {
  try {
    return fs.readdirSync(casesDir(project), { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.isSymbolicLink() && ID_RE.test(d.name)).map((d) => d.name).sort();
  } catch { return []; }
}

function openCase(project, slugInput, optionsRaw) {
  const options = parseOptions(optionsRaw);
  if (options.length < MIN_OPTIONS) return { ok: false, error: 'a trial needs at least two sides', options };
  if (options.length > MAX_OPTIONS) return { ok: false, error: `a trial takes at most ${MAX_OPTIONS} sides`, options };
  const slug = slugify(slugInput);
  if (!slug) return { ok: false, error: 'give the case a short name (letters and digits)' };
  const planted = plantedCheck(project);
  if (planted) return planted;
  fs.mkdirSync(casesDir(project), { recursive: true });
  fs.writeFileSync(path.join(courtDir(project), '.gitignore'), '*\n');
  const last = listIds(project).reduce((m, id) => Math.max(m, parseInt(id.slice(0, 3), 10)), 0);
  const id = `${String(last + 1).padStart(3, '0')}-${slug}`;
  const dir = path.join(casesDir(project), id);
  fs.mkdirSync(dir);
  return { ok: true, id, dir, options, optionSlugs: options.map((o) => slugify(o) || 'option'),
    files: { case: path.join(dir, 'case.md'), evidence: path.join(dir, 'evidence.md'), verdict: path.join(dir, 'verdict.md') } };
}

// verdict.md starts with a line "Ruling: <option>"; anything else counts as no ruling.
function readRuling(dir) {
  try {
    if (isLink(path.join(dir, 'verdict.md'))) return null;
    const m = /^Ruling:\s*(.+)$/m.exec(fs.readFileSync(path.join(dir, 'verdict.md'), 'utf8'));
    return m ? m[1].trim().slice(0, 120) : null;
  } catch { return null; }
}

function listCases(project) {
  return listIds(project).map((id) => {
    const dir = path.join(casesDir(project), id);
    const ruling = readRuling(dir);
    return { id, status: ruling ? 'ruled' : 'open', ruling, dir };
  });
}

function casePath(project, id) {
  if (!ID_RE.test(String(id || ''))) return { ok: false, error: 'invalid case id' };
  const dir = path.join(casesDir(project), id);
  return fs.existsSync(dir) && !isLink(dir) ? { ok: true, id, dir } : { ok: false, error: 'no such case' };
}

// Reads {"title","options"} from a prep-folder file HQ wrote, then deletes it (only after a good parse).
// Never executes or evals anything.
function readInput(file) {
  const r = inputfile.readPrepFile(file);
  if (!r.ok) return { error: r.message };
  let j;
  try { j = JSON.parse(r.text); } catch { return { error: 'input file is not valid JSON' }; }
  if (!j || typeof j !== 'object') return { error: 'input file is not valid JSON' };
  r.done();
  const opts = Array.isArray(j.options) ? j.options.map((o) => String(o).replace(/\|/g, '/')).join('|') : String(j.options || '');
  return { title: String(j.title || ''), options: opts };
}

function main(argv) {
  const { _, flags } = parseArgs(argv);
  const project = path.resolve(flags.project || process.cwd());
  const [cmd, arg] = _;
  let res;
  if (cmd === 'prep') {
    res = plantedCheck(project) || inputfile.prep('input.json');
  } else if (cmd === 'open') {
    const inp = flags['input-file'] ? readInput(flags['input-file']) : { title: arg, options: flags.options };
    res = inp.error ? { ok: false, error: inp.error } : openCase(project, inp.title, inp.options);
  } else if (cmd === 'list' || cmd === 'path') {
    res = plantedCheck(project) || (cmd === 'list' ? { ok: true, cases: listCases(project) } : casePath(project, arg));
  } else { process.stderr.write('usage: court.js prep | open --input-file F | list | path <id>\n'); return 2; }
  process.stdout.write(JSON.stringify(res, null, 2) + '\n');
  return res.ok ? 0 : 1;
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));
module.exports = { plantedCheck, slugify, parseOptions, openCase, listCases, casePath, readRuling, ID_RE };
