// Run: node --test plugins/premiere/tests/*.test.js   (render tests need ffmpeg and are skipped without it)
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const { init, check, shots, prompts, dailies, cut, finalcheck, list } = require('../scripts/premiere.js');
const fcheck = require('../scripts/finalcheck.js');
const direct = require('../scripts/direct.js');
const film = require('../scripts/film.js');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'premiere.js');
const tmp = () => fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'premiere-')));
const cli = (cwd, ...a) => spawnSync(process.execPath, [SCRIPT, ...a], { cwd, encoding: 'utf8' });
const hasFfmpeg = spawnSync('ffmpeg', ['-version']).status === 0;
const render = { skip: hasFfmpeg ? false : 'ffmpeg is not installed' };

const shot = (id, extra) => ({ id, still: `stills/${id}.png`, seconds: 1.5, move: 'push-in', prompt: 'A lighthouse on a cliff at dusk, cinematic film still, soft haze.', ...extra });
const DOC = { title: 'Test Film', look: { grade: 'teal-amber', grain: 0.3, letterbox: true },
  shots: [shot('01-open', { line: 'It starts at dusk.' }), shot('02-turn', { move: 'pan-right' }), shot('03-close', { move: 'pull-out', line: 'And it ends at dawn.' })] };

function production(format) {
  const p = tmp();
  const prod = init(p, 'Test Film', format || 'wide');
  fs.writeFileSync(prod.files.shots, JSON.stringify(DOC));
  return { p, prod };
}
function makeStills(prod, size) {
  const colors = ['0x224466', '0x664422', '0x226644'];
  DOC.shots.forEach((s, i) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', `color=c=${colors[i]}:s=${size}`, '-frames:v', '1', path.join(prod.dir, s.still)]));
}

test('init creates a numbered, self-ignoring production with a stills folder', () => {
  const p = tmp();
  const a = init(p, 'The Lighthouse!', 'vertical');
  assert.strictEqual(a.id, '001-the-lighthouse');
  assert.deepStrictEqual(a.size, [1080, 1920]);
  assert.ok(fs.statSync(a.files.stills).isDirectory());
  assert.strictEqual(fs.readFileSync(path.join(p, '.premiere', '.gitignore'), 'utf8'), '*\n');
  assert.strictEqual(init(p, 'x', 'square').error, 'bad-format');
  assert.deepStrictEqual(list(p).map((x) => x.status), ['new']);
});

test('check validates the shot list and reports missing stills', () => {
  const { p, prod } = production();
  const c = check(p, prod.id);
  assert.strictEqual(c.ok, true);
  assert.strictEqual(c.ready, false);
  assert.deepStrictEqual(c.missing, ['stills/01-open.png', 'stills/02-turn.png', 'stills/03-close.png']);
  assert.strictEqual(c.seconds, 4.5);
  assert.deepStrictEqual(list(p).map((x) => x.status), ['pitched']);
  assert.strictEqual(cut(p, prod.id, 'ffmpeg', false).error, 'missing-stills');
});

test('validate rejects bad shot lists with clear errors', () => {
  const dir = tmp();
  const bad = (shots, extra) => film.validate({ shots, ...extra }, dir).errors.join('\n');
  const three = [shot('a'), shot('b'), shot('c')];
  assert.strictEqual(film.validate({ shots: three }, dir).ok, true);
  assert.match(bad([shot('a')]), /3 to 12 shots/);
  assert.match(bad([shot('a'), shot('a'), shot('c')]), /duplicate id a/);
  assert.match(bad([shot('a', { still: '../../etc/passwd' }), shot('b'), shot('c')]), /still must look like/);
  assert.match(bad([shot('a', { still: 'stills/../x.png' }), shot('b'), shot('c')]), /still must look like/);
  assert.match(bad([shot('a', { seconds: 60 }), shot('b'), shot('c')]), /seconds must be/);
  assert.match(bad([shot('a', { move: 'barrel-roll' }), shot('b'), shot('c')]), /move must be/);
  assert.match(bad([shot('a', { prompt: 'short' }), shot('b'), shot('c')]), /prompt must be/);
  assert.match(bad(three, { look: { grade: 'neon' } }), /look.grade/);
  assert.match(bad(three, { look: { grain: 7 } }), /look.grain/);
  assert.match(bad(three, { voice: '../voice.wav' }), /voice must be a file name/);
  assert.match(bad(three, { voice: 'voice.wav' }), /not in the production folder/);
  assert.match(bad(Array.from({ length: 12 }, (_, i) => shot(`s${i}`, { seconds: 12 }))), /144s long \(limit 120s\)/);
  assert.strictEqual(film.validate({}, dir).ok, false);
});

test('shot filters: camera move, grade, grain, bars and fades', () => {
  const f = film.shotFilter(shot('a', { seconds: 2 }), { size: [1920, 1080], look: DOC.look, first: true, last: false });
  assert.strictEqual(f.frames, 60);
  assert.match(f.vf, /^scale=3840:2160:force_original_aspect_ratio=increase,crop=3840:2160,setsar=1,zoompan=z='1\+0\.12\*on\/60'/);
  assert.match(f.vf, /d=60:s=1920x1080:fps=30/);
  assert.match(f.vf, /colorbalance=.*noise=alls=5:allf=t,vignette=PI\/5/);
  assert.match(f.vf, /drawbox=x=0:y=0:w=iw:h=138:color=black:t=fill,drawbox=x=0:y=ih-138/);
  assert.match(f.vf, /fade=t=in:st=0:d=0\.4,format=yuv420p$/);
  const v = film.shotFilter(shot('a', { move: 'tilt-up' }), { size: [1080, 1920], look: { grade: 'none', grain: 0, letterbox: true }, last: true });
  assert.ok(!/drawbox|noise|colorbalance/.test(v.vf));
  assert.match(v.vf, /y='\(ih-ih\/zoom\)\*\(1-on\/45\)'/);
  assert.match(v.vf, /fade=t=out:st=0\.90:d=0\.6/);
  for (const m of film.MOVES) assert.match(film.zoompan(m, 30), /^z='[^']+':x='[^']+':y='[^']+'$/);
});

test('captions and prompts are written from the shot list', () => {
  assert.strictEqual(film.srt(DOC.shots), '1\n00:00:00,150 --> 00:00:01,400\nIt starts at dusk.\n\n2\n00:00:03,150 --> 00:00:04,400\nAnd it ends at dawn.\n');
  const { p, prod } = production('vertical');
  const r = prompts(p, prod.id);
  const text = fs.readFileSync(r.prompts, 'utf8');
  assert.match(text, /9:16 \(vertical\)/);
  assert.match(text, /Save as: `stills\/02-turn\.png`/);
  assert.strictEqual(r.missing.length, 3);
});

test('a tracked .premiere and a symlinked stills folder are refused', () => {
  const p = tmp();
  execFileSync('git', ['init', '-q'], { cwd: p });
  fs.mkdirSync(path.join(p, '.premiere', 'productions', '001-fake'), { recursive: true });
  fs.writeFileSync(path.join(p, '.premiere', 'productions', '001-fake', 'production.json'), '{"format":"wide"}');
  execFileSync('git', ['add', '-f', '.premiere'], { cwd: p });
  assert.strictEqual(init(p, 'x', 'wide').error, 'planted-premiere');
  assert.strictEqual(JSON.parse(cli(p, 'check', '001-fake').stdout).error, 'planted-premiere');
  assert.strictEqual(check(tmp(), '../../x').error, 'bad-id');
  if (process.platform !== 'win32') {
    const { p: q, prod } = production();
    fs.rmdirSync(prod.files.stills);
    fs.symlinkSync(os.tmpdir(), prod.files.stills);
    assert.strictEqual(check(q, prod.id).error, 'planted-premiere');
  }
});

test('CLI: prep then init through an input file; the file is consumed', () => {
  const p = tmp();
  const prep = JSON.parse(cli(p, 'prep').stdout);
  fs.writeFileSync(prep.input, JSON.stringify({ title: 'cli; touch pwned', format: 'wide' }));
  const j = JSON.parse(cli(p, 'init', '--input-file', prep.input).stdout);
  assert.strictEqual(j.id, '001-cli-touch-pwned');
  assert.ok(!fs.existsSync(prep.input));
  assert.ok(!fs.existsSync(path.join(p, 'pwned')));
  assert.strictEqual(JSON.parse(cli(p, 'doctor', '--ffmpeg', path.join(p, 'no-such-ffmpeg')).stdout).error, 'no-ffmpeg');
});

test('dailies writes a contact sheet of the stills that exist', render, () => {
  const { p, prod } = production();
  assert.strictEqual(dailies(p, prod.id, 'ffmpeg').error, 'no-stills');
  makeStills(prod, '640x360');
  const d = dailies(p, prod.id, 'ffmpeg');
  assert.strictEqual(d.ok, true, JSON.stringify(d));
  assert.ok(fs.statSync(d.dailies).size > 500);
  assert.deepStrictEqual(d.order, ['01-open', '02-turn', '03-close']);
});

test('cut renders a draft film with sound, captions and metadata', render, () => {
  const { p, prod } = production();
  makeStills(prod, '640x360');
  const r = cut(p, prod.id, 'ffmpeg', true);
  assert.strictEqual(r.ok, true, JSON.stringify(r));
  assert.deepStrictEqual(r.size, [960, 540]);
  assert.strictEqual(r.seconds, 4.5);
  const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type,width,height', '-of', 'json', r.film], { encoding: 'utf8' }));
  assert.ok(Math.abs(Number(probe.format.duration) - 4.5) < 0.2, probe.format.duration);
  assert.deepStrictEqual(probe.streams.map((s) => s.codec_type).sort(), ['audio', 'video']);
  assert.strictEqual(probe.streams.find((s) => s.codec_type === 'video').width, 960);
  assert.match(fs.readFileSync(r.captions, 'utf8'), /It starts at dusk/);
  assert.match(fs.readFileSync(r.metadata, 'utf8'), /Declare altered or synthetic content/);
  assert.ok(!fs.readdirSync(path.join(prod.dir, 'shots')).some((n) => n.includes('.tmp.')));
});

test('director: size and angle are validated, and flow notes follow the shot list', () => {
  const dir = tmp();
  const errs = film.validate({ shots: [shot('a', { size: 'huge' }), shot('b', { angle: 'side' }), shot('c')] }, dir).errors.join('\n');
  assert.match(errs, /shot 1: size must be one of wide, medium, close, detail/);
  assert.match(errs, /shot 2: angle must be one of eye, low, high, over-shoulder, top/);
  const good = [shot('a', { size: 'wide', move: 'pull-out' }), shot('b', { size: 'medium', angle: 'low', move: 'pan-right' }), shot('c', { size: 'close', move: 'hold' })];
  const v = film.validate({ shots: good }, dir);
  assert.deepStrictEqual([v.ok, v.flow], [true, []]);
  assert.match(direct.flow([shot('a'), shot('b', { size: 'wide' }), shot('c')])[0], /no size on shots 1, 3/);
  const notes = direct.flow([
    shot('a', { size: 'close', move: 'pan-left' }), shot('b', { size: 'close', move: 'pan-right' }),
    shot('c', { size: 'close', angle: 'low', move: 'pan-right' }), shot('d', { size: 'detail', move: 'pan-right' }), shot('e', { size: 'detail', angle: 'top', move: 'push-in' }),
  ]).join('\n');
  for (const re of [/pan-left on a close shot slides the subject/, /pan-left then pan-right swings/, /same size \(close\) and same angle/, /pan-right three times running/, /three close shots running/, /push-in on a detail shot/]) assert.match(notes, re);
  assert.doesNotMatch(direct.flow([shot('a', { size: 'close' }), shot('b', { size: 'close', angle: 'low', move: 'hold' })]).join('\n'), /jump cut/);
  assert.deepStrictEqual(direct.flow(null), []);
  assert.deepStrictEqual(direct.table([shot('a', { size: 'wide' }), null]).length, 2);
});

test('shots prints the director table and flow notes for a production', () => {
  const { p, prod } = production();
  const r = shots(p, prod.id);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.flowOk, false);
  assert.match(r.flow[0], /no size on shots 1, 2, 3/);
  assert.match(r.table[1], /^1 {2}01-open/);
  assert.deepStrictEqual(check(p, prod.id).flow, r.flow);
  fs.writeFileSync(prod.files.shots, JSON.stringify({ shots: [] }));
  assert.strictEqual(shots(p, prod.id).error, 'bad-shots');
  const c = cli(p, 'shots', 'nope');
  assert.strictEqual(c.status, 1);
});

