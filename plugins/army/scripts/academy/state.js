'use strict';
/*
 * Local state helpers shared by this plugin's script. Zero dependencies (Node 18+), no network.
 * State lives in a dot folder in the project, with its own .gitignore ("*"). A state folder that is
 * tracked in git, is a symlink, or resolves outside the project is treated as planted and refused.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ID_RE = /^\d{3}-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_SLUG = 40;

function slugify(text) {
  return String(text || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '').slice(0, MAX_SLUG).replace(/-+$/g, '');
}

function isLink(p) { try { return fs.lstatSync(p).isSymbolicLink(); } catch { return false; } }

// Runs git with an argument array (never a shell). Returns stdout, or null when git fails or is missing.
function git(project, args) {
  try {
    return execFileSync('git', args, { cwd: project, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 32 * 1024 * 1024 });
  } catch { return null; }
}

function make(dirName, sub, errorCode) {
  const root = (project) => path.join(project, dirName);
  const items = (project) => path.join(root(project), sub);

  function planted(project) {
    const tracked = (git(project, ['ls-files', '--', dirName]) || '').split('\n').filter(Boolean);
    if (tracked.length) {
      return { ok: false, error: errorCode, message: `${dirName}/ is tracked in this git repository, so it came from the repository, not from your own runs. Remove it from git first.`, trackedFiles: tracked.slice(0, 10) };
    }
    const real = fs.existsSync(project) ? fs.realpathSync(project) : project;
    for (const p of [root(project), items(project)]) {
      if (!fs.existsSync(p) && !isLink(p)) continue;
      if (isLink(p) || !(fs.realpathSync(p) + path.sep).startsWith(real + path.sep)) {
        return { ok: false, error: errorCode, message: `${path.relative(project, p)} is a symlink or points outside the project; refusing to use it.` };
      }
    }
    return null;
  }

  function listIds(project) {
    try {
      return fs.readdirSync(items(project), { withFileTypes: true })
        .filter((d) => d.isDirectory() && !d.isSymbolicLink() && ID_RE.test(d.name)).map((d) => d.name).sort();
    } catch { return []; }
  }

  function create(project, title) {
    const slug = slugify(title);
    if (!slug) return { ok: false, error: 'bad-title', message: 'give it a short name (letters and digits)' };
    const bad = planted(project);
    if (bad) return bad;
    fs.mkdirSync(items(project), { recursive: true });
    fs.writeFileSync(path.join(root(project), '.gitignore'), '*\n');
    const last = listIds(project).reduce((m, id) => Math.max(m, parseInt(id.slice(0, 3), 10)), 0);
    const id = `${String(last + 1).padStart(3, '0')}-${slug}`;
    const dir = path.join(items(project), id);
    fs.mkdirSync(dir);
    return { ok: true, id, dir };
  }

  function pathOf(project, id) {
    if (!ID_RE.test(String(id || ''))) return { ok: false, error: 'bad-id', message: 'invalid id (use one printed by this script)' };
    const dir = path.join(items(project), id);
    return fs.existsSync(dir) && !isLink(dir) ? { ok: true, id, dir } : { ok: false, error: 'not-found', message: 'no such id' };
  }

  return { root, items, planted, listIds, create, pathOf };
}

// First line that matches "<Key>: value" in a file that is not a symlink. Null when absent.
function readField(file, key) {
  try {
    if (isLink(file)) return null;
    const m = new RegExp(`^${key}:\\s*(.+)$`, 'mi').exec(fs.readFileSync(file, 'utf8'));
    return m ? m[1].trim().slice(0, 160) : null;
  } catch { return null; }
}

function parseArgs(argv, valued) {
  const out = { _: [], flags: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--') && valued.includes(a.slice(2))) out.flags[a.slice(2)] = argv[++i];
    else if (a.startsWith('--')) out.flags[a.slice(2)] = true;
    else out._.push(a);
  }
  return out;
}

module.exports = { make, slugify, isLink, git, readField, parseArgs, ID_RE };
