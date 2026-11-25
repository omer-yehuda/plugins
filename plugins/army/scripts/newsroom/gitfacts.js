'use strict';
/*
 * Release facts read from git and from version files. No model, no network, no shell: git is run
 * with argument arrays and every ref is validated before use.
 */
const fs = require('fs');
const path = require('path');
const { git, isLink } = require('./state');

const REF_RE = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,79}$/;
const VERSION_RE = /\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?/;
const MAX_COMMITS = 200;

const validRef = (ref) => typeof ref === 'string' && REF_RE.test(ref) && !ref.includes('..') && !ref.endsWith('.lock');

function resolveBase(project, since) {
  if (since) {
    if (!validRef(since)) return { error: 'bad-ref', message: 'the since ref has characters that are not allowed' };
    if (git(project, ['rev-parse', '--verify', '--quiet', `${since}^{commit}`]) === null) return { error: 'bad-ref', message: 'the since ref does not exist in this repository' };
    return { base: since, baseKind: 'since' };
  }
  const tag = (git(project, ['describe', '--tags', '--abbrev=0']) || '').trim();
  return tag && validRef(tag) ? { base: tag, baseKind: 'tag' } : { base: null, baseKind: 'none' };
}

function collect(project, since) {
  if (git(project, ['rev-parse', '--is-inside-work-tree']) === null) return { ok: false, error: 'not-a-repo', message: 'this folder is not a git repository' };
  const b = resolveBase(project, since);
  if (b.error) return { ok: false, ...b };
  const range = b.base ? [`${b.base}..HEAD`] : ['-n', '50'];
  const raw = git(project, ['log', '--format=%x1e%h%x1f%cs%x1f%s', '--name-only', ...range]) || '';
  const commits = raw.split('\x1e').filter((s) => s.trim()).slice(0, MAX_COMMITS).map((chunk) => {
    const [head, ...rest] = chunk.split('\n');
    const [hash, date, subject] = head.split('\x1f');
    return { hash, date, subject: String(subject || '').slice(0, 200), files: rest.map((f) => f.trim()).filter(Boolean) };
  });
  const changedFiles = [...new Set(commits.flatMap((c) => c.files))].sort();
  const dirty = (git(project, ['status', '--porcelain']) || '').split('\n').filter(Boolean).map((l) => l.slice(3)).slice(0, 50);
  return {
    ok: true, branch: (git(project, ['rev-parse', '--abbrev-ref', 'HEAD']) || '').trim(),
    head: (git(project, ['rev-parse', '--short', 'HEAD']) || '').trim(), ...b, commits, changedFiles, dirty,
  };
}

function readText(file) { try { return isLink(file) ? null : fs.readFileSync(file, 'utf8'); } catch { return null; } }

function manifestVersion(text, file) {
  if (text === null) return null;
  if (file.endsWith('.json')) { try { const v = JSON.parse(text).version; return typeof v === 'string' ? v : null; } catch { return null; } }
  const m = /^version\s*=\s*["']([^"']+)["']/m.exec(text); // pyproject.toml
  return m ? m[1] : null;
}

function changelogVersion(text) {
  const m = text === null ? null : /^##\s+\[?v?(\d+\.\d+\.\d+[^\s\]]*)/m.exec(text);
  return m ? m[1] : null;
}

const MANIFESTS = ['.claude-plugin/plugin.json', 'package.json', 'pyproject.toml'];

// A unit is a folder with a version manifest: the project root, plugins/*, packages/*.
function findUnits(project) {
  const dirs = ['.'];
  for (const group of ['plugins', 'packages']) {
    try {
      for (const d of fs.readdirSync(path.join(project, group), { withFileTypes: true })) {
        if (d.isDirectory() && !d.isSymbolicLink()) dirs.push(`${group}/${d.name}`);
      }
    } catch { /* no such group */ }
  }
  const units = [];
  for (const dir of dirs) {
    for (const m of MANIFESTS) {
      const rel = dir === '.' ? m : `${dir}/${m}`;
      const version = manifestVersion(readText(path.join(project, rel)), rel);
      if (!version) continue;
      const clRel = dir === '.' ? 'CHANGELOG.md' : `${dir}/CHANGELOG.md`;
      units.push({ name: dir === '.' ? path.basename(project) : path.basename(dir), dir, manifest: rel, version, changelog: clRel, changelogVersion: changelogVersion(readText(path.join(project, clRel))) });
      break;
    }
  }
  return units;
}

// Versions listed in a root README table row: | **name** ... | 1.2.3 |
function readmeVersions(project) {
  const out = {};
  for (const line of (readText(path.join(project, 'README.md')) || '').split('\n')) {
    const m = /^\|\s*\[?\*\*([A-Za-z0-9._-]+)\*\*.*\|\s*v?(\d+\.\d+\.\d+[^\s|]*)\s*\|\s*$/.exec(line);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

function versionAt(project, ref, file) {
  if (!ref || !validRef(ref)) return null;
  return manifestVersion(git(project, ['show', `${ref}:${file}`]), file);
}

const inUnit = (unit, file) => unit.dir === '.' ? true : file.startsWith(unit.dir + '/');

module.exports = { collect, findUnits, readmeVersions, versionAt, validRef, changelogVersion, inUnit, VERSION_RE };
