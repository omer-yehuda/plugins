'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawn, spawnSync } = require('child_process');

const ATC = path.join(__dirname, '..', 'scripts', 'atc.js');
const glob = require(path.join(__dirname, '..', 'scripts', 'lib', 'glob.js'));

// Symlink tests need permission to create symlinks (Windows without Developer Mode refuses with EPERM).
const symlinks = { skip: (() => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'symlink-probe-')); try { fs.symlinkSync(d, path.join(d, 'l')); return false; } catch { return 'cannot create symlinks on this machine'; } finally { fs.rmSync(d, { recursive: true, force: true }); } })() };

function sh(cmd, args, cwd) { return execFileSync(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] }).toString(); }
function tmpRepo() {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'atc-')));
  sh('git', ['init', '-q', '-b', 'main'], dir);
  sh('git', ['config', 'user.email', 't@t.t'], dir);
  sh('git', ['config', 'user.name', 't'], dir);
  fs.mkdirSync(path.join(dir, 'src/api'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'src/ui'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'src/api/a.js'), 'a\n');
  fs.writeFileSync(path.join(dir, 'src/ui/u.js'), 'u\n');
  fs.writeFileSync(path.join(dir, 'README.md'), 'r\n');
  sh('git', ['add', '-A'], dir);
  sh('git', ['commit', '-q', '-m', 'init'], dir);
  return dir;
}
function prepFile(dir) { return JSON.parse(atc(dir, ['prep']).stdout).input; }
function atc(cwd, args, stdin) {
  const r = spawnSync('node', [ATC, ...args], { cwd, input: stdin, encoding: 'utf8' });
  return r;
}
function atcJson(cwd, args) { return JSON.parse(atc(cwd, args).stdout); }
function gate(cwd, session, file, tool = 'Edit') {
  const input = JSON.stringify({ session_id: session, tool_name: tool, tool_input: { file_path: file }, cwd });
  const r = atc(cwd, ['gate'], input);
  assert.equal(r.status, 0);
  return r.stdout ? JSON.parse(r.stdout) : null;
}
const readAir = (dir) => JSON.parse(fs.readFileSync(path.join(dir, '.atc', 'airspace.json'), 'utf8'));

test('glob: **, *, ?, braces, directory prefix', () => {
  assert.ok(glob.matches('src/**', 'src/a/b/c.js'));
  assert.ok(glob.matches('src/**', 'src/c.js'));
  assert.ok(!glob.matches('src/**', 'lib/c.js'));
  assert.ok(glob.matches('src/*.js', 'src/a.js'));
  assert.ok(!glob.matches('src/*.js', 'src/x/a.js'));
  assert.ok(glob.matches('**/*.test.js', 'a/b/c.test.js'));
  assert.ok(glob.matches('**/*.test.js', 'c.test.js'));
  assert.ok(glob.matches('src/file?.js', 'src/file1.js'));
  assert.ok(!glob.matches('src/file?.js', 'src/file12.js'));
  assert.ok(glob.matches('src/*.{ts,tsx}', 'src/a.tsx'));
  assert.ok(!glob.matches('src/*.{ts,tsx}', 'src/a.js'));
  assert.ok(glob.matches('src/api', 'src/api/a.js'), 'bare directory covers contents');
  assert.ok(glob.matches('./src/api/', 'src/api/deep/a.js'), 'leading ./ and trailing / are normalized');
  assert.ok(glob.matches('a.b', 'a.b') && !glob.matches('a.b', 'aXb'), 'dots are literal');
});

test('glob: validation and overlap', () => {
  assert.ok(glob.validatePattern('/etc/**'));
  assert.ok(glob.validatePattern('../x'));
  assert.ok(glob.validatePattern(''));
  assert.equal(glob.validatePattern('src/**'), null);
  assert.ok(glob.patternsOverlap('src/**', 'src/api/x.js'));
  assert.ok(glob.patternsOverlap('src/api', 'src/api/x.js'));
  assert.ok(!glob.patternsOverlap('src/api/**', 'src/ui/**'));
  assert.ok(!glob.patternsOverlap('src/*.js', 'lib/*.js'));
  assert.ok(glob.patternsOverlap('**/*.js', 'src/a.js'));
  assert.ok(!glob.patternsOverlap('src/a.js', 'src/b.js'));
  assert.ok(glob.patternsOverlap('src/*.js', 'src/a.js'));
  assert.ok(!glob.patternsOverlap('src/*.js', 'src/a.ts'));
});

