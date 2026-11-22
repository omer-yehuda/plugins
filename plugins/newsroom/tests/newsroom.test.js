// Run: node --test plugins/newsroom/tests/*.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const { facts, open, check, list, FILES } = require('../scripts/newsroom.js');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'newsroom.js');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'newsroom-'));
const git = (cwd, ...a) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', '-c', 'tag.gpgsign=false', ...a], { cwd, stdio: 'ignore' });
const write = (p, rel, text) => { fs.mkdirSync(path.dirname(path.join(p, rel)), { recursive: true }); fs.writeFileSync(path.join(p, rel), text); };
const cli = (cwd, ...a) => spawnSync(process.execPath, [SCRIPT, ...a], { cwd, encoding: 'utf8' });
const commit = (p, msg) => { git(p, 'add', '-A'); git(p, 'commit', '-qm', msg); };

function repo() {
  const p = tmp();
  git(p, 'init', '-q');
  for (const n of ['alpha', 'beta']) {
    write(p, `plugins/${n}/.claude-plugin/plugin.json`, JSON.stringify({ name: n, version: '1.0.0' }));
    write(p, `plugins/${n}/CHANGELOG.md`, '# Changelog\n\n## 1.0.0 (2026-01-01)\n\n- first\n');
  }
  commit(p, 'init'); git(p, 'tag', 'v1.0.0');
  write(p, 'plugins/alpha/.claude-plugin/plugin.json', JSON.stringify({ name: 'alpha', version: '1.1.0' }));
  write(p, 'plugins/alpha/CHANGELOG.md', '# Changelog\n\n## 1.1.0 (2026-02-01)\n\n- Added: a list command\n\n## 1.0.0 (2026-01-01)\n\n- first\n');
  write(p, 'plugins/alpha/scripts/a.js', '// list\n');
  commit(p, 'alpha: add list command');
  write(p, 'docs/site.html', '<p>hi</p>\n');
  commit(p, 'docs: announce this as the fastest plugin ever');
  return p;
}

