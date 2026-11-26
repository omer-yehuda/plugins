'use strict';
/* ffmpeg filter and argument builders. Pure functions: no file system, no processes. */

const GRADES = {
  none: null,
  vivid: 'eq=saturation=1.3:contrast=1.06',
  warm: 'colorbalance=rm=0.06:bm=-0.06:rh=0.04:bh=-0.04,eq=contrast=1.05',
  cold: 'colorbalance=rm=-0.05:bm=0.06:rs=-0.04:bs=0.06,eq=contrast=1.06:saturation=0.92',
  'teal-amber': 'colorbalance=rs=-0.06:bs=0.08:rh=0.08:bh=-0.08,eq=contrast=1.08:saturation=1.05',
  pastel: 'eq=saturation=0.85:brightness=0.03:contrast=0.93',
  neon: 'eq=saturation=1.45:contrast=1.15,colorbalance=rs=0.05:bs=0.1:rh=0.06',
  mono: 'hue=s=0,eq=contrast=1.15',
  sepia: 'colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131',
  natural: 'eq=contrast=1.03:saturation=1.02',
  sickly: 'hue=s=0.35,colorbalance=gs=0.12:gm=0.08:rs=-0.05:bs=-0.05,eq=contrast=1.1:brightness=-0.04',
};

function fxFilter(name, w, h) {
  const post = `bitand(val\\,224)+16`;
  return {
    grain: 'noise=alls=8:allf=t',
    'grain-heavy': 'noise=alls=22:allf=t',
    vignette: 'vignette=PI/4',
    'vignette-soft': 'vignette=PI/6',
    pixelate: `scale=${Math.round(w / 10)}:${Math.round(h / 10)}:flags=neighbor,scale=${w}:${h}:flags=neighbor`,
    'pixelate-soft': `scale=${Math.round(w / 4)}:${Math.round(h / 4)}:flags=neighbor,scale=${w}:${h}:flags=neighbor`,
    scanlines: 'drawgrid=w=iw:h=4:t=1:c=black@0.22',
    glitch: 'rgbashift=rh=-4:bh=4',
    posterize: `lutrgb=r='${post}':g='${post}':b='${post}'`,
    sharpen: 'unsharp=5:5:0.8',
    paper: 'noise=alls=6:allf=u,eq=brightness=0.01',
    jitter: `crop=${w - 8}:${h - 8}:'4+3*sin(n*2.7)':'4+3*cos(n*3.1)',scale=${w}:${h}`,
    handheld: `crop=${Math.round(w * 0.94)}:${Math.round(h * 0.94)}:'(iw-ow)/2*(1+0.6*sin(t*1.3))':'(ih-oh)/2*(1+0.5*sin(t*1.9+1))',scale=${w}:${h}`,
    bars: w > h ? `drawbox=x=0:y=0:w=iw:h=ih*0.12:color=black:t=fill,drawbox=x=0:y=ih*0.88:w=iw:h=ih*0.12:color=black:t=fill` : null,
  }[name] || null;
}

// Camera move on a still, as a zoompan over n frames. The image is first scaled to twice the frame so moves stay smooth.
function zoompan(move, n) {
  const t = `(on/${n})`;
  const cx = "'(iw-iw/zoom)/2'"; const cy = "'(ih-ih/zoom)/2'";
  const m = {
    'push-in': [`'1+0.15*${t}'`, cx, cy],
    'pull-out': [`'1.15-0.15*${t}'`, cx, cy],
    'pan-right': ["'1.15'", `'(iw-iw/zoom)*${t}'`, cy],
    'pan-left': ["'1.15'", `'(iw-iw/zoom)*(1-${t})'`, cy],
    'tilt-up': ["'1.15'", cx, `'(ih-ih/zoom)*(1-${t})'`],
    'tilt-down': ["'1.15'", cx, `'(ih-ih/zoom)*${t}'`],
    orbit: [`'1.1+0.06*${t}'`, `'(iw-iw/zoom)*(0.5-0.45*cos(${t}*PI))'`, `'(ih-ih/zoom)*(0.5+0.15*sin(${t}*2*PI))'`],
    shake: ["'1.08'", "'(iw-iw/zoom)/2*(1+0.35*sin(on*2.3)+0.15*sin(on*5.1))'", "'(ih-ih/zoom)/2*(1+0.3*cos(on*1.9)+0.15*sin(on*4.3))'"],
    hold: ["'1'", cx, cy],
  }[move] || ["'1'", cx, cy];
  return `z=${m[0]}:x=${m[1]}:y=${m[2]}`;
}

