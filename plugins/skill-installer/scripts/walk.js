'use strict';
/*
 * File discovery and reading. Never follows symlinks (O_NOFOLLOW), never executes anything.
 * Order: security-relevant folders first, so a file-count cutoff cannot hide a hook or script.
 * Coverage gaps are findings, never silent: truncated files, skipped binaries, vendored code, the file-count cutoff.
 */
const fs = require('fs');
const path = require('path');
const { analyze } = require('./analyze');
const { within } = require('./safe');

const MAX_BYTES = 2 * 1024 * 1024;
const EDGE = 1024 * 1024;
const MAX_FILES = 5000;
const SCRIPT_EXT = new Set(['.js', '.mjs', '.cjs', '.ts', '.sh', '.bash', '.zsh', '.py', '.ps1', '.psm1', '.rb', '.pl', '.bat', '.cmd', '.php', '.lua']);
const CONFIG_EXT = new Set(['.json', '.yml', '.yaml', '.toml', '.ini', '.cfg']);
const MD_EXT = new Set(['.md', '.mdx', '.markdown', '.txt', '.rst']);
const OPAQUE_BIN = new Set(['.exe', '.dll', '.so', '.dylib', '.node', '.wasm', '.bin', '.msi', '.dmg', '.jar', '.class', '.pyc', '.app', '.com']);
const MAGIC = [[0x7f, 0x45, 0x4c, 0x46], [0x4d, 0x5a], [0xcf, 0xfa, 0xed, 0xfe], [0xfe, 0xed, 0xfa, 0xcf], [0xca, 0xfe, 0xba, 0xbe]];
const MEDIA_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.bmp', '.pdf', '.zip', '.gz', '.woff', '.woff2', '.ttf', '.otf', '.mp3', '.mp4', '.mov', '.webm']);
const PRIORITY = ['hooks', '.claude-plugin', 'skills', 'agents', 'commands', 'scripts', '.mcp.json', 'mcp.json'];
const WIRED_DIR = /^(hooks|\.claude-plugin|skills|agents|commands)\//;
const REF_SOURCE = /(^|\/)(hooks\/[^/]+\.json|\.claude-plugin\/[^/]+\.json|\.?mcp\.json|SKILL\.md|(agents|commands)\/[^/]+\.md)$/;
const OWN_ROOT = fs.realpathSync(path.join(__dirname, '..'));
const FIXTURES = path.join(OWN_ROOT, 'tests', 'fixtures');
const MARKER = /^(\/\/|#)\s*customs:rules-file\s*$/;
const TESTFILE = /(^|\/)(tests?|__tests__|spec)\/|\.(test|spec)\.[cm]?[jt]s$|(^|\/)test_[^/]+\.py$/;
const SPLIT = /\r\n|\n|\r|\u2028|\u2029/;

function classify(rel, head, wired) {
  const ext = path.extname(rel).toLowerCase();
  const base = path.basename(rel);
  if (MD_EXT.has(ext)) {
    if (/(^|\/)\.customs\/(reports|scans)\//.test(rel)) return 'doc';
    const doc = /^(README|CHANGELOG|CONTRIBUTING|LICENSE|SECURITY|CODE_OF_CONDUCT|NOTICE|AUTHORS)/i.test(base) || /(^|\/)(docs?|examples?)\//i.test(rel);
    return doc && !wired ? 'doc' : 'agentmd'; // a doc that a skill, agent, command or hook points at is read as agent text
  }
  if (SCRIPT_EXT.has(ext) || /^#!/.test(head)) return 'script';
  if (CONFIG_EXT.has(ext) || base === '.mcp.json') return 'config';
  return wired ? 'script' : 'other';
}

// Breadth-first list of regular files. Symlinks are recorded, not followed.
function enumerate(root, ctx) {
  const entries = [];
  const queue = [root];
  for (let qi = 0; qi < queue.length; qi++) {
    const dir = queue[qi];
    let list;
    try { list = fs.readdirSync(dir, { withFileTypes: true }); } catch (err) { ctx.add({ rule: 'SK003', cat: 'coverage', sev: 'HIGH', file: path.relative(root, dir) || '.', line: 0, msg: `Could not list folder (${err.code || err.message})`, snippet: '' }); continue; }
    const rank = (n) => { const i = dir === root ? PRIORITY.indexOf(n) : -1; return i < 0 ? 99 : i; };
    list.sort((a, b) => rank(a.name) - rank(b.name) || (a.name < b.name ? -1 : 1));
    for (const e of list) {
      const abs = path.join(dir, e.name);
      const rel = path.relative(root, abs).split(path.sep).join('/');
      if (e.isSymbolicLink()) {
        let target = null;
        try { target = fs.realpathSync(abs); } catch { /* dangling */ }
        ctx.symlinks.push(rel);
        if (!target || !within(target, root)) ctx.add({ rule: 'SY001', cat: 'filesystem', sev: 'HIGH', file: rel, line: 0, msg: 'Symlink points outside the package (not followed)', snippet: target ? path.basename(target) : '(dangling)' });
      } else if (e.isDirectory()) {
        if (dir === root && e.name === '.git') { ctx.excluded.push({ file: '.git/', reason: 'git metadata of the package root (not package content)' }); continue; }
        if (e.name === 'node_modules') { ctx.vendored.push(rel); continue; }
        if (!within(root, FIXTURES) && fs.realpathSync(abs) === FIXTURES) { ctx.excluded.push({ file: rel + '/', reason: 'customs self-test fixtures (inert sample payloads)' }); continue; }
        queue.push(abs);
      } else if (e.isFile()) {
        if (entries.length >= MAX_FILES) { ctx.truncated = true; return entries; }
        entries.push({ abs, rel });
      }
    }
  }
  return entries;
}

function readPart(fd, pos, len) {
  const buf = Buffer.alloc(len);
  let got = 0;
  while (got < len) { const n = fs.readSync(fd, buf, got, len - got, pos + got); if (!n) break; got += n; }
  return buf.subarray(0, got);
}

// Which files do hooks, MCP config, skills, agents and commands point at? (over-approximate on purpose)
function wiredIndex(root, entries, ctx) {
  const suffixes = new Set();
  let budget = 64 * 1024 * 1024;
  for (const e of entries) {
    if (!REF_SOURCE.test(e.rel) || budget <= 0) continue;
    let text = '';
    try { const fd = fs.openSync(e.abs, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0)); try { const b = readPart(fd, 0, 300000); budget -= b.length; text = b.toString('utf8'); } finally { fs.closeSync(fd); } } catch { continue; }
    for (const tok of text.match(/[\w@.\/-]{2,300}/g) || []) {
      const parts = tok.replace(/^\.?\/+/, '').split('/');
      for (let k = 0; k < parts.length && k < 8; k++) suffixes.add(parts.slice(k).join('/'));
      if (/node_modules\//.test(tok)) ctx.nmReferenced = true;
    }
  }
  return (rel) => WIRED_DIR.test(rel) || suffixes.has(rel) || suffixes.has(path.posix.basename(rel));
}

function scanEntry(e, ctx, isWired) {
  const { abs, rel } = e;
  const ext = path.extname(rel).toLowerCase();
  const wired = isWired(rel);
  const rec = { rel, size: 0, kind: 'other', wired };
  ctx.files.push(rec);
  let fd;
  try {
    fd = fs.openSync(abs, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
    const st = fs.fstatSync(fd);
    if (!st.isFile()) throw Object.assign(new Error('not a regular file'), { code: 'ENOTREG' });
    rec.size = st.size;
    const big = st.size > MAX_BYTES;
    const head = big ? readPart(fd, 0, EDGE) : readPart(fd, 0, st.size);
    const tail = big ? readPart(fd, st.size - EDGE, EDGE) : null;
    const shebang = head.subarray(0, 2).toString('latin1') === '#!';
    const textual = SCRIPT_EXT.has(ext) || CONFIG_EXT.has(ext) || MD_EXT.has(ext) || shebang || (wired && !MEDIA_EXT.has(ext));
    const nul = head.subarray(0, 8000).includes(0) || (tail && tail.includes(0));
    if (nul && !textual) {
      rec.binary = true;
      const exe = OPAQUE_BIN.has(ext) || MAGIC.some((m) => m.every((b, i) => head[i] === b));
      if (exe) ctx.add({ rule: 'BN001', cat: 'coverage', sev: wired ? 'HIGH' : 'MEDIUM', file: rel, line: 0, msg: 'Opaque binary or bytecode: cannot be reviewed', snippet: '' });
      return;
    }
    if (nul) ctx.add({ rule: 'BN002', cat: 'obfuscation', sev: 'HIGH', file: rel, line: 0, msg: 'NUL byte in a text or script file (scanner evasion): scanned with the NULs removed', snippet: '' });
    const decode = (b) => b.toString('utf8').replace(/\0/g, '');
    const text = decode(head);
    const lines = text.split(SPLIT);
    rec.lines = lines.length;
    rec.kind = classify(rel, lines[0] || '', wired);
    if (big) {
      rec.oversize = true;
      const hot = rec.kind === 'script' || rec.kind === 'config' || wired;
      ctx.add({ rule: 'SK002', cat: 'coverage', sev: hot ? 'HIGH' : 'MEDIUM', file: rel, line: 0, msg: `TRUNCATED: file is ${(st.size / 1048576).toFixed(1)} MB, over the 2 MB limit: only the first and last 1 MB were scanned`, snippet: '' });
    }
    if (TESTFILE.test(rel) && rec.kind === 'script' && !wired) { rec.weighted = true; ctx.weighted.push({ file: rel, reason: 'test file that nothing wires up: findings capped at HIGH (still SECONDARY INSPECTION)' }); }
    if (rec.kind === 'agentmd' || rec.kind === 'config' || /\.claude-plugin\//.test(rel)) { if (st.size < 300000) rec.text = text; }
    if (MARKER.test((lines[0] || '').replace(/^\uFEFF/, ''))) {
      if (within(fs.realpathSync(abs), OWN_ROOT)) { ctx.excluded.push({ file: rel, reason: 'declares customs:rules-file inside the customs install (its rules must contain the patterns they detect)' }); rec.excluded = true; return; }
      ctx.add({ rule: 'MF006', cat: 'manifest', sev: 'MEDIUM', file: rel, line: 1, msg: 'Claims customs:rules-file exemption but is not part of the customs install: scanned normally', snippet: lines[0].slice(0, 80) });
    }
    analyze(rec, rel, text, lines, ctx, 0);
    if (tail) { const tl = decode(tail).split(SPLIT); tl.shift(); analyze(rec, rel, tl.join('\n'), tl, ctx, null); }
  } catch (err) {
    rec.unreadable = true;
    ctx.add({ rule: 'SK003', cat: 'coverage', sev: 'HIGH', file: rel, line: 0, msg: `Could not read or analyze file (${err.code || err.message}): not scanned`, snippet: '' });
  } finally { if (fd !== undefined) try { fs.closeSync(fd); } catch { /* ignore */ } }
}

module.exports = { enumerate, wiredIndex, scanEntry, classify, MAX_FILES, MAX_BYTES };
