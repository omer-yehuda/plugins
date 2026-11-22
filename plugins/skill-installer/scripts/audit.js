'use strict';
/* Audit installed skills: rescan each one with the customs scanner and compare its files with skills.lock.json.
   Read-only: it never changes, moves or deletes an installed skill. */

const path = require('node:path');
const inst = require('./install');
const gate = require('./gate');
const lock = require('./lock');

function auditOne(root, name, locked) {
  const dir = path.join(root, name);
  const { files, links } = lock.readInstalled(dir);
  const hashes = lock.hashFiles(files);
  const scan = gate.inspectDir(dir);
  let state = 'untracked';
  let changes;
  if (locked) {
    changes = lock.diff(locked.files, hashes.files);
    state = locked.sha256 === hashes.sha256 ? 'unchanged' : 'modified';
  }
  return { name, state, verdict: scan.verdict, findings: scan.findings, symlinks: links, commit: locked ? locked.commit : null, source: locked ? locked.source : null, changes };
}

function audit(scope) {
  const root = inst.destRoot(scope || 'user');
  const data = lock.read(root);
  const names = [...inst.installedNames(root)].sort();
  const skills = names.map((n) => auditOne(root, n, data.skills[n]));
  const count = (k, v) => skills.filter((s) => s[k] === v).length;
  return {
    ok: true,
    root,
    total: skills.length,
    denied: count('verdict', 'DENIED'),
    secondary: count('verdict', 'SECONDARY INSPECTION'),
    modified: count('state', 'modified'),
    untracked: count('state', 'untracked'),
    skills,
  };
}

function text(r) {
  const head = `Audited ${r.total} skills in ${r.root}: ${r.denied} denied, ${r.secondary} need a look, ${r.modified} changed since install, ${r.untracked} not in the lockfile.`;
  const rows = r.skills.filter((s) => s.verdict !== 'CLEARED' || s.state === 'modified' || s.symlinks.length)
    .map((s) => `- ${s.name}: ${s.verdict}, ${s.state}${s.symlinks.length ? `, symlinks: ${s.symlinks.join(', ')}` : ''}` +
      s.findings.slice(0, 3).map((f) => `\n    ${f.sev} ${f.rule} ${f.file}:${f.line} ${f.why}`).join(''));
  return [head, ...rows].join('\n');
}

module.exports = { audit, text };