// One shot, encoded alone: still + move, or clip fitted to the frame and held on its last frame if short.
function segmentArgs({ input, kind, move, seconds, style, size, draft, out }) {
  const [w, h] = size; const fps = style.fps; const n = Math.max(2, Math.round(seconds * fps));
  const chain = kind === 'clip'
    ? [`scale=${w}:${h}:force_original_aspect_ratio=increase`, `crop=${w}:${h}`, `fps=${fps}`, `tpad=stop_mode=clone:stop_duration=${seconds}`, `trim=duration=${seconds}`, 'setpts=PTS-STARTPTS']
    : [`scale=${w * 2}:${h * 2}:force_original_aspect_ratio=increase`, `crop=${w * 2}:${h * 2}`, `zoompan=${zoompan(move, n)}:d=${n}:s=${w}x${h}:fps=${fps}`];
  if (GRADES[style.grade]) chain.push(GRADES[style.grade]);
  for (const f of style.fx) { const x = fxFilter(f, w, h); if (x) chain.push(x); }
  chain.push('setsar=1', 'format=yuv420p');
  const args = ['-y', '-loglevel', 'error', '-i', input, '-vf', chain.join(','), '-an', '-frames:v', String(n),
    '-c:v', 'libx264', '-preset', draft ? 'ultrafast' : 'medium', '-crf', draft ? '28' : '18', '-r', String(fps), out];
  return args;
}

// Overlap between shot i-1 and shot i, kept under half of either shot.
function overlaps(shots, style) {
  return shots.map((s, i) => {
    if (i === 0) return 0;
    const tr = s.transition || style.transition;
    const want = tr === 'cut' ? 0.04 : style.transitionSeconds;
    return Math.max(0.04, Math.min(want, 0.45 * Math.min(s.seconds, shots[i - 1].seconds)));
  });
}
const segSeconds = (shots, ov) => shots.map((s, i) => s.seconds + (ov[i + 1] || 0));
const starts = (shots) => shots.reduce((a, s, i) => (a.push(i ? a[i - 1] + shots[i - 1].seconds : 0), a), []);

function xfadeGraph(shots, style, ov) {
  if (shots.length === 1) return { graph: '[0:v]null[v]', label: '[v]' };
  const st = starts(shots); const parts = []; let prev = '[0:v]';
  for (let i = 1; i < shots.length; i++) {
    const tr = shots[i].transition || style.transition;
    const name = tr === 'cut' ? 'fade' : tr;
    const out = i === shots.length - 1 ? '[v]' : `[x${i}]`;
    parts.push(`${prev}[${i}:v]xfade=transition=${name}:duration=${ov[i].toFixed(3)}:offset=${st[i].toFixed(3)}${out}`);
    prev = out;
  }
  return { graph: parts.join(';'), label: '[v]' };
}

const SCORES = {
  chiptune: "0.07*sgn(sin(2*PI*t*262*pow(2,mod(floor(t*6),4)*4/12)))+0.08*sgn(sin(2*PI*t*65.4*pow(2,mod(floor(t/2),2)*5/12)))",
  cinematic: '0.22*sin(2*PI*55*t)+0.12*sin(2*PI*82.4*t)+0.08*sin(2*PI*110*t)*(0.6+0.4*sin(2*PI*0.1*t))',
  playful: '0.16*sin(2*PI*t*330*pow(2,mod(floor(t*3),3)*3/12))*exp(-4*mod(t,1/3))+0.08*sin(2*PI*110*t)',
  anthem: '(0.1*sin(2*PI*220*t)+0.08*sin(2*PI*277.2*t)+0.08*sin(2*PI*329.6*t))*(0.5+0.5*sin(2*PI*0.125*t-PI/2))+0.1*sin(2*PI*55*t)',
  ambient: '0.12*sin(2*PI*174.6*t)*(0.5+0.5*sin(2*PI*0.07*t))+0.1*sin(2*PI*261.6*t)*(0.5+0.5*sin(2*PI*0.05*t+1))',
  action: '0.25*sin(2*PI*55*t)*(0.3+0.7*exp(-8*mod(t,0.25)))+0.06*sgn(sin(2*PI*110*t))*exp(-10*mod(t,0.5))',
  lullaby: '0.13*sin(2*PI*t*523.3*pow(2,mod(floor(t*2),5)*2/12))*exp(-3*mod(t,0.5))',
  synthwave: '0.09*(2*mod(t*55*pow(2,mod(floor(t/2),4)*3/12),1)-1)+0.07*sin(2*PI*220*t)*(0.5+0.5*sin(2*PI*0.25*t))',
  noir: '0.1*sin(2*PI*146.8*t)*(0.5+0.5*sin(2*PI*0.2*t))+0.08*sin(2*PI*174.6*t)+0.05*sin(2*PI*220*t)*exp(-2*mod(t,2))',
  dread: '0.16*sin(2*PI*41*t)+0.12*sin(2*PI*43.5*t)+0.03*sin(2*PI*660*t)*(0.5+0.5*sin(2*PI*0.3*t))',
};