test('claim: creates protected .atc, callsign, and refuses overlaps without --force', () => {
  const dir = tmpRepo();
  const a = atcJson(dir, ['claim', '--session', 'sess-A', 'src/api/**', '--', 'build', 'pagination']);
  assert.equal(a.ok, true);
  assert.match(a.callsign, /^[A-Z]+-\d$/);
  assert.equal(a.purpose, 'build pagination');
  assert.equal(fs.readFileSync(path.join(dir, '.atc', '.gitignore'), 'utf8').trim().split('\n').pop(), '*');
  assert.equal(sh('git', ['status', '--porcelain'], dir).trim(), '', '.atc must not show in git status');

  const b = atcJson(dir, ['claim', '--session', 'sess-B', 'src/api/a.js']);
  assert.equal(b.ok, false);
  assert.equal(b.error, 'overlap');
  assert.equal(b.clashes[0].callsign, a.callsign);
  assert.equal(Object.keys(readAir(dir).flights).length, 1);

  const c = atcJson(dir, ['claim', '--session', 'sess-B', 'src/api/a.js', '--force']);
  assert.equal(c.ok, true);
  assert.equal(c.forced, true);
  const d = atcJson(dir, ['claim', '--session', 'sess-C', 'src/ui/**']);
  assert.equal(d.ok, true);
  assert.notEqual(d.callsign, a.callsign);
});

test('claim: re-claim by the same session replaces its lanes; bad lanes rejected; tracked .atc refused', () => {
  const dir = tmpRepo();
  atcJson(dir, ['claim', '--session', 'S1', 'src/api/**']);
  const again = atcJson(dir, ['claim', '--session', 'S1', 'src/ui/**']);
  assert.equal(again.ok, true);
  assert.deepEqual(readAir(dir).flights.S1.lanes, ['src/ui/**']);
  assert.equal(atcJson(dir, ['claim', '--session', 'S1', '/etc/**']).error, 'bad-lane');
  assert.equal(atcJson(dir, ['claim', '--session', 'S1']).error, 'no-lanes');

  const dir2 = tmpRepo();
  fs.mkdirSync(path.join(dir2, '.atc'));
  fs.writeFileSync(path.join(dir2, '.atc', 'airspace.json'), '{"version":1,"flights":{}}');
  sh('git', ['add', '-f', '.atc/airspace.json'], dir2);
  assert.equal(atcJson(dir2, ['claim', '--session', 'S1', 'src/**']).error, 'planted-airspace');
});

test('gate: same session allowed, other session asked, unclaimed silent', () => {
  const dir = tmpRepo();
  const a = atcJson(dir, ['claim', '--session', 'sess-A', 'src/api/**', '--', 'pagination']);
  assert.equal(gate(dir, 'sess-A', path.join(dir, 'src/api/a.js')), null);
  const out = gate(dir, 'sess-B', path.join(dir, 'src/api/a.js'));
  assert.equal(out.hookSpecificOutput.hookEventName, 'PreToolUse');
  assert.equal(out.hookSpecificOutput.permissionDecision, 'ask');
  assert.match(out.hookSpecificOutput.permissionDecisionReason, new RegExp(`Runway occupied: src/api/a.js is in ${a.callsign}'s lane \\(pagination\\)\\. Coordinate before landing`));
  assert.equal(gate(dir, 'sess-B', path.join(dir, 'src/ui/u.js')), null);
  assert.equal(gate(dir, 'sess-B', 'src/api/a.js', 'Write') && 'ask', 'ask', 'relative paths resolve against cwd');
  assert.equal(gate(dir, 'sess-B', path.join(dir, 'src/api/new/file.js'), 'MultiEdit').hookSpecificOutput.permissionDecision, 'ask');
  assert.equal(gate(dir, 'sess-B', '/tmp/elsewhere.txt'), null, 'outside the repo');
  assert.equal(gate(dir, 'sess-B', path.join(dir, 'src/api/a.js'), 'Read'), null, 'not a write tool');
});

