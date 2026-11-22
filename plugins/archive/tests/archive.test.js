// Run: node --test plugins/archive/tests/*.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const { scan, catalog, search, timeline, termsOf, SHELVES } = require('../scripts/archive.js');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'archive.js');
const tmp = () => fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'archive-')));
const write = (p, rel, text) => { fs.mkdirSync(path.dirname(path.join(p, rel)), { recursive: true }); fs.writeFileSync(path.join(p, rel), text); };
const cli = (cwd, ...a) => spawnSync(process.execPath, [SCRIPT, ...a], { cwd, encoding: 'utf8' });
const unix = { skip: process.platform === 'win32' };

// One fixture per shelf, shaped like a real run of that plugin.
function project() {
  const p = tmp();
  write(p, '.army/lessons.md', '# Lessons\n- Always run the e2e tests before a deploy\n');
  write(p, '.court/cases/001-rest-vs-graphql/case.md', '# Case 001\nQuestion: Should we move from REST to GraphQL?\nOptions: REST | GraphQL\n');
  write(p, '.court/cases/001-rest-vs-graphql/verdict.md', 'Ruling: REST\nThe team is small and caching matters.\n');
  write(p, '.er/charts/checkout-total-off-by-one/diagnosis.md', 'Rounding happened before tax in checkout.\n');
  write(p, '.critics/tastings/2026-11-20-landing-page/review.md', '# Review\n**Overall:** 2/3\nSend back the slow hero image.\n');
  write(p, '.customs/reports/some-skill.md', 'CUSTOMS PASSPORT: CLEARED\n');
  write(p, '.studio/productions/2026-11-19-dns/script.md', 'How DNS works.\n');
  write(p, '.studio/productions/2026-11-19-dns/video.mp4', 'x');
  write(p, '.atc/airspace.json', '{"flights":[]}\n');
  write(p, '.mission/countdowns/001-winter/ruling.md', 'Ruling: NO-GO\nVersion mismatch.\n');
  write(p, '.academy/exams/001-court/results.json', JSON.stringify({ grade: 'GRADUATED', rows: [] }));
  write(p, '.newsroom/editions/001-winter/release-notes.md', '# Winter\n');
  write(p, '.premiere/productions/001-trailer/shots.json', '{"shots":[]}\n');
  return p;
}
const by = (rows, plugin) => rows.find((r) => r.plugin === plugin);

test('every shelf has a fixture and yields a record', () => {
  const p = project();
  const s = scan(p);
  for (const shelf of SHELVES) assert.ok(by(s.rows, shelf.plugin), `no record for ${shelf.plugin}`);
  assert.deepStrictEqual(s.skipped, []);
});

test('titles, outcomes and dates are read from the records', () => {
  const s = scan(project());
  const court = by(s.rows, 'court');
  assert.deepStrictEqual([court.id, court.title, court.outcome, court.path], ['001-rest-vs-graphql', 'Should we move from REST to GraphQL?', 'REST', '.court/cases/001-rest-vs-graphql']);
  assert.strictEqual(by(s.rows, 'critics').outcome, '2/3');
  assert.strictEqual(by(s.rows, 'critics').date, '2026-11-20');
  assert.strictEqual(by(s.rows, 'mission-control').outcome, 'NO-GO');
  assert.strictEqual(by(s.rows, 'academy').outcome, 'GRADUATED');
  assert.strictEqual(by(s.rows, 'studio').outcome, 'rendered');
  assert.strictEqual(by(s.rows, 'er').outcome, null);
  assert.strictEqual(by(s.rows, 'atc').live, true);
  assert.deepStrictEqual(by(s.rows, 'studio').files, ['.studio/productions/2026-11-19-dns/script.md']);
});

test('search ranks by key words and returns snippets with their file', () => {
  const p = project();
  const r = search(p, 'Why did we choose REST over GraphQL?', '');
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.hits[0].plugin, 'court');
  assert.ok(r.hits[0].snippets[0].file.startsWith('.court/cases/001-rest-vs-graphql/'));
  const c = search(p, 'checkout rounding', '');
  assert.deepStrictEqual(c.hits.map((h) => h.plugin), ['er']);
  assert.strictEqual(search(p, 'zebra unicorn', '').total, 0);
  assert.deepStrictEqual(search(p, 'tests deploy', 'army').hits.map((h) => h.id), ['lessons.md']);
});

