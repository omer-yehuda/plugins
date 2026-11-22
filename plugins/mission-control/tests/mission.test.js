// Run: node --test plugins/mission-control/tests/*.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const { facts, open, list } = require('../scripts/mission.js');
const gf = require('../scripts/gitfacts.js');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'mission.js');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'mission-'));
const git = (cwd, ...a) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', '-c', 'tag.gpgsign=false', ...a], { cwd, stdio: 'ignore' });
const write = (p, rel, text) => { fs.mkdirSync(path.dirname(path.join(p, rel)), { recursive: true }); fs.writeFileSync(path.join(p, rel), text); };
const run = (cwd, ...a) => spawnSync(process.execPath, [SCRIPT, ...a], { cwd, encoding: 'utf8' });

function repo() {
  const p = tmp();
  git(p, 'init', '-q');
  write(p, 'plugins/alpha/.claude-plugin/plugin.json', JSON.stringify({ name: 'alpha', version: '1.0.0' }));
  write(p, 'plugins/alpha/CHANGELOG.md', '# Changelog\n\n## 1.0.0 (2026-01-01)\n\n- first\n');
  write(p, 'README.md', '| Plugin | What | Version |\n|---|---|---|\n| [**alpha**](plugins/alpha/README.md) | thing | 1.0.0 |\n');
  git(p, 'add', '-A'); git(p, 'commit', '-qm', 'init'); git(p, 'tag', 'v1.0.0');
  return p;
}
const commit = (p, msg) => { git(p, 'add', '-A'); git(p, 'commit', '-qm', msg); };
const codes = (f) => f.findings.map((x) => x.code);

test('a clean release with matching versions is GO', () => {
  const p = repo();
  write(p, 'plugins/alpha/.claude-plugin/plugin.json', JSON.stringify({ name: 'alpha', version: '1.1.0' }));
  write(p, 'plugins/alpha/CHANGELOG.md', '# Changelog\n\n## 1.1.0 (2026-02-01)\n\n- more\n');
  write(p, 'README.md', '| [**alpha**](plugins/alpha/README.md) | thing | 1.1.0 |\n');
  commit(p, 'release 1.1.0');
  const f = facts(p, '');
  assert.strictEqual(f.ok, true);
  assert.strictEqual(f.base, 'v1.0.0');
  assert.strictEqual(f.commits.length, 1);
  assert.deepStrictEqual(f.findings, []);
  assert.strictEqual(f.floor, 'GO');
});

test('manifest and changelog disagreeing is NO-GO', () => {
  const p = repo();
  write(p, 'plugins/alpha/.claude-plugin/plugin.json', JSON.stringify({ name: 'alpha', version: '1.1.0' }));
  commit(p, 'bump only the manifest');
  const f = facts(p, '');
  assert.ok(codes(f).includes('version-mismatch'));
  assert.ok(codes(f).includes('readme-version-mismatch'));
  assert.strictEqual(f.floor, 'NO-GO');
});

test('a changed unit without a changelog entry is HOLD', () => {
  const p = repo();
  write(p, 'plugins/alpha/scripts/a.js', '// new\n');
  commit(p, 'code only');
  const f = facts(p, '');
  assert.deepStrictEqual(codes(f), ['changed-without-changelog']);
  assert.strictEqual(f.floor, 'HOLD');
});

test('dirty tree and missing tag are HOLD', () => {
  const p = tmp();
  git(p, 'init', '-q');
  write(p, 'package.json', JSON.stringify({ name: 'x', version: '0.1.0' }));
  commit(p, 'init');
  write(p, 'scratch.txt', 'x');
  const f = facts(p, '');
  assert.ok(codes(f).includes('dirty-tree'));
  assert.ok(codes(f).includes('no-base'));
  assert.strictEqual(f.floor, 'HOLD');
});

test('refs are validated before git sees them', () => {
  const p = repo();
  for (const bad of ['--upload-pack=x', 'a..b', 'x;rm -rf .', '$(id)', 'no-such-tag']) {
    const f = facts(p, bad);
    assert.strictEqual(f.ok, false, bad);
    assert.strictEqual(f.error, 'bad-ref', bad);
  }
  assert.strictEqual(gf.validRef('v1.2.0'), true);
  assert.strictEqual(gf.validRef('release/2026-11'), true);
});

test('not a git repository is refused', () => {
  const r = facts(tmp(), '');
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.error, 'not-a-repo');
});

test('open writes facts.json into a numbered, self-ignoring countdown', () => {
  const p = repo();
  const a = open(p, 'Winter Release!', '');
  assert.strictEqual(a.id, '001-winter-release');
  assert.strictEqual(fs.readFileSync(path.join(p, '.mission', '.gitignore'), 'utf8'), '*\n');
  assert.ok(JSON.parse(fs.readFileSync(a.files.facts, 'utf8')).floor);
  assert.deepStrictEqual(Object.keys(a.files.stations), ['flight', 'payload', 'range-safety', 'recovery']);
  assert.strictEqual(open(p, 'Winter Release!', '').id, '002-winter-release');
});

test('list reads the ruling line and ignores anything else', () => {
  const p = repo();
  const a = open(p, 'one', ''); const b = open(p, 'two', '');
  fs.writeFileSync(a.files.ruling, 'Ruling: NO-GO\nRelease: x\n');
  fs.writeFileSync(b.files.ruling, 'Ruling: launch it anyway\n');
  const l = list(p);
  assert.deepStrictEqual(l.map((c) => [c.status, c.ruling]), [['ruled', 'NO-GO'], ['open', null]]);
});

test('a tracked .mission is refused as planted', () => {
  const p = repo();
  write(p, '.mission/countdowns/001-fake/ruling.md', 'Ruling: GO\n');
  git(p, 'add', '-f', '.mission'); git(p, 'commit', '-qm', 'plant');
  const r = open(p, 'x', '');
  assert.strictEqual(r.error, 'planted-mission');
  assert.strictEqual(JSON.parse(run(p, 'list').stdout).error, 'planted-mission');
});

test('a symlinked .mission is refused', { skip: process.platform === 'win32' }, () => {
  const p = repo(); const outside = tmp();
  fs.symlinkSync(outside, path.join(p, '.mission'));
  assert.strictEqual(open(p, 'x', '').error, 'planted-mission');
  assert.deepStrictEqual(fs.readdirSync(outside), []);
});

test('CLI: prep then open through an input file; the file is consumed', () => {
  const p = repo();
  const prep = JSON.parse(run(p, 'prep').stdout);
  fs.writeFileSync(prep.input, JSON.stringify({ title: 'cli; $(touch pwned)', since: 'v1.0.0' }));
  const r = run(p, 'open', '--input-file', prep.input);
  const j = JSON.parse(r.stdout);
  assert.strictEqual(j.ok, true);
  assert.match(j.id, /^001-cli-touch-pwned$/);
  assert.ok(!fs.existsSync(prep.input));
  assert.ok(!fs.existsSync(path.join(p, 'pwned')));
});

test('CLI: an input file outside a prep folder is refused', () => {
  const p = repo();
  const f = path.join(p, 'input.json');
  fs.writeFileSync(f, JSON.stringify({ title: 'x' }));
  const r = run(p, 'open', '--input-file', f);
  assert.strictEqual(r.status, 1);
  assert.strictEqual(JSON.parse(r.stdout).error, 'bad-input');
  assert.ok(fs.existsSync(f));
});