test('gate: never answers allow; synthetic flights belong to their owner session', () => {
  const dir = tmpRepo();
  atcJson(dir, ['claim', '--session', 'HQ', '--id', 'HQ:f1', '--owner', 'HQ', 'src/api/**']);
  atcJson(dir, ['claim', '--session', 'HQ', '--id', 'HQ:f2', 'src/ui/**']);
  assert.equal(gate(dir, 'HQ', path.join(dir, 'src/api/a.js')), null, 'owner session passes');
  assert.equal(gate(dir, 'HQ', path.join(dir, 'src/ui/u.js')), null);
  const other = gate(dir, 'someone-else', path.join(dir, 'src/ui/u.js'));
  assert.equal(other.hookSpecificOutput.permissionDecision, 'ask');
  assert.notEqual(other.hookSpecificOutput.permissionDecision, 'allow');
  assert.equal(atcJson(dir, ['release', '--session', 'HQ']).released.length, 2);
  assert.equal(gate(dir, 'someone-else', path.join(dir, 'src/ui/u.js')), null);
});

test('gate: expired flight ignored; heartbeat refreshes own flight', () => {
  const dir = tmpRepo();
  atcJson(dir, ['claim', '--session', 'sess-A', 'src/api/**']);
  const file = path.join(dir, '.atc', 'airspace.json');
  const data = readAir(dir);
  data.flights['sess-A'].heartbeat = Date.now() - 3 * 60 * 60 * 1000;
  fs.writeFileSync(file, JSON.stringify(data));
  assert.equal(gate(dir, 'sess-B', path.join(dir, 'src/api/a.js')), null, 'expired flight no longer blocks');
  assert.match(atc(dir, ['radar']).stdout, /EXPIRED/);

  data.flights['sess-A'].heartbeat = Date.now() - 60 * 60 * 1000;
  fs.writeFileSync(file, JSON.stringify(data));
  assert.equal(gate(dir, 'sess-B', path.join(dir, 'src/api/a.js')).hookSpecificOutput.permissionDecision, 'ask');
  const before = readAir(dir).flights['sess-A'].heartbeat;
  gate(dir, 'sess-A', path.join(dir, 'src/api/a.js'));
  assert.ok(readAir(dir).flights['sess-A'].heartbeat > before, 'owner activity refreshes heartbeat');
});

test('gate: silent without airspace, on malformed stdin, on corrupt airspace', () => {
  const dir = tmpRepo();
  assert.equal(gate(dir, 'x', path.join(dir, 'src/api/a.js')), null);
  assert.equal(fs.existsSync(path.join(dir, '.atc')), false, 'gate must not create state');
  for (const bad of ['', 'not json', '[]', 'null', '{"tool_name":"Edit"}', '{"session_id":"s","tool_name":"Edit","tool_input":{}}']) {
    const r = atc(dir, ['gate'], bad);
    assert.equal(r.status, 0, `exit 0 for ${JSON.stringify(bad)}`);
    assert.equal(r.stdout, '');
  }
  atcJson(dir, ['claim', '--session', 'sess-A', 'src/**']);
  fs.writeFileSync(path.join(dir, '.atc', 'airspace.json'), '{broken');
  const r = atc(dir, ['gate'], JSON.stringify({ session_id: 'B', tool_name: 'Edit', tool_input: { file_path: 'src/api/a.js' }, cwd: dir }));
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '');
});

test('gate: lanes apply inside a linked worktree', () => {
  const dir = tmpRepo();
  atcJson(dir, ['claim', '--session', 'sess-A', 'src/api/**']);
  const wt = path.join(path.dirname(dir), path.basename(dir) + '-wt');
  sh('git', ['worktree', 'add', '-q', '-b', 'wt-branch', wt], dir);
  try {
    const wtReal = fs.realpathSync(wt);
    assert.equal(gate(wtReal, 'sess-B', path.join(wtReal, 'src/api/a.js')).hookSpecificOutput.permissionDecision, 'ask');
    assert.equal(gate(wtReal, 'sess-B', path.join(wtReal, 'src/ui/u.js')), null);
  } finally { fs.rmSync(wt, { recursive: true, force: true }); }
});

test('release and session-end free lanes', () => {
  const dir = tmpRepo();
  atcJson(dir, ['claim', '--session', 'sess-A', 'src/api/**']);
  atcJson(dir, ['claim', '--session', 'sess-B', 'src/ui/**']);
  const r = atc(dir, ['session-end'], JSON.stringify({ session_id: 'sess-A', cwd: dir }));
  assert.equal(r.status, 0);
  assert.deepEqual(Object.keys(readAir(dir).flights), ['sess-B']);
  assert.equal(atcJson(dir, ['release', '--session', 'sess-B']).released.length, 1);
  assert.equal(atcJson(dir, ['release', '--session', 'sess-B']).released.length, 0);
  assert.equal(atc(dir, ['session-end'], 'garbage').status, 0);
});

