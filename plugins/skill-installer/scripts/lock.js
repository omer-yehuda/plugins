'use strict';
/* skills.lock.json: what was installed, from which commit, with which file hashes and which verdict.
   It lives next to the skills it describes (~/.claude/skills or .claude/skills), so a project lockfile can be
   committed and reviewed. Audit compares the files on disk against it to catch edits made after install. */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const LOCK = 'skills.lock.json';
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

function hashFiles(files) {
  const list = files.map((f) => [f.rel, sha256(f.buf)]).sort((a, b) => (a[0] < b[0] ? -1 : 1));
  return { files: Object.fromEntries(list), sha256: sha256(Buffer.from(list.map((x) => x.join(' ')).join('\n'))) };
}

function read(root) {
  try {
    const data = JSON.parse(fs.readFileSync(path.join(root, LOCK), 'utf8'));
    if (data && typeof data.skills === 'object' && data.skills) return data;
  } catch { /* missing or unreadable: start fresh */ }
  return { lockVersion: 1, skills: {} };
}

// Write-then-rename through an unpredictable temp name created exclusively (O_EXCL also refuses a planted symlink),
// and never replace a lockfile that is itself a symlink or not a regular file.
function write(root, data) {
  const file = path.join(root, LOCK);
  let st = null;
  try { st = fs.lstatSync(file); } catch { /* no lockfile yet */ }
  if (st && (st.isSymbolicLink() || !st.isFile())) throw new Error(`${file} is a symlink or not a regular file, not touching it`);
  const tmp = `${file}.${crypto.randomBytes(8).toString('hex')}.tmp`;
  const fd = fs.openSync(tmp, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | (fs.constants.O_NOFOLLOW || 0), 0o600);
  try { fs.writeFileSync(fd, JSON.stringify(data, null, 2) + '\n'); } finally { fs.closeSync(fd); }
  try { fs.renameSync(tmp, file); } catch (e) { fs.rmSync(tmp, { force: true }); throw e; }
}

function record(root, name, entry) {
  const data = read(root);
  data.skills[name] = entry;
  write(root, data);
}

// Files changed between a locked entry and a new set of hashes: added, removed, changed.
function diff(oldFiles = {}, newFiles = {}) {
  const added = Object.keys(newFiles).filter((k) => !(k in oldFiles));
  const removed = Object.keys(oldFiles).filter((k) => !(k in newFiles));
  const changed = Object.keys(newFiles).filter((k) => k in oldFiles && oldFiles[k] !== newFiles[k]);
  return { added, removed, changed };
}

// Every regular file of an installed skill folder as [{ rel, buf }]; symlinks are reported, not followed.
function readInstalled(dir) {
  const files = [];
  const links = [];
  (function walk(d, rel) {
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const r = rel ? `${rel}/${ent.name}` : ent.name;
      const full = path.join(d, ent.name);
      const st = fs.lstatSync(full);
      if (st.isSymbolicLink()) links.push(r);
      else if (st.isDirectory()) walk(full, r);
      else if (st.isFile()) files.push({ rel: r, buf: fs.readFileSync(full) });
    }
  })(dir, '');
  return { files, links };
}

module.exports = { LOCK, hashFiles, read, record, diff, readInstalled };
