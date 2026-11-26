'use strict';
/*
 * Private input folders ("prep"). The skills never write user text into the project folder, where a hostile repo could
 * have planted a symlink or a tracked file. `locate.js prep` makes a fresh, unpredictable folder (mkdtemp, mode 0700)
 * with a marker file made with O_EXCL; HQ writes the target text there, and the scripts keep their small state files
 * (package-dir.txt, clone-dir.txt, fetch-flags.json) in it. Scripts accept a --target-file ONLY inside such a folder,
 * and only a folder that carries the marker is ever deleted.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const PREFIX = 'customs-in-';
const NAME_OK = /^customs-in-[A-Za-z0-9]{6}$/;
const MARKER = '.prep';
const NOFOLLOW = fs.constants.O_NOFOLLOW || 0;
const tmpRoot = () => fs.realpathSync(os.tmpdir());
const mine = (st) => process.platform === 'win32' || typeof process.getuid !== 'function' || st.uid === process.getuid();

function isPrepDir(dir) {
  try {
    const st = fs.lstatSync(dir);
    if (!st.isDirectory() || st.isSymbolicLink() || !mine(st)) return false;
    if (process.platform !== 'win32' && (st.mode & 0o077) !== 0) return false;
    const real = fs.realpathSync(dir);
    if (path.dirname(real) !== tmpRoot() || !NAME_OK.test(path.basename(real))) return false;
    return fs.lstatSync(path.join(real, MARKER)).isFile();
  } catch { return false; }
}

function createPrep() {
  const dir = fs.mkdtempSync(path.join(tmpRoot(), PREFIX));
  try { fs.chmodSync(dir, 0o700); } catch { /* not supported */ }
  const fd = fs.openSync(path.join(dir, MARKER), fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | NOFOLLOW, 0o600);
  fs.closeSync(fd);
  return dir;
}

// Path of a file that must live directly in a prep folder; throws otherwise.
function assertPrepFile(file) {
  const abs = path.resolve(file);
  if (!isPrepDir(path.dirname(abs))) throw new Error('refusing: the file is not inside a folder made by "locate.js prep" (run prep first)');
  return abs;
}

// Removes a prep folder (only when it passes isPrepDir); returns true when removed.
function removePrep(dir) {
  if (!isPrepDir(dir)) return false;
  fs.rmSync(fs.realpathSync(dir), { recursive: true, force: true });
  return true;
}

module.exports = { createPrep, isPrepDir, assertPrepFile, removePrep, PREFIX };
