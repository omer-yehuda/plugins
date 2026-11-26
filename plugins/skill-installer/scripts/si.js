#!/usr/bin/env node
'use strict';
/* skill-installer CLI: browse skills and marketplaces, install a skill into Claude's skills folder.
   Adapted from OpenAI's Codex skill-installer (Apache-2.0); see NOTICE.

   node si.js list    [owner/repo[/path] | URL] [--json]
   node si.js install <owner/repo/path | URL> [--path p ...] [--all] [--name n] [--scope user|project] [--dry-run] [--force] [--accept] [--json]
     Every skill is scanned first (gate.js). DENIED never installs; SECONDARY INSPECTION needs --accept.
   node si.js market  [owner/repo] [--json]
   node si.js audit   [--scope user|project] [--json]  -> rescan installed skills, compare with skills.lock.json
   node si.js prep                       -> private temp folder for a request file
   node si.js run --request <file>       -> same ops, arguments read from JSON (no user text in the shell)
*/

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { InstallError, parseTarget, cleanPath, skillNameFrom } = require('./source');
const { Repo } = require('./github');
const inst = require('./install');
const gate = require('./gate');
const lock = require('./lock');
const auditor = require('./audit');

const DEFAULT_LIST = 'anthropics/skills/skills';
const DEFAULT_MARKET = 'omer-yehuda/plugins';

function parseArgv(argv) {
  const o = { op: argv[0], paths: [] };
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') o.json = true;
    else if (a === '--dry-run') o.dryRun = true;
    else if (a === '--force') o.force = true;
    else if (a === '--all') o.all = true;
    else if (a === '--accept') o.accept = true;
    else if (a === '--path') { while (argv[i + 1] && !argv[i + 1].startsWith('--')) o.paths.push(argv[++i]); }
    else if (['--name', '--scope', '--ref', '--local', '--dest', '--method', '--request'].includes(a)) o[a.slice(2)] = argv[++i];
    else if (!a.startsWith('--') && o.target === undefined) o.target = a;
    else throw new InstallError(`Unknown argument: ${a}`);
  }
  return o;
}

function fromRequest(file) {
  const real = fs.realpathSync(file);
  const tmp = fs.realpathSync(os.tmpdir());
  if (!path.basename(path.dirname(real)).startsWith('skill-installer-req-') || path.dirname(path.dirname(real)) !== tmp) {
    throw new InstallError('Request file must be inside the folder made by "si.js prep".');
  }
  const r = JSON.parse(fs.readFileSync(real, 'utf8'));
  const str = (v) => (v === undefined || v === null ? undefined : String(v));
  return {
    op: str(r.op), target: str(r.target), paths: Array.isArray(r.paths) ? r.paths.map(String) : [], all: !!r.all,
    name: str(r.name), scope: str(r.scope), ref: str(r.ref), dryRun: !!r.dryRun, force: !!r.force, accept: r.accept === true, json: true,
  };
}

function distance(a, b) { // Levenshtein, for "did you mean"
  const d = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0]; d[0] = i;
    for (let j = 1; j <= b.length; j++) { const t = d[j]; d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = t; }
  }
  return d[b.length];
}

function source(o, fallback) {
  const src = parseTarget(o.target || fallback, o.ref || 'main');
  if (o.local) src.local = path.resolve(o.local);
  return src;
}

async function list(o) {
  const src = source(o, DEFAULT_LIST);
  const repo = new Repo(src, o.method);
  try {
    const dirs = await repo.skillDirs(src.path);
    const have = new Set([...inst.installedNames(inst.destRoot('user')), ...inst.installedNames(inst.destRoot('project'))]);
    const skills = await Promise.all(dirs.map(async (d) => {
      const fm = inst.frontmatter((await repo.raw(d ? `${d}/SKILL.md` : 'SKILL.md')).toString('utf8')) || {};
      const folder = path.posix.basename(d) || src.repo;
      return { name: folder, path: d, description: (fm.description || '').replace(/\s+/g, ' ').slice(0, 160), installed: have.has(folder) };
    }));
    return { repo: `${src.owner}/${src.repo}`, ref: src.ref, via: repo.via, count: skills.length, skills };
  } finally { repo.close(); }
}

