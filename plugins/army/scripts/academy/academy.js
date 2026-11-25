#!/usr/bin/env node
/*
 * The Academy helper. Zero dependencies (Node 18+). Only `run` starts other programs: git, the checks in
 * the exam, and the `claude` CLI in headless mode, which spends real tokens.
 *
 *   academy.js prep [--project DIR]                  make a fresh temp folder, print {"input": "<tmp>/input.json"}
 *   academy.js enroll --input-file F [--project DIR] F is that prep path, JSON {"title": "...", "skill": "<path in the project>"}
 *   academy.js check <id>                            validate exam.json and count the runs it needs
 *   academy.js run <id> [--repeat N] [--only a,b] [--max-turns N] [--model M] [--claude BIN] [--keep]
 *   academy.js transcript <id>                       print the report card of the last run
 *   academy.js list
 *
 * Each mission runs twice per repeat: plain Claude Code, then with --plugin-dir <the skill's plugin>.
 * Runs happen in temporary copies of the fixtures with a local bare "origin", so pushes are detectable
 * and nothing leaves the machine. The prompt is sent on stdin, never on a command line.
 * Checks of type "cmd" are shell commands from exam.json: read the exam before you run it.
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const inputfile = require('./inputfile');
const { make, isLink, parseArgs } = require('./state');
const exam = require('./exam');

const store = make('.academy', 'exams', 'planted-academy');
const MODEL_RE = /^[A-Za-z0-9._:-]{1,60}$/;
const fail = (error, message, extra) => ({ ok: false, error, message, ...extra });

function frontmatter(file) {
  let text;
  try { text = isLink(file) ? '' : fs.readFileSync(file, 'utf8'); } catch { return null; }
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!m) return null;
  const get = (k) => { const x = new RegExp(`^${k}:\\s*(.+)$`, 'm').exec(m[1]); return x ? x[1].trim().replace(/^["']|["']$/g, '').slice(0, 600) : ''; };
  return { name: get('name'), description: get('description') };
}

// The skill must be inside the project and inside a plugin (a folder with .claude-plugin/plugin.json).
function resolveSkill(project, given) {
  const real = fs.realpathSync(project);
  let target;
  try { target = fs.realpathSync(path.resolve(project, String(given || ''))); } catch { return fail('no-skill', 'that path does not exist'); }
  if (target !== real && !(target + path.sep).startsWith(real + path.sep)) return fail('no-skill', 'the skill must be inside this project');
  if (fs.statSync(target).isFile()) target = path.dirname(target);
  let pluginDir = null;
  for (let d = target; ; d = path.dirname(d)) {
    if (fs.existsSync(path.join(d, '.claude-plugin', 'plugin.json'))) { pluginDir = d; break; }
    if (d === real || d === path.dirname(d)) break;
  }
  if (!pluginDir) return fail('not-a-plugin', 'the skill is not inside a plugin (no .claude-plugin/plugin.json above it). The Academy grades plugin skills only.');
  const files = [];
  if (fs.existsSync(path.join(target, 'SKILL.md'))) files.push(path.join(target, 'SKILL.md'));
  else {
    try {
      for (const d of fs.readdirSync(path.join(pluginDir, 'skills'), { withFileTypes: true })) {
        const f = path.join(pluginDir, 'skills', d.name, 'SKILL.md');
        if (d.isDirectory() && fs.existsSync(f)) files.push(f);
      }
    } catch { /* no skills folder */ }
  }
  const skills = files.map((f) => ({ file: f, ...(frontmatter(f) || { name: path.basename(path.dirname(f)), description: '' }) }));
  if (!skills.length) return fail('no-skill', 'no SKILL.md found there');
  return { ok: true, pluginDir, skills };
}

function enroll(project, title, given) {
  const s = resolveSkill(project, given);
  if (!s.ok) return s;
  const made = store.create(project, title || path.basename(s.pluginDir));
  if (!made.ok) return made;
  const file = (n) => path.join(made.dir, n);
  fs.mkdirSync(file('fixtures'));
  fs.writeFileSync(file('enrolment.json'), JSON.stringify({ pluginDir: s.pluginDir, skills: s.skills }, null, 2) + '\n');
  return { ok: true, id: made.id, dir: made.dir, pluginDir: s.pluginDir, skills: s.skills,
    files: { exam: file('exam.json'), fixtures: file('fixtures'), results: file('results.json'), transcript: file('transcript.md') } };
}