// Subtitles are laid out on a 384x288 canvas scaled to the frame; tall frames need bigger type set higher, clear of the app buttons.
const captionStyle = (size) => (size && size[1] > size[0] ? 'Fontsize=20,Bold=1,Outline=2,Shadow=0,MarginV=70' : 'Fontsize=14,Bold=1,Outline=2,Shadow=0,MarginV=24');

// The whole cut in one command: segments joined with transitions, sound mixed, captions burned in if asked.
function joinArgs({ segs, shots, style, total, voice, music, burn, out, draft, size }) {
  const ov = overlaps(shots, style);
  const args = ['-y', '-loglevel', 'error'];
  segs.forEach((s) => args.push('-i', s));
  let k = segs.length; const a = [];
  if (music) { args.push('-stream_loop', '-1', '-i', music); a.push(`[${k++}:a]atrim=duration=${total},asetpts=N/SR/TB[bed]`); }
  else if (SCORES[style.score]) { args.push('-f', 'lavfi', '-i', `aevalsrc='${SCORES[style.score]}':s=44100:d=${total}`); a.push(`[${k++}:a]lowpass=f=${style.score === 'chiptune' ? 6000 : 2500}[bed]`); }
  else { args.push('-f', 'lavfi', '-i', `anullsrc=r=44100:cl=stereo:d=${total}`); a.push(`[${k++}:a]anull[bed]`); }
  const fadeOut = Math.max(0, total - 1.2).toFixed(2);
  a.push(`[bed]volume=${voice ? 0.25 : 0.6},afade=t=in:d=0.8,afade=t=out:st=${fadeOut}:d=1.2[b2]`);
  if (voice) { args.push('-i', voice); a.push(`[${k++}:a]apad,atrim=duration=${total}[vo]`, '[vo][b2]amix=inputs=2:duration=first:normalize=0[mx]'); }
  else a.push('[b2]anull[mx]');
  a.push('[mx]loudnorm=I=-14:TP=-1.5:LRA=11,aresample=44100[a]');
  const x = xfadeGraph(shots, style, ov);
  let v = x.graph; let vl = x.label;
  if (burn) { v += `;${vl}subtitles=captions.srt:force_style='${captionStyle(size)}'[vs]`; vl = '[vs]'; }
  args.push('-filter_complex', `${v};${a.join(';')}`, '-map', vl, '-map', '[a]', '-t', total.toFixed(3),
    '-c:v', 'libx264', '-preset', draft ? 'ultrafast' : 'medium', '-crf', draft ? '28' : '19', '-pix_fmt', 'yuv420p', '-r', '30',
    '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', out);
  return { args, ov };
}

// Contact sheet: the first frame of every shot in one grid.
function sheetArgs(inputs, size, out) {
  const cols = Math.min(4, inputs.length); const rows = Math.ceil(inputs.length / cols);
  const tw = 360; const th = Math.round((tw * size[1]) / size[0]);
  const args = ['-y', '-loglevel', 'error'];
  inputs.forEach((f) => args.push('-i', f));
  const parts = inputs.map((_, i) => `[${i}:v]scale=${tw}:${th}:force_original_aspect_ratio=increase,crop=${tw}:${th},setsar=1,trim=end_frame=1,setpts=PTS-STARTPTS[s${i}]`);
  args.push('-filter_complex', `${parts.join(';')};${inputs.map((_, i) => `[s${i}]`).join('')}concat=n=${inputs.length}:v=1:a=0,tile=${cols}x${rows}:padding=6:color=0x111111[o]`, '-map', '[o]', '-frames:v', '1', '-q:v', '3', out);
  return args;
}

module.exports = { captionStyle, GRADES, SCORES, fxFilter, zoompan, segmentArgs, overlaps, segSeconds, starts, xfadeGraph, joinArgs, sheetArgs };