async function install(o) {
  const src = source(o);
  const repo = new Repo(src, o.method);
  const t0 = Date.now();
  try {
    let dirs = o.paths.length ? o.paths.map((p) => cleanPath([src.path, cleanPath(p)].filter(Boolean).join('/'))) : [src.path];
    if (o.all) dirs = await repo.skillDirs(src.path);
    if (!o.all) {
      const all = await repo.skillDirs('');
      const missing = dirs.find((d) => !all.includes(d));
      if (missing !== undefined) {
        const near = all.filter((d) => d.startsWith(path.posix.dirname(missing) === '.' ? '' : path.posix.dirname(missing)));
        const base = path.posix.basename(missing);
        const best = all.map((d) => [d, distance(base, path.posix.basename(d))]).sort((a, b) => a[1] - b[1])[0];
        const guess = best && best[1] <= Math.max(2, Math.floor(base.length / 4)) ? best[0] : undefined;
        return { ok: false, error: `No SKILL.md at ${missing || 'repo root'}.${guess ? ` Did you mean ${guess}?` : ''} Skills found in this repo:`, didYouMean: guess, choices: (near.length ? near : all).slice(0, 50) };
      }
    }
    const root = o.dest ? path.resolve(o.dest) : inst.destRoot(o.scope || 'user');
    const results = [];
    const locked = lock.read(root).skills;
    for (const d of dirs) {
      const name = skillNameFrom(d || src.repo, dirs.length === 1 ? o.name : undefined);
      const files = await repo.files(d);
      const fm = inst.validate(files);
      const scan = gate.inspectFiles(files);
      const hashes = lock.hashFiles(files);
      const bytes = files.reduce((n, f) => n + f.buf.length, 0);
      const r = { name, from: `${src.owner}/${src.repo}/${d}`, skillName: fm.name, commit: repo.commit, files: files.length, bytes,
        scripts: inst.hasScripts(files), verdict: scan.verdict, findings: scan.findings, warnings: inst.risks(files), action: gate.decide(scan.verdict, o.accept) };
      if (locked[name]) Object.assign(r, { previousCommit: locked[name].commit, changes: lock.diff(locked[name].files, hashes.files) });
      if (o.dryRun) r.wouldInstallTo = path.join(root, name);
      else if (r.action === 'install') {
        Object.assign(r, inst.write(root, name, files, { force: o.force }));
        lock.record(root, name, { source: `${src.owner}/${src.repo}`, path: d, ref: src.ref, commit: repo.commit, sha256: hashes.sha256,
          files: hashes.files, verdict: scan.verdict, accepted: scan.verdict !== 'CLEARED', installedAt: new Date().toISOString() });
      }
      results.push(r);
    }
    const held = o.dryRun ? [] : results.filter((r) => r.action !== 'install');
    const error = held.length ? `Not installed: ${held.map((r) => `${r.name} (${r.verdict})`).join(', ')}.` : undefined;
    return { ok: !held.length, error, dryRun: !!o.dryRun, via: repo.via, ms: Date.now() - t0, installed: results, restart: !o.dryRun && held.length < results.length };
  } finally { repo.close(); }
}

async function market(o) {
  const src = source(o, DEFAULT_MARKET);
  const repo = new Repo(src, o.method);
  try {
    const m = JSON.parse((await repo.raw('.claude-plugin/marketplace.json')).toString('utf8'));
    const mk = String(m.name || '').replace(/[^A-Za-z0-9_.-]/g, '');
    const plugins = (m.plugins || []).map((p) => {
      const n = String(p.name || '').replace(/[^A-Za-z0-9_.-]/g, '');
      return { name: n, category: p.category || '', description: String(p.description || '').slice(0, 200), install: `/plugin install ${n}@${mk}` };
    });
    return { marketplace: mk, repo: `${src.owner}/${src.repo}`, add: `/plugin marketplace add ${src.owner}/${src.repo}`, count: plugins.length, plugins };
  } finally { repo.close(); }
}

function text(op, r) {
  if (op === 'list') return [`Skills in ${r.repo} (${r.count}):`, ...r.skills.map((s, i) => `${i + 1}. ${s.name}${s.installed ? ' (already installed)' : ''}${s.description ? ' - ' + s.description : ''}`)].join('\n');
  if (op === 'market') return [`${r.marketplace} (${r.count} plugins). First: ${r.add}`, ...r.plugins.map((p) => `- ${p.name}: ${p.description}\n    ${p.install}`)].join('\n');
  if (op === 'audit') return auditor.text(r);
  if (!r.ok && !r.installed) return `${r.error}\n${(r.choices || []).map((c) => '  ' + c).join('\n')}`;
  const VERBS = { install: ['Would install', 'Installed'], 'needs-approval': ['Needs your OK first', 'Held back (needs your OK)'], blocked: ['Would be blocked', 'Blocked'] };
  const verb = (x) => VERBS[x.action][r.dryRun ? 0 : 1];
  return r.installed.map((x) => `${verb(x)} ${x.name} -> ${x.dest || x.wouldInstallTo || '(not written)'} (${x.files} files, customs: ${x.verdict})` +
    x.findings.map((f) => `\n  ${f.sev} ${f.rule} ${f.file}:${f.line} ${f.why}`).join('') +
    x.warnings.map((w) => `\n  check: ${w.file} ${w.why}`).join('')).join('\n') + (r.dryRun ? '' : '\nRestart Claude Code (or /reload-plugins) to pick up new skills.');
}

async function main(argv) {
  let o = parseArgv(argv);
  if (o.op === 'prep') {
    const dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'skill-installer-req-'));
    console.log(JSON.stringify({ ok: true, dir, request: path.join(dir, 'request.json') }));
    return 0;
  }
  if (o.op === 'run') { if (!o.request) throw new InstallError('run needs --request <file>.'); o = fromRequest(o.request); }
  const ops = { list, install, market, audit: (q) => auditor.audit(q.scope) };
  if (!ops[o.op]) throw new InstallError('Usage: si.js list|install|market|audit|prep|run (see the header of si.js).');
  const r = await ops[o.op](o);
  console.log(o.json ? JSON.stringify(r, null, 2) : text(o.op, r));
  return r.ok === false ? 1 : 0;
}

main(process.argv.slice(2)).then((c) => process.exit(c), (e) => {
  const msg = e instanceof InstallError || e instanceof SyntaxError ? e.message : `${e.name}: ${e.message}`;
  console.error(`Error: ${msg}`);
  if (process.argv.includes('--json') || process.argv[2] === 'run') console.log(JSON.stringify({ ok: false, error: msg }));
  process.exit(2);
});