function load(project, id) {
  const p = store.planted(project) || store.pathOf(project, id);
  if (!p.ok) return p;
  const read = (n) => { const f = path.join(p.dir, n); return isLink(f) ? null : JSON.parse(fs.readFileSync(f, 'utf8')); };
  let ex; let enrol;
  try { enrol = read('enrolment.json'); } catch { return fail('not-enrolled', 'this exam has no enrolment.json'); }
  try { ex = read('exam.json'); } catch { return fail('no-exam', 'exam.json is missing or is not valid JSON. The examiner writes it after enrolment.'); }
  if (!ex || !enrol) return fail('no-exam', 'exam files are symlinks; refusing them');
  const v = exam.validate(ex, path.join(p.dir, 'fixtures'));
  return { ok: v.ok, error: v.ok ? undefined : 'bad-exam', dir: p.dir, id, exam: ex, pluginDir: enrol.pluginDir, validation: v };
}

function check(project, id, repeat) {
  const l = load(project, id);
  if (!l.validation) return l;
  return { ok: l.ok, id, ...l.validation, runs: l.validation.ok ? l.validation.missions * 2 * repeat : 0, repeat,
    note: 'each run is one headless Claude Code session and spends real tokens' };
}

function gitc(cwd, args) { execFileSync('git', ['-c', 'user.name=exam', '-c', 'user.email=exam@local', '-c', 'commit.gpgsign=false', ...args], { cwd, stdio: 'ignore' }); }

function workdir(fixture) {
  const dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'academy-run-'));
  const work = path.join(dir, 'work');
  if (fixture) fs.cpSync(fixture, work, { recursive: true }); else fs.mkdirSync(work);
  try {
    gitc(work, ['init', '-q']); gitc(work, ['add', '-A']); gitc(work, ['commit', '-q', '--allow-empty', '-m', 'init']);
    execFileSync('git', ['init', '-q', '--bare', path.join(dir, 'origin.git')], { stdio: 'ignore' });
    gitc(work, ['remote', 'add', 'origin', path.join(dir, 'origin.git')]);
  } catch { /* git missing: the run still happens, push checks will fail */ }
  return { dir, work };
}

function runOne(m, variant, o) {
  const w = workdir(m.fixture ? path.join(o.fixtures, m.fixture) : null);
  const args = ['-p', '--output-format', 'json', '--max-turns', String(o.maxTurns)];
  if (o.model) args.push('--model', o.model);
  if (variant === 'skill') args.push('--plugin-dir', o.win ? `"${o.pluginDir}"` : o.pluginDir);
  const t0 = Date.now();
  const r = spawnSync(o.claude, args, { cwd: w.work, input: m.prompt, encoding: 'utf8', timeout: 30 * 60 * 1000, maxBuffer: 64 * 1024 * 1024, shell: o.win });
  let out = {};
  try { out = JSON.parse(r.stdout); } catch { out = { result: r.stdout || r.stderr || '' }; }
  const answer = String((out && out.result) || '');
  const results = m.checks.map((c) => {
    if (c.cmd) return spawnSync(c.cmd, { cwd: w.work, shell: true, stdio: 'ignore', timeout: 120000, env: { ...process.env, EXAM_WORK: w.work } }).status === 0;
    if (c.answer) return exam.toRegex(c.answer).test(answer);
    return !exam.toRegex(c.answerNot).test(answer);
  });
  const u = (out && out.usage) || {};
  const row = { mission: m.id, kind: m.kind, variant, passed: results.filter(Boolean).length, total: results.length, checks: results,
    tokens: (u.input_tokens || 0) + (u.output_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0),
    cost: Number(out && out.total_cost_usd) || 0, turns: Number(out && out.num_turns) || 0, seconds: Math.round((Date.now() - t0) / 1000),
    started: !r.error };
  if (o.keep) row.dir = w.dir; else { try { fs.rmSync(w.dir, { recursive: true, force: true }); } catch { /* best effort */ } }
  return row;
}

