'use strict';
/* The director's view of a shot list: where the camera stands for each shot (size, angle, move) and
 * flow notes about how each shot leads into the next. Pure functions. */
const SIZES = ['wide', 'medium', 'close', 'detail'];
const ANGLES = ['eye', 'low', 'high', 'over-shoulder', 'top'];
const SIDEWAYS = { 'pan-left': 'pan-right', 'pan-right': 'pan-left', 'tilt-up': 'tilt-down', 'tilt-down': 'tilt-up' };
const TIGHT = ['close', 'detail'];

// Errors for the two optional camera-position fields. `at` is the shot's label in messages.
function fieldErrors(s, at) {
  const out = [];
  if (s.size !== undefined && !SIZES.includes(s.size)) out.push(`${at}: size must be one of ${SIZES.join(', ')}`);
  if (s.angle !== undefined && !ANGLES.includes(s.angle)) out.push(`${at}: angle must be one of ${ANGLES.join(', ')}`);
  return out;
}

function flow(shots) {
  const out = [];
  const list = (Array.isArray(shots) ? shots : []).filter((s) => s && typeof s === 'object');
  const name = (i) => `shot ${i + 1}${list[i].id ? ` (${list[i].id})` : ''}`;
  const unsized = list.map((s, i) => (SIZES.includes(s.size) ? null : i + 1)).filter(Boolean);
  if (unsized.length) out.push(`no size on shot${unsized.length > 1 ? 's' : ''} ${unsized.join(', ')}: the director sets "size" (${SIZES.join(', ')}) and "angle" for every shot`);
  list.forEach((s, i) => {
    if (TIGHT.includes(s.size) && s.move in SIDEWAYS) out.push(`${name(i)}: ${s.move} on a ${s.size} shot slides the subject out of frame; pan and tilt on wide or medium shots, use push-in, pull-out or hold here`);
    if (s.size === 'detail' && s.move === 'push-in') out.push(`${name(i)}: push-in on a detail shot crops what the shot is about; use hold or pull-out`);
    const prev = list[i - 1];
    if (!prev) return;
    if (SIDEWAYS[prev.move] === s.move) out.push(`${name(i - 1)} to ${name(i)}: ${prev.move} then ${s.move} swings the camera back the way it came; keep one direction or put another move between`);
    if (prev.size && prev.size === s.size && (prev.angle || 'eye') === (s.angle || 'eye')) out.push(`${name(i - 1)} to ${name(i)}: same size (${s.size}) and same angle; on one subject that reads as a jump cut, so change the size or the angle`);
    const before = list[i - 2];
    if (before && before.move === prev.move && prev.move === s.move) out.push(`${name(i - 2)} to ${name(i)}: ${s.move} three times running; vary the move`);
    if (before && before.size && before.size === prev.size && prev.size === s.size) out.push(`${name(i - 2)} to ${name(i)}: three ${s.size} shots running; change the size so the film breathes`);
  });
  return [...new Set(out)];
}

// One text row per shot, for the director and for the pitch screen.
function table(shots) {
  const pad = (v, n) => String(v === undefined ? '-' : v).padEnd(n);
  const rows = [`${pad('#', 3)}${pad('id', 22)}${pad('size', 8)}${pad('angle', 15)}${pad('move', 11)}secs`];
  (Array.isArray(shots) ? shots : []).forEach((s, i) => { if (s && typeof s === 'object') rows.push(`${pad(i + 1, 3)}${pad(s.id, 22)}${pad(s.size, 8)}${pad(s.angle, 15)}${pad(s.move, 11)}${s.seconds}`); });
  return rows;
}

module.exports = { SIZES, ANGLES, fieldErrors, flow, table };
