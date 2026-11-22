'use strict';
/* Small shared helpers: path containment, sanitized names, terminal-safe text, store folder, target files. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { assertPrepFile } = require('./prep');

const within = (child, parent) => child === parent || child.startsWith(parent + path.sep);

// Only [a-z0-9-] survives, so a package-derived name can never carry shell syntax or path parts.
function safeName(s, fallback = 'package') {
  const n = String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+/, '').slice(0, 60).replace(/-+$/, '');
  return n || fallback;
}

// Control, bidi and zero-width characters are shown as escapes, so hostile text cannot drive the terminal.
function cleanText(s) {
  return String(s).replace(/\t/g, ' ').replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u2069\ufeff]/g,
    (c) => { const n = c.charCodeAt(0); return n > 255 ? '\\u' + n.toString(16).padStart(4, '0') : '\\x' + n.toString(16).padStart(2, '0'); });
}

// Writes a file without ever following a symlink: refuses a planted link, writes a new private file, then renames it over.
function writeNew(p, data) {
  let st = null;
  try { st = fs.lstatSync(p); } catch { /* does not exist */ }
  if (st && (st.isSymbolicLink() || !st.isFile())) throw new Error(`refusing to write through a symlink or non-file: ${path.basename(p)}`);
  const tmp = `${p}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  const fd = fs.openSync(tmp, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | (fs.constants.O_NOFOLLOW || 0), 0o600);
  try { fs.writeFileSync(fd, data); } finally { fs.closeSync(fd); }
  fs.renameSync(tmp, p);
}

// A hostile repo can commit .customs files or links. Refuse a tracked store, a symlinked store, scans/ or reports/, and any link inside them.
function trackedPaths(abs) {
  const env = { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0', GIT_CONFIG_NOSYSTEM: '1' };
  try {
    return execFileSync('git', ['-c', 'core.fsmonitor=false', '-c', 'core.hooksPath=/dev/null', 'ls-files', '--', abs],
      { cwd: path.dirname(abs), env, encoding: 'utf8', timeout: 15000, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch (err) {
    if (err.code === 'ENOENT' || /not a git repository/i.test(String(err.stderr))) return '';
    throw new Error('customs-tracked: could not verify that the store is untracked, refusing');
  }
}

function assertPlain(p) {
  let st = null;
  try { st = fs.lstatSync(p); } catch { return; }
  if (st.isSymbolicLink() || !st.isDirectory()) throw new Error(`customs-planted: ${path.basename(p)} is a symlink or not a folder, refusing (planted state)`);
}

// Creates a store folder (and its subfolders); a ".customs" store protects itself with a .gitignore of "*".
function ensureStore(dir, subs = []) {
  const abs = path.resolve(dir);
  assertPlain(abs);
  if (trackedPaths(abs)) throw new Error('customs-tracked: the store folder has files tracked by git (planted state), refusing. Run customs from another folder');
  fs.mkdirSync(abs, { recursive: true });
  const real = fs.realpathSync(abs);
  if (real !== path.join(fs.realpathSync(path.dirname(abs)), path.basename(abs))) throw new Error('customs-planted: the store path goes through a symlink, refusing');
  for (const s of subs) { assertPlain(path.join(abs, s)); fs.mkdirSync(path.join(abs, s), { recursive: true }); }
  for (const d of ['.', ...subs]) for (const e of fs.readdirSync(path.join(abs, d), { withFileTypes: true })) {
    if (e.isSymbolicLink()) throw new Error(`customs-planted: ${path.join(d, e.name)} is a symlink inside the store, refusing`);
  }
  if (path.basename(abs) === '.customs') writeNew(path.join(abs, '.gitignore'), '*\n');
  return abs;
}

// Reads the first line of a small text file (the way skills pass user input: never through a shell).
function readTargetFile(file) {
  const fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
  try {
    const buf = Buffer.alloc(8192);
    const n = fs.readSync(fd, buf, 0, buf.length, 0);
    const text = buf.subarray(0, n).toString('utf8').replace(/^\uFEFF/, '');
    if (text.includes('\0')) throw new Error('target file contains a NUL byte');
    return text.split(/\r\n|\n|\r/)[0].trim();
  } finally { fs.closeSync(fd); }
}

// "--target-file FILE" value from argv, or null.
function targetFileArg(argv) {
  const i = argv.indexOf('--target-file');
  if (i < 0) return null;
  const v = argv[i + 1];
  if (!v || v.startsWith('--')) throw new Error('--target-file needs a file');
  return assertPrepFile(v);
}

module.exports = { within, safeName, cleanText, ensureStore, writeNew, readTargetFile, targetFileArg };