test('radar and status show flights, ages and conflicts', () => {
  const dir = tmpRepo();
  atcJson(dir, ['claim', '--session', 'sess-A', 'src/api/**', '--', 'api work']);
  atcJson(dir, ['claim', '--session', 'sess-B', 'src/api/a.js', '--force']);
  const text = atc(dir, ['radar', '--session', 'sess-A']).stdout;
  assert.match(text, /ATC RADAR/);
  assert.match(text, /\[YOU/);
  assert.match(text, /\[LIVE/);
  assert.match(text, /CONFLICTS/);
  assert.match(text, /api work/);
  const st = atcJson(dir, ['status', '--session', 'sess-A']);
  assert.equal(st.live, 2);
  assert.equal(st.conflicts.length, 1);
  const empty = tmpRepo();
  assert.match(atc(empty, ['radar']).stdout, /Sky is clear/);
});

test('concurrent claims never corrupt airspace.json', async () => {
  const dir = tmpRepo();
  atcJson(dir, ['claim', '--session', 'seed', 'seed/**']);
  const N = 12;
  const runs = Array.from({ length: N }, (_, i) => new Promise((resolve) => {
    const p = spawn('node', [ATC, 'claim', '--session', `par-${i}`, `lane${i}/**`], { cwd: dir });
    let out = '';
    p.stdout.on('data', (d) => { out += d; });
    p.on('close', () => resolve(JSON.parse(out)));
  }));
  const results = await Promise.all(runs);
  assert.ok(results.every((r) => r.ok), JSON.stringify(results.filter((r) => !r.ok)));
  const flights = readAir(dir).flights;
  assert.equal(Object.keys(flights).length, N + 1);
  const callsigns = Object.values(flights).map((f) => f.callsign);
  assert.equal(new Set(callsigns).size, callsigns.length, 'callsigns are unique');
  assert.deepEqual(fs.readdirSync(path.join(dir, '.atc')).filter((f) => f.endsWith('.tmp') || f.endsWith('.lock')), []);
});

test('stale lock from a crashed process is recovered', () => {
  const dir = tmpRepo();
  atcJson(dir, ['claim', '--session', 'a', 'x/**']);
  const lock = path.join(dir, '.atc', 'airspace.lock');
  fs.writeFileSync(lock, '');
  const old = new Date(Date.now() - 60 * 1000);
  fs.utimesSync(lock, old, old);
  assert.equal(atcJson(dir, ['claim', '--session', 'b', 'y/**']).ok, true);
});

test('conflicts: detects files outside lanes and files shared by two flights', () => {
  const dir = tmpRepo();
  sh('git', ['checkout', '-q', '-b', 'flight-a'], dir);
  fs.writeFileSync(path.join(dir, 'src/api/a.js'), 'a2\n');
  fs.writeFileSync(path.join(dir, 'README.md'), 'oops\n');
  sh('git', ['commit', '-qam', 'a'], dir);
  sh('git', ['checkout', '-q', 'main'], dir);
  sh('git', ['checkout', '-q', '-b', 'flight-b'], dir);
  fs.writeFileSync(path.join(dir, 'src/ui/u.js'), 'u2\n');
  fs.writeFileSync(path.join(dir, 'README.md'), 'oops b\n');
  sh('git', ['commit', '-qam', 'b'], dir);
  sh('git', ['checkout', '-q', 'main'], dir);
  const plan = prepFile(dir);
  fs.writeFileSync(plan, JSON.stringify({ base: 'main', flights: { A: { lanes: ['src/api/**'], ref: 'flight-a' }, B: { lanes: ['src/ui/**'], ref: 'flight-b' } } }));
  const rep = atcJson(dir, ['conflicts', '--plan', plan]);
  assert.equal(rep.ok, true);
  assert.equal(rep.clean, false);
  assert.deepEqual(rep.flights.A.outsideLane, ['README.md']);
  assert.deepEqual(rep.flights.B.outsideLane, ['README.md']);
  assert.deepEqual(rep.shared, [{ file: 'README.md', flights: ['A', 'B'] }]);

  const plan2 = prepFile(dir);
  fs.writeFileSync(plan2, JSON.stringify({ base: 'main', flights: { A: { lanes: ['src/api/**', 'README.md'], ref: 'flight-a' } } }));
  assert.equal(atcJson(dir, ['conflicts', '--plan', plan2]).clean, true);
  const plan3 = prepFile(dir);
  fs.writeFileSync(plan3, JSON.stringify({ base: 'nope', flights: { A: { lanes: ['x'] } } }));
  assert.equal(atcJson(dir, ['conflicts', '--plan', plan3]).ok, false);
  assert.equal(atcJson(dir, ['conflicts']).error, 'bad-plan');
});

test('conflicts: working-tree mode includes untracked files and ignores .atc', () => {
  const dir = tmpRepo();
  atcJson(dir, ['claim', '--session', 's', 'src/api/**']);
  fs.writeFileSync(path.join(dir, 'src/api/new.js'), 'n\n');
  fs.writeFileSync(path.join(dir, 'stray.txt'), 's\n');
  const plan = prepFile(dir);
  fs.writeFileSync(plan, JSON.stringify({ base: 'HEAD', flights: { A: { lanes: ['src/api/**'] } } }));
  const rep = atcJson(dir, ['conflicts', '--plan', plan]);
  assert.deepEqual(rep.flights.A.outsideLane, ['stray.txt']);
});

test('hooks.json uses the expected events and the plugin root variable', () => {
  const h = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'hooks', 'hooks.json'), 'utf8')).hooks;
  assert.equal(h.PreToolUse[0].matcher, 'Write|Edit|MultiEdit|NotebookEdit');
  assert.match(h.PreToolUse[0].hooks[0].command, /\$\{CLAUDE_PLUGIN_ROOT\}\/scripts\/atc\.js" gate/);
  assert.match(h.SessionEnd[0].hooks[0].command, /session-end/);
});

