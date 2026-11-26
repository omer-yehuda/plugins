// Run: node --test plugins/video-creator/tests/*.test.js   (render tests need ffmpeg and are skipped without it)
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const vc = require('../scripts/vc.js');
const S = require('../scripts/styles.js');
const P = require('../scripts/project.js');
const E = require('../scripts/edit.js');
const gen = require('../scripts/gen-skills.js');
const R = require('../scripts/render.js');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'vc.js');
const tmp = () => fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'vc-')));
const cli = (cwd, ...a) => spawnSync(process.execPath, [SCRIPT, ...a], { cwd, encoding: 'utf8' });
const hasFfmpeg = spawnSync('ffmpeg', ['-version']).status === 0;
const render = { skip: hasFfmpeg ? false : 'ffmpeg is not installed' };
const { styles: BUILTIN } = S.loadAll();

const SHOTS = [
  { id: '01-hook', seconds: 2, move: 'push-in', prompt: 'A cube village at sunrise, wide view', cast: false, line: 'Every morning it rebuilds itself.' },
  { id: '02-hero', seconds: 2, move: 'orbit', prompt: 'The character stretches outside a cube house' },
  { id: '03-turn', seconds: 1.5, move: 'shake', prompt: 'A tower of blocks starts to wobble', transition: 'cut', line: 'Then the tower moved.' },
];
function project(style, platform) {
  const p = tmp();
  const r = vc.init(p, { title: 'Cube Village', style: style || 'voxel', platform: platform || 'shorts' });
  fs.writeFileSync(r.files.project, JSON.stringify({ title: 'Cube Village', style: r.style, platform: r.platform, character: 'a small builder with a red cap', world: 'a cube valley at dawn', shots: SHOTS }));
  return { p, r };
}
function media(r, size) {
  const colors = ['0x335577', '0x775533', '0x337755'];
  SHOTS.forEach((s, i) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', `color=c=${colors[i]}:s=${size}`, '-frames:v', '1', path.join(r.files.media, `${s.id}.png`)]));
}

test('every built-in style pack is valid and has its own generated command', () => {
  assert.ok(Object.keys(BUILTIN).length >= 14);
  for (const [id, s] of Object.entries(BUILTIN)) {
    assert.deepStrictEqual(S.validateStyle(id, s), [], id);
    const file = path.join(__dirname, '..', 'skills', id, 'SKILL.md');
    assert.strictEqual(fs.readFileSync(file, 'utf8'), gen.skill(id, s), `${id} skill is out of date`);
  }
  assert.ok(BUILTIN.voxel && BUILTIN['3d-realistic'] && BUILTIN.anime);
});

test('style prompts never carry franchise names', () => {
  for (const [id, s] of Object.entries(BUILTIN)) {
    for (const k of ['look', 'character', 'finish', 'motion']) assert.ok(!/minecraft|lego|pixar|disney|ghibli|nintendo/i.test(s[k]), `${id}.${k}`);
  }
});

test('mixing two styles blends look and edit, and rejects unknown or doubled styles', () => {
  const m = S.resolve('voxel+anime', BUILTIN).style;
  assert.match(m.look, /voxel.*anime/);
  assert.strictEqual(m.grade, BUILTIN.voxel.grade);
  assert.strictEqual(m.transition, BUILTIN.anime.transition);
  assert.ok(m.fx.length <= 4);
  assert.strictEqual(S.resolve('voxel+nope', BUILTIN).error, 'unknown-style');
  assert.strictEqual(S.resolve('anime+anime', BUILTIN).error, 'same-style');
  assert.strictEqual(S.resolve('a+b+c', BUILTIN).error, 'unknown-style');
});

test('image prompts lock style, character and world, and drop the character on cast:false shots', () => {
  const st = BUILTIN.voxel; const doc = { character: 'a small builder with a red cap', world: 'a cube valley at dawn' };
  const a = S.imagePrompt(st, doc, SHOTS[0], '9:16'); const b = S.imagePrompt(st, doc, SHOTS[1], '9:16');
  assert.ok(a.startsWith(st.look) && b.startsWith(st.look));
  assert.ok(!a.includes('red cap') && b.includes('red cap'));
  assert.ok(a.includes('a cube valley at dawn') && a.endsWith('Aspect ratio 9:16.'));
  assert.match(S.motionPrompt(st, SHOTS[1]), /Camera: orbit/);
});

test('init makes a numbered, self-ignoring project; check finds missing media; clips beat stills', () => {
  const { p, r } = project();
  assert.strictEqual(r.id, '001-cube-village');
  assert.deepStrictEqual(r.size, [1080, 1920]);
  assert.strictEqual(fs.readFileSync(path.join(p, '.video-creator', '.gitignore'), 'utf8'), '*\n');
  const c = vc.check(p, r.id);
  assert.ok(c.ok && !c.ready);
  assert.deepStrictEqual(c.missing, SHOTS.map((s) => s.id));
  fs.writeFileSync(path.join(r.files.media, '01-hook.png'), 'x'); fs.writeFileSync(path.join(r.files.media, '01-hook.mp4'), 'x');
  assert.strictEqual(vc.check(p, r.id).media['01-hook'], 'clip');
  assert.strictEqual(vc.init(p, { title: 'x', style: 'nope' }).error, 'unknown-style');
  assert.strictEqual(vc.init(p, { title: 'x', style: 'anime', platform: 'vhs' }).error, 'bad-platform');
  assert.strictEqual(vc.init(p, { title: 'x', style: 'anime', platform: 'tiktok' }).platform, 'shorts');
});

test('validation catches bad fields and keeps paths out of the project file', () => {
  const { p, r } = project();
  const bad = { title: 't', style: 'anime', platform: 'shorts', voice: '../../etc/passwd', shots: [{ id: '../x', seconds: 99, move: 'spin', prompt: 'hi', transition: 'explode', cast: 'yes' }] };
  fs.writeFileSync(r.files.project, JSON.stringify(bad));
  const e = vc.check(p, r.id).errors.join('\n');
  for (const want of ['voice must be', 'id must be', 'seconds must be', 'move must be', 'prompt must be', 'transition must be', 'cast must be', '2 to 16 shots']) assert.ok(e.includes(want), want);
  assert.strictEqual(vc.check(p, '../../etc').error, 'bad-id');
});

test('prompts.md lists one image and one video prompt per shot with the save name', () => {
  const { p, r } = project('anime', 'youtube');
  const out = vc.prompts(p, r.id);
  const md = fs.readFileSync(out.prompts, 'utf8');
  assert.strictEqual((md.match(/Image prompt:/g) || []).length, 3);
  assert.strictEqual((md.match(/Video prompt/g) || []).length, 3);
  assert.ok(md.includes('media/02-hero.png') && md.includes('Aspect ratio 16:9'));
});

test('custom styles are validated, saved, usable and cannot shadow built-ins', () => {
  const p = tmp();
  const pack = { ...BUILTIN.watercolor, id: 'vhs-sports', name: 'VHS sports' };
  delete pack.custom;
  assert.ok(vc.addStyle(p, pack).ok);
  assert.ok(vc.styles(p).styles.some((s) => s.id === 'vhs-sports' && s.custom));
  assert.ok(vc.init(p, { title: 'game day', style: 'vhs-sports+noir', platform: 'square' }).ok);
  assert.strictEqual(vc.addStyle(p, { ...pack, id: 'anime' }).error, 'builtin-style');
  assert.strictEqual(vc.addStyle(p, { ...pack, id: 'broken', fps: 7 }).error, 'bad-style');
});

test('transitions overlap shots without changing the total length', () => {
  const st = BUILTIN.watercolor; const ov = E.overlaps(SHOTS, st);
  assert.strictEqual(ov[0], 0);
  assert.ok(ov[1] <= 0.45 * 2 + 1e-9 && ov[2] === 0.04);
  assert.deepStrictEqual(E.starts(SHOTS), [0, 2, 4]);
  const g = E.xfadeGraph(SHOTS, st, ov).graph;
  assert.match(g, /xfade=transition=dissolve:duration=0\.900:offset=2\.000/);
  assert.match(g, /xfade=transition=fade:duration=0\.040:offset=4\.000\[v\]/);
  assert.match(P.srt(SHOTS, E.starts(SHOTS)), /00:00:04,150 --> 00:00:05,350\nThen the tower moved\./);
});

test('every grade, fx, move and score builds a filter', () => {
  for (const f of S.FX) assert.ok(E.fxFilter(f, 1920, 1080), f);
  for (const g of S.GRADES) assert.ok(g === 'none' || E.GRADES[g], g);
  for (const s of S.SCORES) assert.ok(s === 'none' || E.SCORES[s], s);
  for (const m of S.MOVES) assert.match(E.zoompan(m, 60), /^z=/);
});

test('the CLI refuses free text on the command line and a planted state folder', () => {
  const p = tmp();
  assert.strictEqual(cli(p, 'init', '--input-file', '/etc/hostname').status, 1);
  execFileSync('git', ['init', '-q'], { cwd: p });
  fs.mkdirSync(path.join(p, '.video-creator', 'projects'), { recursive: true });
  fs.writeFileSync(path.join(p, '.video-creator', 'x'), 'x');
  execFileSync('git', ['add', '-f', '.video-creator/x'], { cwd: p });
  assert.strictEqual(JSON.parse(cli(p, 'list').stdout).error, 'planted-state');
});

test('animatic renders with no media at all', render, async () => {
  const { p, r } = project('pixel-art', 'shorts');
  const out = await vc.render(p, r.id, 'ffmpeg', 'animatic', {});
  assert.ok(out.ok, JSON.stringify(out));
  assert.ok(fs.statSync(out.video).size > 10000);
  assert.strictEqual(out.seconds, 5.5);
});

test('draft and final cuts render stills and a short clip, with captions and metadata', render, async () => {
  const { p, r } = project('cyberpunk', 'youtube');
  media(r, '1280x720');
  fs.rmSync(path.join(r.files.media, '03-turn.png'));
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc2=s=640x360:r=24', '-t', '0.7', path.join(r.files.media, '03-turn.mp4')]);
  const d = await vc.render(p, r.id, 'ffmpeg', 'draft', { burn: true });
  assert.ok(d.ok, JSON.stringify(d));
  assert.deepStrictEqual(d.size, [960, 540]);
  const f = await vc.render(p, r.id, 'ffmpeg', 'final', {});
  assert.ok(f.ok, JSON.stringify(f));
  const dur = parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f.video], { encoding: 'utf8' }));
  assert.ok(Math.abs(dur - 5.5) < 0.1, String(dur));
  assert.match(fs.readFileSync(f.metadata, 'utf8'), /synthetic content/);
  assert.ok(vc.sheet(p, r.id, 'ffmpeg').ok);
  const rs = vc.restyle(p, r.id, 'claymation');
  assert.ok(rs.ok && rs.style === 'claymation' && vc.check(p, rs.id).missing.length === 3);
});

