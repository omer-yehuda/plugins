#!/usr/bin/env node
/*
 * Customs locator: turns "<path | GitHub URL | installed plugin name>" into something scan.js can read.
 * Prints one JSON object. Reads the file system only: no network, no git, nothing is executed.
 *
 * locate.js prep   make a private input folder (see prep.js) and print {"ok":true,"dir":..,"input":"<dir>/target.txt"}; also
 *                   refuses a planted .customs (tracked or symlinked). HQ writes the target text to "input".
 * Input: a positional argument, or --target-file FILE (first line of FILE: how skills pass user text without a shell).
 *   {"kind":"path","path":"/abs/dir"}
 *   {"kind":"github","cloneUrl":"https://github.com/o/r.git","owner":"o","repo":"r","ref":null,"subdir":null}
 *   {"kind":"installed","path":"/abs/dir","candidates":[{name,version,path,modified}]}
 *   {"kind":"notfound","searched":[...]}
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { ensureStore, writeNew, readTargetFile, targetFileArg } = require('./safe');
const { createPrep } = require('./prep');

// Strict GitHub grammar: reject, never sanitize. No leading "-", no "..", no shell or URL syntax characters.
const OWNER_OK = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const REPO_OK = /^(?![-.])[A-Za-z0-9._-]{1,100}$/;
const REF_OK = /^(?![-/])(?!.*(?:\.\.|\/\/|\/$|\.lock$|@\{))[A-Za-z0-9._\/-]{1,100}$/;
const SEG_OK = /^(?![-.])[A-Za-z0-9._-]{1,100}$/;
const GH_URL = /^https:\/\/(?:www\.)?github\.com\/([^/?#\s]+)\/([^/?#\s]+)(?:\/tree\/([^/?#\s]+)(?:\/([^?#\s]+))?)?\/?$/;
const GH_SHORT = /^([^/\s]+)\/([^/\s]+)$/;
const URLISH = /^[a-z][a-z0-9+.-]*:\/\/|^git@|^github\.com\//i;

function github(owner, repo, ref, subdir) {
  subdir = subdir ? subdir.replace(/\/+$/, '') : subdir;
  const name = repo.replace(/\.git$/, '');
  if (!OWNER_OK.test(owner) || !REPO_OK.test(name)) return null;
  if (ref && !REF_OK.test(ref)) return null;
  if (subdir && !subdir.split('/').every((s) => SEG_OK.test(s))) return null;
  return { kind: 'github', cloneUrl: `https://github.com/${owner}/${name}.git`, owner, repo: name, ref: ref || null, subdir: subdir || null };
}

function readManifest(dir) {
  try { return JSON.parse(fs.readFileSync(path.join(dir, '.claude-plugin', 'plugin.json'), 'utf8')); } catch { return null; }
}

function findInstalled(name, base) {
  const roots = [path.join(base, 'plugins')];
  const found = [];
  const want = name.toLowerCase();
  const stack = roots.map((r) => [r, 0]);
  while (stack.length) {
    const [dir, depth] = stack.pop();
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    const m = readManifest(dir);
    if (m && String(m.name || '').toLowerCase() === want) {
      let modified = 0;
      try { modified = fs.statSync(dir).mtimeMs; } catch { /* ignore */ }
      found.push({ name: m.name, version: m.version || null, path: dir, modified: new Date(modified).toISOString() });
    }
    if (depth >= 7) continue;
    for (const e of entries) if (e.isDirectory() && !e.isSymbolicLink() && !['node_modules', '.git'].includes(e.name)) stack.push([path.join(dir, e.name), depth + 1]);
  }
  return found.sort((a, b) => (a.modified < b.modified ? 1 : -1));
}

function locate(arg, env = process.env) {
  const input = String(arg || '').trim();
  if (!input) return { kind: 'error', message: 'usage: locate.js <path | GitHub URL | plugin name>' };
  if (/[\u0000-\u001f\u007f]/.test(input)) return { kind: 'error', message: 'the target contains control characters' };
  if (URLISH.test(input)) {
    const gh = input.match(GH_URL);
    const parsed = gh && github(gh[1], gh[2], gh[3], gh[4]);
    if (parsed) return parsed;
    return { kind: 'error', message: gh ? 'unsupported characters in the owner, repo, branch or sub-folder' : 'only https://github.com/<owner>/<repo> URLs are supported' };
  }
  const expanded = input.replace(/^~(?=$|[\\/])/, os.homedir());
  try {
    const abs = fs.realpathSync(path.resolve(expanded));
    const st = fs.statSync(abs);
    return st.isDirectory() ? { kind: 'path', path: abs } : { kind: 'path', path: path.dirname(abs), note: 'a file was given: the folder that holds it will be scanned' };
  } catch { /* not a path */ }
  const base = env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
  const candidates = /^[\w.@-]+$/.test(input) ? findInstalled(input.replace(/@.*$/, ''), base) : [];
  if (candidates.length) return { kind: 'installed', path: candidates[0].path, candidates };
  const short = input.match(GH_SHORT);
  const sp = short && github(short[1], short[2], null, null);
  if (sp) return { ...sp, note: 'treated as a GitHub owner/repo shorthand' };
  return { kind: 'notfound', searched: [path.resolve(expanded), path.join(base, 'plugins')] };
}

function prep() {
  try {
    ensureStore('.customs', ['scans', 'reports']);
    const dir = createPrep();
    process.stdout.write(JSON.stringify({ ok: true, dir, input: path.join(dir, 'target.txt') }) + '\n');
    return 0;
  } catch (err) { process.stdout.write(JSON.stringify({ ok: false, error: String(err.message || err) }) + '\n'); return 3; }
}

function main(argv) {
  if (argv[0] === 'prep' || argv[0] === '--prep') return prep();
  let input;
  try {
    const tf = targetFileArg(argv);
    input = tf ? readTargetFile(tf) : argv.find((a) => !a.startsWith('--'));
    const result = locate(input);
    // For a local package, remember its folder next to the target file so scan.js --target-file can read it.
    if (tf && result.path) writeNew(path.join(path.dirname(tf), 'package-dir.txt'), result.path + '\n');
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    return result.kind === 'error' ? 3 : result.kind === 'notfound' ? 1 : 0;
  } catch (err) { process.stdout.write(JSON.stringify({ kind: 'error', message: String(err.message || err) }) + '\n'); return 3; }
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));
module.exports = { locate, findInstalled, github, GH_URL, URLISH };
