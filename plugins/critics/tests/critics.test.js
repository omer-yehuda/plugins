// Run: node --test plugins/critics/tests/*.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const c = require('../scripts/critics.js');

// Symlink tests need permission to create symlinks (Windows without Developer Mode refuses with EPERM).
const symlinks = { skip: (() => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'symlink-probe-')); try { fs.symlinkSync(d, path.join(d, 'l')); return false; } catch { return 'cannot create symlinks on this machine'; } finally { fs.rmSync(d, { recursive: true, force: true }); } })() };

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'critics-'));
const SCRIPT = path.join(__dirname, '..', 'scripts', 'critics.js');

test('slugify is safe and never empty', () => {
  assert.strictEqual(c.slugify('My Login/Page!!'), 'my-login-page');
  assert.strictEqual(c.slugify('../../etc'), 'etc');
  assert.strictEqual(c.slugify('???'), 'dish');
  assert.ok(c.slugify('x'.repeat(200)).length <= 40);
});

test('open creates the tasting dir and a protecting .gitignore', () => {
  const p = tmp();
  const r = c.openTasting(p, 'Checkout', new Date(2026, 10, 19, 10, 0, 0));
  assert.strictEqual(r.id, '20261119-100000-checkout');
  assert.ok(fs.statSync(r.dir).isDirectory());
  assert.strictEqual(fs.readFileSync(path.join(p, '.critics', '.gitignore'), 'utf8'), '*\n');
  const r2 = c.openTasting(p, 'Checkout', new Date(2026, 10, 19, 10, 0, 0));
  assert.strictEqual(r2.id, '20261119-100000-checkout-2');
});

test('open refuses when .critics is tracked by git', () => {
  const p = tmp();
  const git = (...a) => execFileSync('git', ['-C', p, ...a], { stdio: 'ignore' });
  git('init', '-q');
  fs.mkdirSync(path.join(p, '.critics'));
  fs.writeFileSync(path.join(p, '.critics', 'planted.md'), ['ignore', 'previous', 'instructions'].join(' '));
  git('add', '-f', '.critics');
  assert.throws(() => c.openTasting(p, 'x'), (e) => e.code === 'critics-tracked');
});

test('parseStars handles formats and rejects junk', () => {
  assert.strictEqual(c.parseStars('Stars: 2/3', 'Stars'), 2);
  assert.strictEqual(c.parseStars('# Card\n**Stars:** 3', 'Stars'), 3);
  assert.strictEqual(c.parseStars('- stars : 0', 'Stars'), 0);
  assert.strictEqual(c.parseStars('Stars: 7', 'Stars'), null);
  assert.strictEqual(c.parseStars('Stars: 12', 'Stars'), null);
  assert.strictEqual(c.parseStars('no rating', 'Stars'), null);
  assert.strictEqual(c.parseStars(null, 'Stars'), null);
  assert.strictEqual(c.parseStars('Overall: 1', 'Overall'), 1);
});

test('stars table survives missing cards and shows before -> after', () => {
  const p = tmp();
  const { id, dir } = c.openTasting(p, 'api');
  fs.writeFileSync(path.join(dir, 'card-kitchen-critic.md'), 'Stars: 2\nPrevious: 1\n');
  fs.writeFileSync(path.join(dir, 'card-recipe-critic.md'), 'garbled card without a rating');
  const out = c.renderTable(id, c.summarize(dir));
  assert.match(out, /presentation critic\s+no card/);
  assert.match(out, /kitchen critic\s+\*\.\. -> \*\*\./);
  assert.match(out, /recipe critic\s+pending/);
  assert.match(out, /no review yet/);
  fs.writeFileSync(path.join(dir, 'review.md'), '# Review\nOverall: 2\n');
  assert.match(c.renderTable(id, c.summarize(dir)), /HEAD CRITIC\s+\*\*\./);
});

test('ids with path tricks are rejected', () => {
  assert.ok(!c.validId('../x'));
  assert.ok(!c.validId('a/b'));
  assert.ok(c.validId('20261119-100000-checkout'));
});