test('a re-render reuses unchanged shots and re-encodes only the edited one', render, async () => {
  const { p, r } = project('anime', 'square');
  media(r, '800x800');
  const a = await vc.render(p, r.id, 'ffmpeg', 'draft', {});
  assert.ok(a.ok && a.shotsReused === 0, JSON.stringify(a));
  const b = await vc.render(p, r.id, 'ffmpeg', 'draft', {});
  assert.strictEqual(b.shotsReused, 3);
  const doc = JSON.parse(fs.readFileSync(r.files.project, 'utf8'));
  doc.shots[1].move = 'pan-left';
  fs.writeFileSync(r.files.project, JSON.stringify(doc));
  const c = await vc.render(p, r.id, 'ffmpeg', 'draft', {});
  assert.strictEqual(c.shotsReused, 2);
});

test('build writes prompts, the style snapshot and the animatic in one call; output is compact JSON', render, () => {
  const { p, r } = project('noir', 'youtube');
  const res = cli(p, 'build', r.id);
  assert.strictEqual(res.status, 0, res.stdout + res.stderr);
  assert.strictEqual(res.stdout.trim().split('\n').length, 1);
  const out = JSON.parse(res.stdout);
  assert.ok(out.ok && out.animatic && fs.existsSync(out.prompts) && out.missing.length === 3);
  const snap = JSON.parse(fs.readFileSync(path.join(r.dir, 'style.json'), 'utf8'));
  assert.strictEqual(snap.id, 'noir');
  assert.ok(!('palette' in snap) && snap.look);
});

test('the pool stops at the first error and never runs more than n jobs at once', async () => {
  let live = 0; let peak = 0;
  const job = (e) => async () => { live++; peak = Math.max(peak, live); await new Promise((z) => setTimeout(z, 5)); live--; return e; };
  assert.strictEqual(await R.pool([job(null), job(null), job(null), job(null)], 2), null);
  assert.ok(peak <= 2);
  assert.strictEqual(await R.pool([job(null), job('boom'), job(null)], 1), 'boom');
});
