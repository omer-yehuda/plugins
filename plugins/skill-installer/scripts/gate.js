'use strict';
/* The install gate: every skill is scanned by the customs scanner before it is written anywhere.
   Files are copied into a fresh private temp folder (never executed), scanned, and the folder is removed.
   DENIED never installs. SECONDARY INSPECTION installs only after the user accepts the listed findings.
   A scanner failure counts as SECONDARY INSPECTION, never CLEARED. */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { scan } = require('./scan');

const TOP = 10;
const SEV = { CRITICAL: 3, HIGH: 2, MEDIUM: 1, LOW: 0 };

function stage(files) {
  const dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'skill-installer-scan-'));
  for (const f of files) {
    const out = path.join(dir, ...f.rel.split('/'));
    if (!out.startsWith(dir + path.sep)) throw new Error(`unsafe path ${f.rel}`);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, f.buf, { flag: 'wx', mode: 0o600 });
  }
  return dir;
}

// Anything the scanner could not read (vendored node_modules, opaque binaries, truncated or unreadable files, a cutoff)
// would be installed unscanned, so for the install gate a coverage gap is never CLEARED. Gaps are listed first.
const summary = (r) => {
  const all = r.findings || [];
  const gaps = all.filter((f) => f.cat === 'coverage');
  const rank = (f) => (f.cat === 'coverage' ? 10 : 0) + SEV[f.sev];
  return {
    verdict: r.verdict === 'CLEARED' && gaps.length ? 'SECONDARY INSPECTION' : r.verdict,
    counts: r.counts,
    unscanned: gaps.map((f) => f.file),
    findings: all
      .filter((f) => f.cat === 'coverage' || SEV[f.sev] >= SEV.MEDIUM)
      .sort((a, b) => rank(b) - rank(a))
      .slice(0, TOP)
      .map((f) => ({ sev: f.sev, rule: f.rule, file: f.file, line: f.line, why: f.msg })),
  };
};

// Returns { verdict, counts, findings } for in-memory files [{ rel, buf }].
function inspectFiles(files) {
  let dir;
  try {
    dir = stage(files);
    return summary(scan(dir));
  } catch (e) {
    return { verdict: 'SECONDARY INSPECTION', counts: {}, findings: [{ sev: 'HIGH', rule: 'SK000', file: '.', line: 0, why: `scanner could not finish: ${e.message}` }] };
  } finally {
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  }
}

// Returns { verdict, ... } for a folder already on disk (audit of installed skills).
function inspectDir(dir) {
  try { return summary(scan(dir)); } catch (e) {
    return { verdict: 'SECONDARY INSPECTION', counts: {}, findings: [{ sev: 'HIGH', rule: 'SK000', file: '.', line: 0, why: `scanner could not finish: ${e.message}` }] };
  }
}

// What the installer may do with this verdict.
function decide(verdict, accepted) {
  if (verdict === 'CLEARED') return 'install';
  if (verdict === 'DENIED') return 'blocked';
  return accepted ? 'install' : 'needs-approval';
}

module.exports = { inspectFiles, inspectDir, decide };