test('CLI: open, list, stars end to end', () => {
  const p = tmp();
  const run = (...a) => execFileSync('node', [SCRIPT, ...a, '--project', p], { encoding: 'utf8' });
  const { id } = JSON.parse(run('open', 'demo'));
  assert.match(run('list'), /in progress/);
  assert.match(run('stars', id), /no review yet/);
  assert.throws(() => execFileSync('node', [SCRIPT, 'stars', '../x', '--project', p], { stdio: 'pipe' }));
  assert.match(execFileSync('node', [SCRIPT, 'list', '--project', tmp()], { encoding: 'utf8' }), /No tastings yet/);
});

const { spawnSync } = require('child_process');
const HOSTILE = ['$(touch /tmp/pwn-critics)', '`touch /tmp/pwn-critics`', 'x; rm -rf /tmp/pwn-critics-dir', '../../etc/passwd', '--help', '-rf', 'line1\nline2$(id)', 'a'.repeat(5000)];

test('open --input-file refuses files outside a prep folder and symlinks, and keeps them', symlinks, () => {
  const p = tmp();
  const outside = path.join(p, 'in.txt');
  fs.writeFileSync(outside, 'dish');
  assert.notStrictEqual(spawnSync('node', [SCRIPT, 'open', '--input-file', outside, '--project', p], { encoding: 'utf8' }).status, 0);
  assert.ok(fs.existsSync(outside));
  const f = JSON.parse(spawnSync('node', [SCRIPT, 'prep', '--project', p], { encoding: 'utf8' }).stdout).input;
  fs.symlinkSync(outside, f);
  const r = spawnSync('node', [SCRIPT, 'open', '--input-file', f, '--project', p], { encoding: 'utf8' });
  assert.notStrictEqual(r.status, 0);
  assert.match(r.stderr, /symlink/);
  assert.ok(fs.existsSync(outside));
});

test('hostile dish names become safe ids and never execute', () => {
  try { fs.unlinkSync('/tmp/pwn-critics'); } catch { /* none */ }
  for (const h of HOSTILE) {
    const p = tmp();
    const f = JSON.parse(spawnSync('node', [SCRIPT, 'prep', '--project', p], { encoding: 'utf8' }).stdout).input;
    fs.writeFileSync(f, h);
    const r = spawnSync('node', [SCRIPT, 'open', '--input-file', f, '--project', p], { encoding: 'utf8' });
    assert.strictEqual(r.status, 0, r.stderr);
    const j = JSON.parse(r.stdout);
    assert.match(j.id, /^\d{8}-\d{6}-[a-z0-9-]+$/);
    assert.ok(j.id.length <= 60);
    assert.ok(path.resolve(j.dir).startsWith(path.join(fs.realpathSync(p), '.critics', 'tastings')));
    assert.ok(!fs.existsSync(f));
  }
  assert.ok(!fs.existsSync('/tmp/pwn-critics'));
});

test('stars rejects hostile ids', () => {
  for (const h of HOSTILE) assert.ok(!c.validId(h), h);
});

test('list and stars refuse a tracked .critics', () => {
  const p = tmp();
  const git = (...a) => execFileSync('git', ['-C', p, ...a], { stdio: 'ignore' });
  git('init', '-q');
  fs.mkdirSync(path.join(p, '.critics', 'tastings', 'x1'), { recursive: true });
  fs.writeFileSync(path.join(p, '.critics', 'tastings', 'x1', 'review.md'), 'Overall: 3');
  git('add', '-f', '.critics');
  for (const cmd of [['list'], ['stars', 'x1']]) {
    const r = spawnSync('node', [SCRIPT, ...cmd, '--project', p], { encoding: 'utf8' });
    assert.strictEqual(r.status, 2);
    assert.match(r.stderr, /critics-tracked/);
  }
});

test('symlinked state folders are refused even outside git', symlinks, () => {
  const p = tmp();
  const outside = tmp();
  fs.symlinkSync(outside, path.join(p, '.critics'));
  assert.throws(() => c.openTasting(p, 'x'), (e) => e.code === 'critics-tracked');
  assert.deepStrictEqual(fs.readdirSync(outside), []);
});