test('finalcheck: tile difference and the shot layout the cut uses', () => {
  const a = Buffer.alloc(256); const b = Buffer.alloc(256);
  assert.strictEqual(fcheck.difference(a, b, 16, 16), 0);
  for (let y = 8; y < 16; y++) for (let x = 8; x < 16; x++) b[y * 16 + x] = 200;
  assert.strictEqual(fcheck.difference(a, b, 16, 16), 200); // one tile of four changed: not averaged down to 50
  assert.deepStrictEqual(fcheck.layout([{ seconds: 1.5 }, { seconds: 2 }]), [{ start: 0, frames: 45, mid: 11 }, { start: 45, frames: 60, mid: 60 }]);
  assert.match(fcheck.probe('ffmpeg-that-does-not-exist', 'x.mp4').error, /could not start ffmpeg|not a video/);
});

test('finalcheck passes the cut it was made from and fails when the shot list no longer matches', render, () => {
  const { p, prod } = production();
  assert.strictEqual(finalcheck(p, prod.id, 'ffmpeg', true).error, 'missing-stills');
  // patterned stills, so a wrong still or a reversed move is visible
  ['testsrc2', 'mandelbrot', 'smptebars'].forEach((src, i) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', `${src}=s=1920x1080`, '-frames:v', '1', path.join(prod.dir, DOC.shots[i].still)]));
  assert.strictEqual(finalcheck(p, prod.id, 'ffmpeg', true).error, 'no-film');
  assert.strictEqual(cut(p, prod.id, 'ffmpeg', true).ok, true);
  const ok = finalcheck(p, prod.id, 'ffmpeg', true);
  assert.deepStrictEqual([ok.ok, ok.verdict, ok.problems, ok.shotsChecked], [true, 'PASS', [], 3]);
  assert.deepStrictEqual(ok.size, [960, 540]);
  assert.match(ok.notes[0], /loudness -1\d\.\d LUFS \(target -18\)/);

  const edit = (fn) => { const d = JSON.parse(JSON.stringify(DOC)); fn(d); fs.writeFileSync(prod.files.shots, JSON.stringify(d)); return finalcheck(p, prod.id, 'ffmpeg', true); };
  const swapped = edit((d) => { [d.shots[0].still, d.shots[1].still] = [d.shots[1].still, d.shots[0].still]; });
  assert.strictEqual(swapped.ok, false);
  assert.match(swapped.problems.join('\n'), /shot 1 \(01-open\): at 0\.\ds the file does not show this shot[\s\S]*shot 2 \(02-turn\)/);
  assert.doesNotMatch(swapped.problems.join('\n'), /shot 3/);
  const reversed = edit((d) => { d.shots[1].move = 'pan-left'; });
  assert.match(reversed.problems.join('\n'), /^shot 2 \(02-turn\).*the still, the move or the order changed/);
  const longer = edit((d) => { d.shots[2].seconds = 6; d.shots[1].line = 'A new line.'; });
  assert.match(longer.problems.join('\n'), /the file is 4\.5s but the shot list adds up to 9\.0s[\s\S]*captions\.srt has 2 caption\(s\) but the shot list has 3 line\(s\)/);
  const voiced = edit((d) => { d.voice = 'voice.wav'; });
  assert.strictEqual(voiced.ok, false); // check refuses a voice file that is not there
  fs.writeFileSync(prod.files.shots, JSON.stringify(DOC));
  fs.rmSync(path.join(prod.dir, 'captions.srt'));
  assert.match(finalcheck(p, prod.id, 'ffmpeg', true).problems.join('\n'), /captions\.srt is missing/);
  assert.strictEqual(cli(p, 'finalcheck', prod.id, '--draft').status, 1);
});
