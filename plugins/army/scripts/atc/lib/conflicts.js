'use strict';
/* "conflicts": which files did each flight change outside its lanes, and which files did two flights both touch? */
const fs = require('fs');
const store = require('./store');
const { matchesAny, validatePattern } = require('./glob');

const lines = (s) => s.split('\n').map((x) => x.trim()).filter(Boolean);
const ignorable = (f) => f === '.atc' || f.startsWith('.atc/');

function changedFiles(cwd, base, ref) {
  if (ref) return lines(store.git(['diff', '--name-only', `${base}...${ref}`], cwd));
  const tracked = lines(store.git(['diff', '--name-only', base], cwd));
  const fresh = lines(store.git(['ls-files', '--others', '--exclude-standard'], cwd));
  return [...new Set([...tracked, ...fresh])];
}

// plan: { base, flights: { name: { lanes: [globs], ref?: branch } } }
function check(cwd, plan) {
  const base = plan.base || 'HEAD';
  const flights = plan.flights && typeof plan.flights === 'object' ? plan.flights : {};
  if (!Object.keys(flights).length) return { ok: false, error: 'plan has no flights' };
  if (!store.git(['rev-parse', '--verify', '--quiet', base + '^{commit}'], cwd)) return { ok: false, error: `unknown base ref: ${base}` };
  const report = { ok: true, base, flights: {}, shared: [], clean: true };
  const touchedBy = {};
  for (const [name, spec] of Object.entries(flights)) {
    const lanes = Array.isArray(spec.lanes) ? spec.lanes : [];
    const bad = lanes.map(validatePattern).find(Boolean);
    if (bad || !lanes.length) return { ok: false, error: `flight ${name}: ${bad || 'no lanes'}` };
    if (spec.ref && !store.git(['rev-parse', '--verify', '--quiet', spec.ref + '^{commit}'], cwd)) return { ok: false, error: `flight ${name}: unknown ref ${spec.ref}` };
    const files = changedFiles(cwd, base, spec.ref).filter((f) => !ignorable(f));
    const outside = files.filter((f) => !matchesAny(lanes, f));
    report.flights[name] = { changed: files.length, outsideLane: outside };
    if (outside.length) report.clean = false;
    for (const f of files) (touchedBy[f] = touchedBy[f] || []).push(name);
  }
  for (const [file, who] of Object.entries(touchedBy)) if (who.length > 1) report.shared.push({ file, flights: who });
  if (report.shared.length) report.clean = false;
  return report;
}

function loadPlan(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return null; }
}

module.exports = { check, loadPlan, changedFiles };
