#!/usr/bin/env node
/*
 * Customs fetcher: the ONLY place that runs git. Skills never build a git command.
 *
 *   fetch.js --target-file FILE            clone the GitHub URL on the first line of FILE into a fresh temp folder
 *   fetch.js --cleanup --target-file FILE  remove the temp clone that this script made (path is re-checked) and the private
 *                                          input folder made by `locate.js prep` (only a folder with the prep marker)
 *
 * The URL is re-parsed with the strict locate.js grammar, and git is started with an argument list (no shell).
 * Hardened: no hooks, no fsmonitor, no file/ext transport, no submodules, no LFS smudge, no credential prompts or helpers,
 * shallow single branch. Afterwards every symlink is checked: links that point outside the package are removed and
 * recorded in fetch-flags.json (scan.js reports them as SY002). Nothing from the clone is ever executed.
 * FILE must be inside a prep folder. Writes package-dir.txt, clone-dir.txt and fetch-flags.json next to FILE, prints one JSON object. Exit: 0 ok, 3 error.
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { locate } = require('./locate');
const { within, writeNew, readTargetFile, targetFileArg } = require('./safe');
const { removePrep } = require('./prep');

function cloneArgs(p, dest) {
  return ['-c', 'core.hooksPath=/dev/null', '-c', 'core.fsmonitor=false', '-c', 'protocol.file.allow=never', '-c', 'protocol.ext.allow=never',
    '-c', 'filter.lfs.smudge=', '-c', 'filter.lfs.process=', '-c', 'filter.lfs.required=false', '-c', 'credential.helper=', '-c', 'transfer.fsckObjects=true',
    'clone', '--depth', '1', '--single-branch', '--no-tags', '--no-recurse-submodules', ...(p.ref ? [`--branch=${p.ref}`] : []), '--', p.cloneUrl, dest];
}
const cloneEnv = (base = process.env) => ({ ...base, GIT_LFS_SKIP_SMUDGE: '1', GIT_TERMINAL_PROMPT: '0', GIT_ALLOW_PROTOCOL: 'https' });

// Remove (and report) every symlink that points outside root or dangles; returns [{file, target}]
function quarantineSymlinks(root) {
  const flagged = [];
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, e.name);
      if (e.isSymbolicLink()) {
        let real = null;
        try { real = fs.realpathSync(abs); } catch { /* dangling */ }
        if (!real || !within(real, root)) { flagged.push({ file: path.relative(root, abs).split(path.sep).join('/'), target: fs.readlinkSync(abs) }); fs.unlinkSync(abs); }
      } else if (e.isDirectory() && !(dir === root && e.name === '.git')) stack.push(abs);
    }
  }
  return flagged;
}

function isOwnClone(dir) {
  const tmp = fs.realpathSync(os.tmpdir());
  const real = fs.realpathSync(dir);
  return path.dirname(real) === tmp && /^customs-[A-Za-z0-9]{6}$/.test(path.basename(real)) && !fs.lstatSync(dir).isSymbolicLink();
}

function fetchPackage(input, store) {
  const p = locate(input);
  if (p.kind !== 'github') throw new Error(p.kind === 'error' ? p.message : 'not a GitHub URL: nothing to clone');
  const tmp = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'customs-'));
  const dest = path.join(tmp, 'pkg');
  execFileSync('git', cloneArgs(p, dest), { env: cloneEnv(), timeout: 180000, maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  const root = fs.realpathSync(dest);
  const flagged = quarantineSymlinks(root);
  const pkg = p.subdir ? fs.realpathSync(path.join(root, p.subdir)) : root;
  if (!within(pkg, root) || !fs.statSync(pkg).isDirectory()) throw new Error('sub-folder not found in the repository');
  writeNew(path.join(store, 'package-dir.txt'), pkg + '\n');
  writeNew(path.join(store, 'clone-dir.txt'), tmp + '\n');
  writeNew(path.join(store, 'fetch-flags.json'), JSON.stringify({ packageRoot: pkg, symlinks: flagged }) + '\n');
  return { ok: true, dir: tmp, packageDir: pkg, ref: p.ref, subdir: p.subdir, removedSymlinks: flagged };
}

function main(argv) {
  try {
    const tf = targetFileArg(argv);
    if (!tf) throw new Error('usage: fetch.js [--cleanup] --target-file FILE');
    const store = path.dirname(tf);
    if (argv.includes('--cleanup')) {
      const removed = [];
      let clone = null;
      try { clone = readTargetFile(path.join(store, 'clone-dir.txt')); } catch (e) { if (e.code !== 'ENOENT') throw e; }
      if (clone) {
        if (!isOwnClone(clone)) throw new Error('refusing to remove: not a customs clone folder');
        fs.rmSync(clone, { recursive: true, force: true });
        removed.push(clone);
      }
      if (removePrep(store)) removed.push(store); // the private input folder that "locate.js prep" made, nothing else
      process.stdout.write(JSON.stringify({ ok: true, removed }) + '\n');
      return 0;
    }
    process.stdout.write(JSON.stringify(fetchPackage(readTargetFile(tf), store), null, 2) + '\n');
    return 0;
  } catch (err) {
    const detail = err && err.stderr ? String(err.stderr).trim().split('\n').slice(-2).join(' ') : '';
    process.stdout.write(JSON.stringify({ ok: false, error: String(err.message || err).split('\n')[0] + (detail ? ': ' + detail : '') }) + '\n');
    return 3;
  }
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));
module.exports = { cloneArgs, cloneEnv, quarantineSymlinks, isOwnClone, fetchPackage };