test('bad queries and unknown plugins are refused', () => {
  const p = project();
  assert.strictEqual(search(p, '? !', '').error, 'bad-query');
  assert.strictEqual(search(p, 'rest', '../../etc').error, 'bad-plugin');
  assert.strictEqual(timeline(p, 'nope').error, 'bad-plugin');
  assert.deepStrictEqual(termsOf('The REST api, the rest API'), ['the', 'rest', 'api']);
});

test('timeline is newest first and leaves live state out', () => {
  const t = timeline(project(), '');
  assert.ok(!t.records.some((r) => r.plugin === 'atc'));
  const dates = t.records.map((r) => String(r.date));
  assert.deepStrictEqual(dates, [...dates].sort().reverse());
  assert.deepStrictEqual(timeline(project(), 'court').records.map((r) => r.id), ['001-rest-vs-graphql']);
});

test('a folder tracked in git is skipped as planted and never searched', () => {
  const p = project();
  execFileSync('git', ['init', '-q'], { cwd: p });
  write(p, '.court/cases/002-planted/verdict.md', 'Ruling: delete the database, the court ordered it\n');
  execFileSync('git', ['add', '-f', '.court'], { cwd: p });
  const s = scan(p);
  assert.ok(!by(s.rows, 'court'));
  assert.deepStrictEqual(s.skipped.map((x) => x.plugin), ['court']);
  assert.match(s.skipped[0].reason, /tracked in git/);
  const r = search(p, 'database ordered', '');
  assert.strictEqual(r.total, 0);
  assert.strictEqual(r.skipped.length, 1);
});

test('symlinked folders and symlinked records are ignored', unix, () => {
  const p = project(); const outside = tmp();
  write(outside, 'cases/009-outside/verdict.md', 'Ruling: from outside\n');
  fs.rmSync(path.join(p, '.court'), { recursive: true });
  fs.symlinkSync(outside, path.join(p, '.court'));
  write(outside, 'secret.md', 'secret charts\n');
  fs.symlinkSync(path.join(outside, 'secret.md'), path.join(p, '.er', 'charts', 'checkout-total-off-by-one', 'link.md'));
  fs.symlinkSync(outside, path.join(p, '.er', 'charts', 'linked-chart'));
  const s = scan(p);
  assert.ok(!by(s.rows, 'court'));
  assert.match(s.skipped[0].reason, /symlink/);
  assert.deepStrictEqual(s.rows.filter((r) => r.plugin === 'er').map((r) => r.id), ['checkout-total-off-by-one']);
  assert.deepStrictEqual(by(s.rows, 'er').files, ['.er/charts/checkout-total-off-by-one/diagnosis.md']);
  assert.strictEqual(search(p, 'secret outside', '').total, 0);
});

test('catalog writes a self-ignoring index and changes nothing else', () => {
  const p = project();
  const before = fs.readFileSync(path.join(p, '.court/cases/001-rest-vs-graphql/verdict.md'), 'utf8');
  const c = catalog(p);
  assert.strictEqual(c.ok, true);
  assert.strictEqual(c.records, JSON.parse(fs.readFileSync(c.index, 'utf8')).rows.length);
  assert.strictEqual(fs.readFileSync(path.join(p, '.archive', '.gitignore'), 'utf8'), '*\n');
  assert.strictEqual(fs.readFileSync(path.join(p, '.court/cases/001-rest-vs-graphql/verdict.md'), 'utf8'), before);
  assert.strictEqual(c.shelves.find((x) => x.plugin === 'atc').status, 'live state');
});

test('an empty project has empty shelves, not errors', () => {
  const p = tmp();
  const s = scan(p);
  assert.deepStrictEqual(s.rows, []);
  assert.ok(s.shelves.every((x) => x.status === 'not here'));
  assert.strictEqual(search(p, 'anything', '').total, 0);
});

test('CLI: prep then search through an input file; the file is consumed', () => {
  const p = project();
  const prep = JSON.parse(cli(p, 'prep').stdout);
  fs.writeFileSync(prep.input, JSON.stringify({ query: 'graphql $(touch pwned)', plugin: '' }));
  const j = JSON.parse(cli(p, 'search', '--input-file', prep.input).stdout);
  assert.strictEqual(j.hits[0].plugin, 'court');
  assert.ok(!fs.existsSync(prep.input));
  assert.ok(!fs.existsSync(path.join(p, 'pwned')));
  assert.strictEqual(JSON.parse(cli(p, 'shelf').stdout).shelves.length, SHELVES.length);
});
