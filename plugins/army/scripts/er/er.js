#!/usr/bin/env node
/*
 * Bug ER control script. Zero dependencies (Node 18+), no network.
 *
 *   er.js prep [--project DIR]                         make a fresh temp folder, print {"input": "<tmp>/input.txt"}
 *   er.js admit --input-file F [--project DIR]         F holds the bug report as plain text (written by HQ with
 *                                                      the Write tool). The script derives the id itself
 *                                                      ([a-z0-9-]), saves F as report.txt in the chart and deletes F.
 *   er.js admit <slug>                                 legacy form (slug is sanitized), for tests and humans
 *   er.js list  [--project DIR]                        list charts (JSON)
 *   er.js show  [id] [--project DIR]                   print a chart's files (latest when id is omitted);
 *                                                      pass only ids printed by `list`
 *   er.js incision [--base REF] [--max-files N] [--max-lines N] [--exclude-tests] [--project DIR]
 *                                                      measure the working-tree diff against the incision budget
 *
 * .er/ is local and private: admit writes .er/.gitignore ("*") and refuses to run when .er/ is tracked
 * in git (a repository could otherwise plant a fake chart). incision exits 0 when within budget, 2 when over.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const inputfile = require('./inputfile');

const DEFAULT_MAX_FILES = 3;
const DEFAULT_MAX_LINES = 40;
const ID_RE = /^\d{8}-\d{6}-[a-z0-9-]{1,40}$/;
const TEST_RE = /(^|\/)(tests?|__tests__|specs?)\/|\.(test|spec)\.[a-z0-9]+$|_test\.(py|go|rb)$|(^|\/)test_[^/]*\.py$/i;

function parseArgs(argv) {
  const out = { _: [], flags: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--') && key !== 'exclude-tests') { out.flags[key] = next; i++; }
      else out.flags[key] = true;
    } else out._.push(a);
  }
  return out;
}

function git(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
}

function projectRoot(flags) {
  const start = path.resolve(typeof flags.project === 'string' ? flags.project : process.cwd());
  try { return git(['rev-parse', '--show-toplevel'], start).trim(); } catch { return start; }
}

function isGitRepo(root) {
  try { git(['rev-parse', '--git-dir'], root); return true; } catch { return false; }
}

function die(obj, code = 1) {
  process.stdout.write(JSON.stringify(obj, null, 2) + '\n');
  process.exit(code);
}

function slugify(s) {
  const slug = String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/g, '');
  return slug || 'bug';
}

function stamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}-${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`;
}

function trackedEr(root) {
  if (!isGitRepo(root)) return '';
  try { return git(['ls-files', '--', '.er'], root).trim(); } catch { return ''; }
}

function isLink(p) { try { return fs.lstatSync(p).isSymbolicLink(); } catch { return false; } }

// Planted state: .er/ tracked in git, or .er / .er/charts being a symlink or resolving outside the project.
function plantedCheck(root) {
  const tracked = trackedEr(root);
  if (tracked) {
    die({
      error: 'planted-chart',
      message: '.er/ is tracked in this git repository, so it came from the repository, not from your past ER visits. Remove it from git (git rm -r --cached .er) before using Bug ER.',
      trackedFiles: tracked.split('\n').slice(0, 10),
    });
  }
  const real = fs.realpathSync(root);
  for (const p of [path.join(root, '.er'), path.join(root, '.er', 'charts')]) {
    if (!fs.existsSync(p) && !isLink(p)) continue;
    if (isLink(p) || !(fs.realpathSync(p) + path.sep).startsWith(real + path.sep)) {
      die({ error: 'planted-chart', message: `${path.relative(root, p)} is a symlink or points outside the project; refusing to use it.` });
    }
  }
}

// ------------------------------------------------------------------ admit
function prepCmd(flags) {
  const root = projectRoot(flags);
  plantedCheck(root);
  die(inputfile.prep('input.txt'), 0);
}

function admit(args, flags) {
  const root = projectRoot(flags);
  plantedCheck(root);
  let text = args.join(' ');
  let done = null;
  const inputFile = typeof flags['input-file'] === 'string' ? flags['input-file'] : null;
  if (inputFile) {
    const r = inputfile.readPrepFile(inputFile);
    if (!r.ok) die({ error: r.error, message: r.message });
    text = r.text;
    done = r.done;
  }
  const erDir = path.join(root, '.er');
  fs.mkdirSync(path.join(erDir, 'charts'), { recursive: true });
  fs.writeFileSync(path.join(erDir, '.gitignore'), '*\n');
  const base = `${stamp()}-${slugify(text)}`;
  let id = base;
  for (let n = 2; fs.existsSync(path.join(erDir, 'charts', id)); n++) id = `${base.slice(0, 40 + 16)}-${n}`;
  const dir = path.join(erDir, 'charts', id);
  fs.mkdirSync(dir);
  if (inputFile) {
    fs.writeFileSync(path.join(dir, 'report.txt'), text.slice(0, 200000));
    if (done) done();
  }
  die({ id, chartDir: dir, projectRoot: root, git: isGitRepo(root), budget: { maxFiles: DEFAULT_MAX_FILES, maxLines: DEFAULT_MAX_LINES } }, 0);
}

// ------------------------------------------------------------------ list / show
function chartsDir(root) { return path.join(root, '.er', 'charts'); }

function listCharts(root) {
  const dir = chartsDir(root);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.isSymbolicLink() && ID_RE.test(e.name))
    .map((e) => e.name).sort().reverse()
    .map((id) => ({
      id,
      files: fs.readdirSync(path.join(dir, id), { withFileTypes: true })
        .filter((f) => f.isFile() && !f.isSymbolicLink() && f.name.endsWith('.md')).map((f) => f.name).sort(),
    }));
}

function list(flags) {
  const root = projectRoot(flags);
  plantedCheck(root);
  die({ charts: listCharts(root) }, 0);
}

function show(args, flags) {
  const root = projectRoot(flags);
  plantedCheck(root);
  const charts = listCharts(root);
  if (!charts.length) die({ error: 'no-charts', message: 'No charts yet. Admit a bug with /army:admit.' });
  const want = args[0];
  let chart = charts[0];
  if (want) {
    if (!/^[a-z0-9-]+$/.test(want)) die({ error: 'bad-id', message: 'Chart ids contain only lowercase letters, digits and hyphens.' });
    const hits = charts.filter((c) => c.id === want || c.id.startsWith(want) || c.id.includes(want));
    if (hits.length === 0) die({ error: 'not-found', message: `No chart matches "${want}".`, charts: charts.map((c) => c.id) });
    if (hits.length > 1 && !hits.some((c) => c.id === want)) die({ error: 'ambiguous', message: `"${want}" matches several charts.`, charts: hits.map((c) => c.id) });
    chart = hits.find((c) => c.id === want) || hits[0];
  }
  const out = [`# Chart ${chart.id}`];
  for (const f of chart.files) {
    out.push(`\n## ${f}\n`, fs.readFileSync(path.join(chartsDir(root), chart.id, f), 'utf8'));
  }
  process.stdout.write(out.join('\n') + '\n');
}

// ------------------------------------------------------------------ incision
function isTestFile(p) { return TEST_RE.test(p.replace(/\\/g, '/')); }

function countLines(file) {
  try {
    const buf = fs.readFileSync(file);
    if (buf.includes(0)) return null;
    const s = buf.toString('utf8');
    return s === '' ? 0 : s.split('\n').length - (s.endsWith('\n') ? 1 : 0);
  } catch { return 0; }
}

function posInt(v, def, name) {
  if (v === undefined) return def;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0) die({ error: 'bad-arg', message: `--${name} must be a non-negative integer.` });
  return n;
}

function incision(flags) {
  const root = projectRoot(flags);
  if (!isGitRepo(root)) die({ error: 'not-a-repo', message: 'incision needs a git repository.' });
  const base = typeof flags.base === 'string' ? flags.base : 'HEAD';
  if (/^-/.test(base)) die({ error: 'bad-arg', message: '--base must be a git ref.' });
  const maxFiles = posInt(flags['max-files'], DEFAULT_MAX_FILES, 'max-files');
  const maxLines = posInt(flags['max-lines'], DEFAULT_MAX_LINES, 'max-lines');
  const excludeTests = flags['exclude-tests'] === true;

  let numstat;
  try { numstat = git(['diff', '--numstat', '--no-renames', base, '--'], root); }
  catch (e) { die({ error: 'bad-base', message: `Cannot diff against "${base}".` }); }

  const entries = new Map();
  for (const line of numstat.split('\n').filter(Boolean)) {
    const [a, d, ...rest] = line.split('\t');
    const file = rest.join('\t');
    entries.set(file, { file, added: a === '-' ? 0 : Number(a), deleted: d === '-' ? 0 : Number(d), binary: a === '-', untracked: false });
  }
  const untracked = git(['ls-files', '--others', '--exclude-standard', '-z'], root).split('\0').filter(Boolean);
  for (const file of untracked) {
    if (file.startsWith('.er/')) continue;
    const n = countLines(path.join(root, file));
    entries.set(file, { file, added: n === null ? 0 : n, deleted: 0, binary: n === null, untracked: true });
  }

  const all = [...entries.values()].map((e) => ({ ...e, test: isTestFile(e.file) })).sort((x, y) => x.file.localeCompare(y.file));
  const counted = excludeTests ? all.filter((e) => !e.test) : all;
  const files = counted.length;
  const lines = counted.reduce((s, e) => s + e.added + e.deleted, 0);
  const withinBudget = files <= maxFiles && lines <= maxLines;
  const result = {
    base, excludeTests,
    budget: { maxFiles, maxLines },
    files, lines,
    added: counted.reduce((s, e) => s + e.added, 0),
    deleted: counted.reduce((s, e) => s + e.deleted, 0),
    withinBudget,
    over: [files > maxFiles ? 'files' : null, lines > maxLines ? 'lines' : null].filter(Boolean),
    changes: all,
  };
  die(result, withinBudget ? 0 : 2);
}

// ------------------------------------------------------------------ main
function main() {
  const { _, flags } = parseArgs(process.argv.slice(2));
  const [cmd, ...rest] = _;
  switch (cmd) {
    case 'prep': return prepCmd(flags);
    case 'admit': return admit(rest, flags);
    case 'list': return list(flags);
    case 'show': return show(rest, flags);
    case 'incision': return incision(flags);
    default:
      process.stderr.write('usage: er.js prep | admit --input-file F | list | show [id] | incision [--base REF] [--max-files N] [--max-lines N] [--exclude-tests]\n');
      process.exit(1);
  }
}

if (require.main === module) main();
module.exports = { plantedCheck, slugify, isTestFile, stamp };