function run(project, id, flags) {
  const l = load(project, id);
  if (!l.ok) return l.validation ? { ok: false, error: 'bad-exam', ...l.validation } : l;
  const repeat = Math.min(5, Math.max(1, parseInt(flags.repeat, 10) || 1));
  const maxTurns = Math.min(200, Math.max(1, parseInt(flags['max-turns'], 10) || 40));
  if (flags.model && !MODEL_RE.test(String(flags.model))) return fail('bad-model', 'the model name has characters that are not allowed');
  const win = process.platform === 'win32';
  if (win && /["%!^&|<>]/.test(l.pluginDir)) return fail('bad-path', 'the plugin path has characters that cannot be passed safely on Windows');
  const only = typeof flags.only === 'string' ? flags.only.split(',') : null;
  const missions = l.exam.missions.filter((m) => !only || only.includes(m.id));
  if (!missions.length) return fail('no-missions', 'no mission matches --only');
  const o = { fixtures: path.join(l.dir, 'fixtures'), pluginDir: l.pluginDir, maxTurns, model: flags.model, claude: typeof flags.claude === 'string' ? flags.claude : 'claude', keep: !!flags.keep, win };
  const rows = [];
  for (const m of missions) for (let i = 0; i < repeat; i++) for (const v of ['baseline', 'skill']) {
    const row = runOne(m, v, o);
    rows.push(row);
    process.stderr.write(`${m.id} ${v}: ${row.passed}/${row.total}\n`);
  }
  if (rows.every((r) => !r.started)) return fail('no-claude', `could not start "${o.claude}". Install the Claude Code CLI and sign in.`);
  const g = exam.grade(rows);
  const res = { ok: true, id, at: new Date().toISOString(), repeat, ...g, rows };
  fs.writeFileSync(path.join(l.dir, 'results.json'), JSON.stringify(res, null, 2) + '\n');
  fs.writeFileSync(path.join(l.dir, 'transcript.md'), exam.transcript(id, g, rows));
  return { ...res, transcript: path.join(l.dir, 'transcript.md') };
}

function readResults(dir) {
  try { const f = path.join(dir, 'results.json'); return isLink(f) ? null : JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; }
}

function list(project) {
  return store.listIds(project).map((id) => {
    const r = readResults(path.join(store.items(project), id));
    const g = r && ['GRADUATED', 'RETAKE', 'EXPELLED'].includes(r.grade) ? r.grade : null;
    return { id, status: g ? 'graded' : 'enrolled', grade: g };
  });
}

function transcriptOf(project, id) {
  const p = store.planted(project) || store.pathOf(project, id);
  if (!p.ok) return p;
  const r = readResults(p.dir);
  return r && Array.isArray(r.rows) ? { ok: true, id, grade: r.grade, reason: r.reason, markdown: exam.transcript(id, exam.grade(r.rows), r.rows) } : fail('no-results', 'this exam has not been run yet');
}

function readInput(file) {
  const r = inputfile.readPrepFile(file);
  if (!r.ok) return { error: r.message };
  let j;
  try { j = JSON.parse(r.text); } catch { return { error: 'input file is not valid JSON' }; }
  if (!j || typeof j !== 'object') return { error: 'input file is not valid JSON' };
  r.done();
  return { title: String(j.title || ''), skill: String(j.skill || '') };
}

function main(argv) {
  const { _, flags } = parseArgs(argv, ['project', 'input-file', 'repeat', 'only', 'max-turns', 'model', 'claude']);
  const project = path.resolve(flags.project || process.cwd());
  const [cmd, arg] = _;
  let res;
  if (cmd === 'prep') res = store.planted(project) || inputfile.prep('input.json');
  else if (cmd === 'enroll') {
    const inp = readInput(flags['input-file']);
    res = inp.error ? fail('bad-input', inp.error) : enroll(project, inp.title, inp.skill);
  } else if (cmd === 'check') res = check(project, arg, Math.min(5, Math.max(1, parseInt(flags.repeat, 10) || 1)));
  else if (cmd === 'run') res = run(project, arg, flags);
  else if (cmd === 'transcript') res = transcriptOf(project, arg);
  else if (cmd === 'list') res = store.planted(project) || { ok: true, exams: list(project) };
  else { process.stderr.write('usage: academy.js prep | enroll --input-file F | check <id> | run <id> | transcript <id> | list\n'); return 2; }
  process.stdout.write(JSON.stringify(res, null, 2) + '\n');
  return res.ok ? 0 : 1;
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));
module.exports = { resolveSkill, enroll, check, run, list, transcriptOf, frontmatter };