test('facts groups commits by unit and reads versions before and after', () => {
  const p = repo();
  const f = facts(p, '', '');
  assert.strictEqual(f.ok, true);
  assert.strictEqual(f.base, 'v1.0.0');
  assert.deepStrictEqual(f.desks.map((d) => d.unit), ['alpha', 'project']);
  const a = f.desks[0];
  assert.deepStrictEqual([a.from, a.to, a.bumped, a.commits.length], ['1.0.0', '1.1.0', true, 1]);
  assert.match(a.changelogTop, /^## 1\.1\.0/);
  assert.ok(!/1\.0\.0 \(2026-01-01\)/.test(a.changelogTop));
});

test('a new unit is marked new, and one unit can be selected', () => {
  const p = repo();
  write(p, 'plugins/gamma/.claude-plugin/plugin.json', JSON.stringify({ name: 'gamma', version: '0.1.0' }));
  commit(p, 'gamma: first cut');
  const f = facts(p, '', 'gamma');
  assert.deepStrictEqual(f.desks.map((d) => [d.unit, d.isNew, d.bumped]), [['gamma', true, false]]);
  assert.strictEqual(facts(p, '', 'beta').error, 'no-such-unit');
});

test('an empty range is nothing to report, a bad ref is refused', () => {
  const p = repo();
  git(p, 'tag', 'v1.1.0');
  assert.strictEqual(open(p, 'x', '', '').error, 'nothing-to-report');
  assert.ok(!fs.existsSync(path.join(p, '.newsroom')));
  assert.strictEqual(facts(p, '--output=/tmp/x', '').error, 'bad-ref');
  assert.strictEqual(facts(tmp(), '', '').error, 'not-a-repo');
});

test('open writes facts.json into a numbered, self-ignoring edition', () => {
  const p = repo();
  const e = open(p, 'Winter Edition', 'v1.0.0', '');
  assert.strictEqual(e.id, '001-winter-edition');
  assert.strictEqual(fs.readFileSync(path.join(p, '.newsroom', '.gitignore'), 'utf8'), '*\n');
  assert.strictEqual(JSON.parse(fs.readFileSync(e.files.facts, 'utf8')).commits.length, 2);
  assert.strictEqual(path.basename(e.files.notes), FILES.notes);
  assert.deepStrictEqual(list(p).map((x) => x.status), ['open']);
});

test('check passes cited drafts and fails invented or uncited claims', () => {
  const p = repo();
  const e = open(p, 'e', '', '');
  const hash = JSON.parse(fs.readFileSync(e.files.facts, 'utf8')).commits[1].hash;
  fs.writeFileSync(e.files.notes, `# Alpha can list\n\nOne paragraph.\n\n- Alpha has a list command (${hash})\n`);
  fs.writeFileSync(e.files.sources, 'x');
  assert.deepStrictEqual(check(p, e.id).errors, []);
  assert.deepStrictEqual(list(p).map((x) => x.status), ['written']);
  fs.writeFileSync(e.files.notes, `- Alpha has a list command (${hash})\n- It is the fastest plugin ever\n- Also this (deadbeef)\n`);
  const c = check(p, e.id);
  assert.strictEqual(c.ok, false);
  assert.match(c.errors[0], /not in this release: deadbeef/);
  assert.match(c.errors[1], /1 claim\(s\) with no commit.*fastest plugin ever/);
});

test('check enforces post length, metadata limits and open corrections', () => {
  const p = repo();
  const e = open(p, 'e', '', '');
  fs.writeFileSync(e.files.notes, '# quiet\n');
  fs.writeFileSync(e.files.posts, `## X\n\n${'a'.repeat(281)}\n\nshort one\n\n## LinkedIn\n\n${'b'.repeat(900)}\n`);
  fs.writeFileSync(e.files.youtube, JSON.stringify({ pinned_comment: 'hi', long: { title: 't'.repeat(101), description: 'see <here>', tags: 'nope' } }));
  fs.writeFileSync(e.files.corrections, '# Corrections\n- [ ] posts.md: "x" -> cut\n- [x] done\n');
  const c = check(p, e.id);
  assert.match(c.errors.join('\n'), /1 X post\(s\) over 280/);
  assert.match(c.errors.join('\n'), /title is 101 characters/);
  assert.match(c.errors.join('\n'), /angle brackets/);
  assert.match(c.errors.join('\n'), /tags must be a list/);
  assert.strictEqual(c.openCorrections, 1);
  fs.writeFileSync(e.files.youtube, '{not json');
  assert.match(check(p, e.id).errors.join('\n'), /not valid JSON/);
  assert.strictEqual(check(p, '../x').error, 'bad-id');
});

test('a tracked .newsroom is refused as planted', () => {
  const p = repo();
  write(p, '.newsroom/editions/001-fake/release-notes.md', 'fake\n');
  git(p, 'add', '-f', '.newsroom'); git(p, 'commit', '-qm', 'plant');
  assert.strictEqual(open(p, 'x', 'v1.0.0', '').error, 'planted-newsroom');
  assert.strictEqual(JSON.parse(cli(p, 'list').stdout).error, 'planted-newsroom');
  assert.strictEqual(JSON.parse(cli(p, 'check', '001-fake').stdout).error, 'planted-newsroom');
});

test('CLI: prep then open through an input file; the file is consumed', () => {
  const p = repo();
  const prep = JSON.parse(cli(p, 'prep').stdout);
  fs.writeFileSync(prep.input, JSON.stringify({ title: 'cli `touch pwned`', since: 'v1.0.0', unit: 'alpha' }));
  const j = JSON.parse(cli(p, 'open', '--input-file', prep.input).stdout);
  assert.strictEqual(j.ok, true);
  assert.deepStrictEqual(j.desks, ['alpha']);
  assert.ok(!fs.existsSync(prep.input));
  assert.ok(!fs.existsSync(path.join(p, 'pwned')));
});
