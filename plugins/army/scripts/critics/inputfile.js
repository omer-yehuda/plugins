'use strict';
/*
 * Safe input files for critics. `prep` creates a fresh, unpredictable temp folder; HQ writes the free-text
 * input to the printed path; the script then reads it (never through a symlink) and deletes it, but only
 * when it sits directly inside one of its own prep folders. No other path is ever read or deleted.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const PREFIX = 'critics-in-';
const MAX_BYTES = 200000;

const tmpRoot = () => fs.realpathSync(os.tmpdir());
const fail = (error, message) => ({ ok: false, error, message });

function prep(name) {
  const dir = fs.mkdtempSync(path.join(tmpRoot(), PREFIX));
  return { ok: true, dir, input: path.join(dir, name) };
}

function insidePrepDir(abs) {
  const dir = path.dirname(abs);
  let st;
  try { st = fs.lstatSync(dir); } catch { return false; }
  if (st.isSymbolicLink() || !st.isDirectory()) return false;
  if (typeof process.getuid === 'function' && st.uid !== process.getuid()) return false;
  return path.dirname(dir) === tmpRoot() && path.basename(dir).startsWith(PREFIX);
}

// Returns { ok: true, text, done() } or { ok: false, error, message }. Call done() after a successful parse.
function readPrepFile(file) {
  if (typeof file !== 'string' || !file) return fail('bad-input', 'missing --input-file (run prep first and write to the printed path)');
  const abs = path.resolve(file);
  if (!insidePrepDir(abs)) return fail('bad-input', 'the input file must be inside a folder made by the prep command');
  let fd;
  try {
    if (fs.lstatSync(abs).isSymbolicLink()) return fail('bad-input', 'the input file is a symlink; refusing it');
    fd = fs.openSync(abs, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
    if (!fs.fstatSync(fd).isFile()) return fail('bad-input', 'the input file is not a regular file');
    const buf = Buffer.alloc(MAX_BYTES);
    const n = fs.readSync(fd, buf, 0, MAX_BYTES, 0);
    const done = () => {
      try { fs.unlinkSync(abs); } catch { /* best effort */ }
      try { fs.rmdirSync(path.dirname(abs)); } catch { /* best effort */ }
    };
    return { ok: true, text: buf.toString('utf8', 0, n), done };
  } catch { return fail('bad-input', 'cannot read the input file'); } finally { if (fd !== undefined) fs.closeSync(fd); }
}

module.exports = { prep, readPrepFile, PREFIX };
