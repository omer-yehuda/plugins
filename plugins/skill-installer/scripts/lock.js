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

function write(root, data) {
  const file = path.join(root, LOCK);
  if (fs.existsSync(file) && fs.lstatSync(file).isSymbolicLink()) throw new Error(`${file} is a symlink, not touching it`);
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', { flag: 'w' });
  fs.renameSync(tmp, file);
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
