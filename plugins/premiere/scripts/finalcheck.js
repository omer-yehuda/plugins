'use strict';
/* Final check of a cut: is the file the film the shot list describes?
 *
 * The cut is deterministic apart from film grain, so the check renders one frame of every shot again
 * with the same filter chain (film.shotFilter) at a small size and compares it with the same frame of the
 * file. A shot that is missing, out of order, cut short or made from the wrong still shows up as a mismatch.
 * Length, frame size and loudness are checked against the numbers the cut itself uses. */
const { spawnSync } = require('child_process');
const film = require('./film');

const THUMB = 96; // long side of the compared pictures, in pixels
const TILE = 8; // compared tile by tile, so a change in one corner is not averaged away
const MISMATCH = 11; // worst tile's mean grey difference (0-255): the same shot measures 6 or less with full grain, a reversed move 15 or more
const LENGTH_SLACK = 0.15; // seconds
const LOUDNESS_SLACK = 4; // LU either side of the cut's own loudness target

const run = (bin, args, enc) => spawnSync(bin, args, { encoding: enc, maxBuffer: 64 * 1024 * 1024 });

function probe(bin, file) {
  const r = run(bin, ['-hide_banner', '-i', file], 'utf8');
  if (r.error) return { error: `could not start ffmpeg: ${r.error.message}` };
  const log = r.stderr || '';
  const dur = /Duration:\s*(\d+):(\d+):([\d.]+)/.exec(log);
  const vid = /Stream #0.*Video:.*?\b(\d{2,5})x(\d{2,5})\b/.exec(log);
  if (!dur || !vid) return { error: 'the file is not a video ffmpeg can read' };
  return { seconds: Number(dur[1]) * 3600 + Number(dur[2]) * 60 + Number(dur[3]), size: [Number(vid[1]), Number(vid[2])], audio: /Stream #0.*Audio:/.test(log) };
}

// Worst TILE x TILE block's mean grey difference between two pictures of the same size.
function difference(a, b, w, h) {
  let worst = 0;
  for (let ty = 0; ty + TILE <= h; ty += TILE) {
    for (let tx = 0; tx + TILE <= w; tx += TILE) {
      let sum = 0;
      for (let y = ty; y < ty + TILE; y++) for (let x = tx; x < tx + TILE; x++) sum += Math.abs(a[y * w + x] - b[y * w + x]);
      worst = Math.max(worst, sum / (TILE * TILE));
    }
  }
  return worst;
}

// Where every shot sits in the film, in frames, exactly as the cut lays them out. The proof frame is a quarter
// of the way in: at the middle, a push-in and a pull-out (or a pan left and right) look the same.
function layout(shots) {
  let start = 0;
  return shots.map((s) => { const frames = Math.max(1, Math.round(s.seconds * film.FPS)); const at = { start, frames, mid: start + Math.floor(frames / 4) }; start += frames; return at; });
}

const grey = (r, n) => (r.stdout && r.stdout.length === n ? r.stdout : null);

function check(bin, dir, doc, size, file) {
  const info = probe(bin, file);
  if (info.error) return { error: info.error };
  const problems = []; const notes = [];
  const shots = doc.shots; const plan = layout(shots);
  const seconds = plan.reduce((n, p) => n + p.frames, 0) / film.FPS;
  if (Math.abs(info.seconds - seconds) > LENGTH_SLACK) problems.push(`the file is ${info.seconds.toFixed(1)}s but the shot list adds up to ${seconds.toFixed(1)}s: the cut stopped early, or shots.json changed after it; cut again`);
  const [w, h] = info.size;
  if (w * size[1] !== h * size[0]) problems.push(`the frame is ${w}x${h}, which is not this production's shape (${size[0]}x${size[1]})`);
  const wide = size[0] >= size[1];
  const tw = wide ? THUMB : Math.round((THUMB * size[0]) / size[1] / 2) * 2; const th = wide ? Math.round((THUMB * size[1]) / size[0] / 2) * 2 : THUMB;
  const small = [tw * 4, th * 4]; // the proof is rendered at four times the compared size
  let checked = 0;
  shots.forEach((s, i) => {
    const k = plan[i].mid - plan[i].start;
    const vf = `${film.shotFilter(s, { size: small, look: doc.look, first: i === 0, last: i === shots.length - 1 }).vf},select='eq(n\\,${k})',scale=${tw}:${th}:flags=area`;
    const own = grey(run(bin, ['-v', 'error', '-i', require('path').join(dir, s.still), '-vf', vf, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'gray', '-']), tw * th);
    const t = Math.max(0, (plan[i].mid - 0.4) / film.FPS); // ffmpeg returns the first frame at or after t
    const got = grey(run(bin, ['-v', 'error', '-ss', t.toFixed(4), '-i', file, '-frames:v', '1', '-vf', `scale=${tw}:${th}:flags=area`, '-f', 'rawvideo', '-pix_fmt', 'gray', '-']), tw * th);
    if (!got) return problems.push(`shot ${i + 1} (${s.id}): the file has no picture at ${(plan[i].mid / film.FPS).toFixed(1)}s, where this shot should be`);
    if (!own) return problems.push(`shot ${i + 1} (${s.id}): the still ${s.still} could not be rendered again`);
    checked++;
    const d = difference(got, own, tw, th);
    if (d > MISMATCH) problems.push(`shot ${i + 1} (${s.id}): at ${(plan[i].mid / film.FPS).toFixed(1)}s the file does not show this shot (difference ${Math.round(d)}, limit ${MISMATCH}); the still, the move or the order changed after the cut`);
  });
  if (!info.audio) problems.push('the file has no sound: the score did not make it in');
  else {
    const target = doc.voice ? film.LOUDNESS.voice : film.LOUDNESS.score;
    const m = /Integrated loudness:\s*I:\s*(-?[\d.]+) LUFS/.exec(run(bin, ['-hide_banner', '-nostats', '-i', file, '-af', 'ebur128', '-f', 'null', '-'], 'utf8').stderr || '');
    const lufs = m ? Number(m[1]) : null;
    if (lufs === null || lufs < -60) problems.push('the sound track is silent');
    else if (Math.abs(lufs - target) > LOUDNESS_SLACK) problems.push(`loudness is ${lufs.toFixed(1)} LUFS but the cut aims for ${target} (${doc.voice ? 'voice' : 'score only'}): the sound step did not finish cleanly; cut again`);
    else notes.push(`loudness ${lufs.toFixed(1)} LUFS (target ${target})`);
  }
  return { seconds: info.seconds, size: info.size, shotsChecked: checked, problems, notes };
}

module.exports = { check, probe, difference, layout, MISMATCH };
