#!/usr/bin/env node
/*
 * ATC control script. Zero dependencies, cross-platform (Node 18+).
 *
 *   atc.js prep    [--cwd DIR]                   make a fresh temp folder, print {"input": "<tmp>/input.json"}
 *   atc.js branches [--cwd DIR]                  list flight branches (worktree-*) that pass the strict name check
 *   atc.js claim   --session ID [--id FLIGHT] [--owner ID] [--plan-file FILE] [--force] [--cwd DIR] [GLOB...]
 *                  FILE is JSON {"globs": [...], "purpose": "..."}: free text never goes through the shell.
 *   atc.js release --session ID [--id FLIGHT] [--cwd DIR]       free this session's lanes (and flights it owns)
 *   atc.js radar   [--session ID] [--cwd DIR] [--json]          ASCII status board
 *   atc.js status  [--session ID] [--cwd DIR] [--json]          machine-readable board
 *   atc.js conflicts --plan FILE [--base REF] [--cwd DIR]        files changed outside lanes / by two flights
 *   atc.js gate                                                  PreToolUse hook (hook JSON on stdin)
 *   atc.js session-end                                           SessionEnd hook (releases the session's lanes)
 *
 * State lives in .atc/airspace.json at the project root, protected by .atc/.gitignore ("*").
 * The gate only ever answers "ask", never "allow", and exits 0 silently on any internal error.
 * It is coordination, not a sandbox: it sees Claude's file tools, not shell commands like `sed -i`.
 */