test('gate is fast', () => {
  const dir = tmpRepo();
  atcJson(dir, ['claim', '--session', 'A', 'src/api/**']);
  const input = JSON.stringify({ session_id: 'B', tool_name: 'Edit', tool_input: { file_path: path.join(dir, 'src/api/a.js') }, cwd: dir });
  const t = process.hrtime.bigint();
  for (let i = 0; i < 5; i++) atc(dir, ['gate'], input);
  const ms = Number(process.hrtime.bigint() - t) / 1e6 / 5;
  assert.ok(ms < 400, `avg ${ms.toFixed(0)} ms per gate call (node startup dominated)`);
});

// ---- security fixes ----
const plant = (dir, flight) => {
  fs.mkdirSync(path.join(dir, '.atc'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.atc', 'airspace.json'), JSON.stringify({ version: 1, flights: { evil: flight } }));
};
const evil = (over) => ({ callsign: 'SECURITY-TEAM', lanes: ['**'], purpose: 'freeze', claimedAt: Date.now(), heartbeat: Date.now(), ...over });

test('security: tracked .atc/ is ignored by gate, refused by radar/status', () => {
  const dir = tmpRepo();
  plant(dir, evil());
  assert.ok(gate(dir, 'B', 'src/api/a.js'), 'untracked plant is honoured (baseline)');
  sh('git', ['add', '-f', '.atc/airspace.json'], dir);
  assert.equal(gate(dir, 'B', 'src/api/a.js'), null, 'tracked airspace is ignored');
  assert.equal(atcJson(dir, ['radar']).error, 'planted-airspace');
  assert.equal(atcJson(dir, ['status']).error, 'planted-airspace');
  assert.equal(atcJson(dir, ['claim', '--session', 'S', 'src/**']).error, 'planted-airspace');
});

test('security: future, absurd and over-age heartbeats are expired', () => {
  const dir = tmpRepo();
  const day = 24 * 3600 * 1000;
  for (const f of [evil({ heartbeat: 9999999999999 }), evil({ heartbeat: Date.now() + day }), evil({ heartbeat: 'x' }), evil({ heartbeat: undefined }),
    evil({ claimedAt: Date.now() + day }), evil({ claimedAt: Date.now() - 9 * 3600 * 1000, heartbeat: Date.now() })]) {
    plant(dir, f);
    assert.equal(gate(dir, 'B', 'src/api/a.js'), null, JSON.stringify(f));
  }
  plant(dir, evil({ claimedAt: Date.now() - 7 * 3600 * 1000 }));
  assert.ok(gate(dir, 'B', 'src/api/a.js'), 'under the cap stays live');
});

test('security: callsign and purpose are sanitized in the ask reason', () => {
  const dir = tmpRepo();
  plant(dir, evil({ callsign: 'EVIL\u001b[2J\nfoo bar', purpose: '\u001b]8;;x\u0007' + 'A'.repeat(500) }));
  const r = gate(dir, 'B', 'src/api/a.js');
  const reason = r.hookSpecificOutput.permissionDecisionReason;
  assert.ok(!/[\u0000-\u001f\u007f-\u009f]/.test(reason), 'no control chars');
  assert.ok(!reason.includes('EVIL\u001b'));
  assert.match(reason, /EVIL2JFOOBAR's lane/);
  assert.ok(reason.length < 400, 'purpose capped at 80');
  assert.ok(!atc(dir, ['radar']).stdout.match(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/), 'radar clean too');
});

test('security: claim reads globs and purpose from --plan-file, shell text stays inert', () => {
  const dir = tmpRepo();
  const file = prepFile(dir);
  const nasty = "x'; touch " + path.join(dir, 'pwned') + " #$(touch " + path.join(dir, 'pwned2') + ")`id`\u001b[2J";
  fs.writeFileSync(file, JSON.stringify({ globs: ['src/api/**'], purpose: nasty }));
  const r = atcJson(dir, ['claim', '--session', 'S', '--plan-file', file]);
  assert.equal(r.ok, true);
  assert.deepEqual(r.lanes, ['src/api/**']);
  assert.ok(!/[\u0000-\u001f]/.test(r.purpose) && r.purpose.length <= 80);
  assert.ok(!fs.existsSync(path.join(dir, 'pwned')) && !fs.existsSync(path.join(dir, 'pwned2')));
  assert.ok(!fs.existsSync(file), 'plan file consumed');
  assert.equal(atcJson(dir, ['claim', '--session', 'S', '--plan-file', path.join(dir, 'nope.json')]).error, 'bad-plan-file');
});

test('security: plan files outside a prep folder or symlinked are refused and never deleted', symlinks, () => {
  const dir = tmpRepo();
  const outside = path.join(dir, 'claim.json');
  fs.writeFileSync(outside, JSON.stringify({ globs: ['src/api/**'] }));
  assert.equal(atcJson(dir, ['claim', '--session', 'S', '--plan-file', outside]).error, 'bad-plan-file');
  assert.ok(fs.existsSync(outside));
  const f = prepFile(dir);
  fs.symlinkSync(outside, f);
  const r = atcJson(dir, ['claim', '--session', 'S', '--plan-file', f]);
  assert.equal(r.error, 'bad-plan-file');
  assert.match(r.message, /symlink/);
  assert.ok(fs.existsSync(outside));
});

test('session: empty, missing or unsubstituted --session is an error, never "manual"', () => {
  const dir = tmpRepo();
  for (const args of [['claim', 'src/**'], ['claim', '--session', '', 'src/**'], ['claim', '--session', '${CLAUDE_SESSION_ID}', 'src/**'], ['release'], ['release', '--session', ''], ['radar', '--session', '']]) {
    assert.equal(atcJson(dir, args).error, 'no-session', args.join(' '));
  }
  assert.ok(!fs.existsSync(path.join(dir, '.atc', 'airspace.json')) || !fs.readFileSync(path.join(dir, '.atc', 'airspace.json'), 'utf8').includes('manual'));
});

test('branches: lists only strictly valid worktree-* branch names', () => {
  const dir = tmpRepo();
  for (const b of ['worktree-ok', 'worktree-a/b.c', 'worktree-x..y', 'worktree-end.lock', 'worktree-$(id)']) {
    try { sh('git', ['branch', b], dir); } catch { /* git may refuse some names */ }
  }
  const r = atcJson(dir, ['branches']);
  assert.equal(r.ok, true);
  assert.deepEqual(r.branches.sort(), ['worktree-a/b.c', 'worktree-ok']);
});

test('security: skills never put free text on a command line', () => {
  for (const s of ['claim', 'clear']) {
    const md = fs.readFileSync(path.join(__dirname, '..', 'skills', s, 'SKILL.md'), 'utf8');
    assert.match(md, /--plan-file/);
    assert.ok(!/ -- <purpose>|-- short purpose/.test(md));
  }
});

test('hygiene: no film callsigns, no absolute claims in metadata', () => {
  const root = path.join(__dirname, '..');
  const meta = fs.readFileSync(path.join(root, '.claude-plugin', 'plugin.json'), 'utf8');
  assert.ok(!/0 collisions|5 Claudes/.test(meta + fs.readFileSync(path.join(root, 'README.md'), 'utf8')));
  assert.ok(!/MAVERICK/i.test(fs.readFileSync(path.join(root, 'scripts', 'lib', 'store.js'), 'utf8')));
  assert.equal(JSON.parse(meta).name, 'atc');
});