'use strict';
const store = require('./lib/store');
const glob = require('./lib/glob');
const radar = require('./lib/radar');
const conflicts = require('./lib/conflicts');
const gate = require('./lib/gate');
const inputfile = require('./inputfile');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const VALUE_FLAGS = ['session', 'id', 'owner', 'purpose', 'plan-file', 'cwd', 'plan', 'base'];
function parseArgs(argv) {
  const out = { _: [], purposeWords: [], flags: {} };
  let rest = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (rest) out.purposeWords.push(a);
    else if (a === '--') rest = true;
    else if (a === '--force' || a === '--json') out.flags[a.slice(2)] = true;
    else if (a.startsWith('--') && VALUE_FLAGS.includes(a.slice(2))) out.flags[a.slice(2)] = argv[++i];
    else out._.push(a);
  }
  return out;
}
const print = (obj) => process.stdout.write(JSON.stringify(obj, null, 2) + '\n');
const unsubstituted = (v) => !v || /\$\{|\$[A-Z_]/.test(v);
const clean = (v) => String(v).replace(/[^A-Za-z0-9_:.-]/g, '').slice(0, 120);
// Never invent a session: an empty, missing or unsubstituted --session is an error, not "manual".
const sessionOf = (flags) => (unsubstituted(flags.session) ? '' : clean(flags.session));
const NO_SESSION = { ok: false, error: 'no-session', message: 'Pass --session with this Claude session id (an empty or unsubstituted value is refused).' };
const cwdOf = (flags) => flags.cwd || process.cwd();

function needRoot(flags, create) {
  const root = store.projectRoot(cwdOf(flags));
  if (!root) return { error: { ok: false, error: 'not-a-git-repo', message: 'atc needs a git repository (the airspace lives at the git root).' } };
  if (create) {
    const p = store.protect(root);
    if (!p.ok) return { error: p };
  }
  return { root };
}

// Read {globs, purpose} from a JSON file HQ wrote inside a prep folder; deleted after a good parse.
function loadPlanFile(file) {
  const r = inputfile.readPrepFile(file);
  if (!r.ok) return { error: { ok: false, error: 'bad-plan-file', message: r.message } };
  let data;
  try { data = JSON.parse(r.text); } catch { return { error: { ok: false, error: 'bad-plan-file', message: 'Plan file is not valid JSON.' } }; }
  if (!data || typeof data !== 'object') return { error: { ok: false, error: 'bad-plan-file', message: 'Plan file must be a JSON object.' } };
  const globs = Array.isArray(data.globs) ? data.globs.filter((g) => typeof g === 'string') : [];
  const purpose = typeof data.purpose === 'string' ? data.purpose : '';
  r.done();
  return { globs, purpose };
}

function cmdClaim({ _, purposeWords, flags }) {
  const session = sessionOf(flags);
  if (!session) return print(NO_SESSION);
  const r = needRoot(flags, true);
  if (r.error) return print(r.error);
  let filePurpose = '';
  let fileGlobs = [];
  if (flags['plan-file']) {
    const pf = loadPlanFile(flags['plan-file']);
    if (pf.error) return print(pf.error);
    filePurpose = pf.purpose;
    fileGlobs = pf.globs;
  }
  const globs = [..._, ...fileGlobs].flatMap((g) => (/\s/.test(g) ? g.split(/\s+/) : [g])).map(glob.normalizePattern).filter(Boolean);
  if (!globs.length) return print({ ok: false, error: 'no-lanes', message: 'Give at least one glob, e.g. claim "src/api/**" --plan-file <prep path>' });
  for (const g of globs) { const bad = glob.validatePattern(g); if (bad) return print({ ok: false, error: 'bad-lane', message: `${g}: ${bad}` }); }
  const key = flags.id || session;
  const ownerId = flags.owner ? sessionOf({ session: flags.owner }) : '';
  if (flags.owner && !ownerId) return print(NO_SESSION);
  const owner = ownerId || (key === session ? undefined : session);
  const purpose = store.cleanText(filePurpose || flags.purpose || purposeWords.join(' '), store.PURPOSE_MAX);
  let result;
  try {
    result = store.update(r.root, (data) => {
      store.pruneExpired(data);
      const clashes = [];
      for (const [id, f] of Object.entries(data.flights)) {
        if (id === key) continue;
        const hits = glob.lanesOverlap(globs, f.lanes);
        if (hits.length) clashes.push({ callsign: f.callsign, purpose: f.purpose || '', lanes: f.lanes, overlaps: hits.map(([a, b]) => `${a} <> ${b}`) });
      }
      if (clashes.length && !flags.force) return { ok: false, error: 'overlap', message: 'Requested lanes overlap live flights. Re-run with --force only if the user confirms.', clashes };
      const prev = data.flights[key];
      const now = Date.now();
      const callsign = prev ? prev.callsign : store.makeCallsign(key, data.flights);
      data.flights[key] = { callsign, lanes: globs, purpose, claimedAt: prev ? prev.claimedAt : now, heartbeat: now, ...(owner ? { owner } : {}) };
      return { ok: true, callsign, flight: key, lanes: globs, purpose, forced: clashes.length > 0, clashes };
    });
  } catch (e) { return print({ ok: false, error: 'busy', message: e.message }); }
  print(result);
}

function releaseFor(root, session, id) {
  return store.update(root, (data) => {
    const freed = [];
    for (const [k, f] of Object.entries(data.flights)) {
      if (id ? k === id : store.ownedBy(k, f, session)) { freed.push(f.callsign); delete data.flights[k]; }
    }
    store.pruneExpired(data);
    return freed;
  });
}

function cmdRelease({ flags }) {
  const session = sessionOf(flags);
  if (!session) return print(NO_SESSION);
  const root = store.projectRoot(cwdOf(flags));
  if (!root || !fs.existsSync(store.airspacePath(root))) return print({ ok: true, released: [], message: 'Nothing to release (no airspace).' });
  try { print({ ok: true, released: releaseFor(root, session, flags.id) }); } catch (e) { print({ ok: false, error: 'busy', message: e.message }); }
}

function cmdRadar({ flags }, asJson) {
  const root = store.projectRoot(cwdOf(flags));
  if (!root) return print({ ok: false, error: 'not-a-git-repo' });
  if (store.isTracked(root)) return print(store.PLANTED);
  const session = 'session' in flags ? sessionOf(flags) : null;
  if (session === '') return print(NO_SESSION);
  const info = radar.collect(root, session);
  if (asJson || flags.json) return print({ ok: true, ...info });
  process.stdout.write(radar.render(info) + '\n');
}

function cmdConflicts({ flags }) {
  let plan = null;
  if (flags.plan) {
    const f = inputfile.readPrepFile(flags.plan);
    if (f.ok) { try { plan = JSON.parse(f.text); f.done(); } catch { plan = null; } }
  }
  if (!plan || typeof plan !== 'object') return print({ ok: false, error: 'bad-plan', message: 'Pass --plan with the prep path of a file holding {"base":"ref","flights":{"name":{"lanes":[...],"ref":"branch"}}}' });
  if (flags.base) plan.base = flags.base;
  print(conflicts.check(cwdOf(flags), plan));
}

// Strict subset of git check-ref-format: no leading '-' or '.', no '..', '//', '@{', '.lock' ending, only [A-Za-z0-9._/-].
const BRANCH_RE = /^[A-Za-z0-9_][A-Za-z0-9._/-]{0,199}$/;
function validBranch(name) {
  return typeof name === 'string' && BRANCH_RE.test(name) && !/\.\.|\/\/|\.lock(\/|$)|\/\.|[./]$/.test(name);
}

// Lists local flight branches (worktree-*) straight from git; prints only names that pass validBranch.
function cmdBranches({ flags }) {
  let out;
  try {
    out = execFileSync('git', ['-C', cwdOf(flags), 'branch', '--list', 'worktree-*', '--format=%(refname:short)'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch { return print({ ok: false, error: 'not-a-git-repo', message: 'Cannot list branches here.' }); }
  const all = out.split('\n').map((l) => l.trim()).filter(Boolean);
  const branches = all.filter(validBranch);
  print({ ok: true, branches, skipped: all.length - branches.length });
}

function cmdPrep({ flags }) {
  const r = needRoot(flags, true);
  if (r.error) return print(r.error);
  print(inputfile.prep('input.json'));
}

function cmdSessionEnd() {
  try {
    const input = JSON.parse(fs.readFileSync(0, 'utf8') || '{}');
    if (!input.session_id) return;
    const air = store.findAirspace(input.cwd || process.cwd());
    if (air) releaseFor(air.root, input.session_id);
  } catch { /* never fail a hook */ }
}

function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === 'gate') return gate.run(fs.readFileSync(0, 'utf8'));
  if (cmd === 'session-end') return cmdSessionEnd();
  const args = parseArgs(rest);
  switch (cmd) {
    case 'prep': return cmdPrep(args);
    case 'branches': return cmdBranches(args);
    case 'claim': return cmdClaim(args);
    case 'release': return cmdRelease(args);
    case 'radar': return cmdRadar(args, false);
    case 'status': return cmdRadar(args, true);
    case 'conflicts': return cmdConflicts(args);
    default: process.stdout.write('usage: atc.js <prep|branches|claim|release|radar|status|conflicts|gate|session-end> [options]\n');
  }
}

try { main(); } catch (e) {
  if (['gate', 'session-end'].includes(process.argv[2])) process.exit(0);
  print({ ok: false, error: 'internal', message: String(e && e.message) });
}
