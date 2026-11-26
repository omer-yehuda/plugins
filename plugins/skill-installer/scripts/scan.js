#!/usr/bin/env node
/*
 * Customs static scanner. Zero dependencies, no network, never executes anything it scans.
 *
 *   scan.js <dir> | --target-file FILE   [--json] [--manifest] [--store DIR]
 *
 *   --target-file FILE  first line of FILE is the folder to scan (how skills pass input: never through a shell)
 *   --json              machine output (stdout)        --manifest  inventory only, no verdict
 *   --store DIR         save the result as DIR/scans/<name>-<date>.json; the name is derived HERE from the manifest
 *                       with [a-z0-9-] only, and the matching report path is returned in "paths". (DIR ".customs"
 *                       gets a .gitignore of "*".)
 * Exit codes: 0 CLEARED, 1 SECONDARY INSPECTION, 2 DENIED, 3 usage or scanner error (verdict is then SECONDARY INSPECTION,
 * never CLEARED).
 *
 * Safety: files are only read as text, never followed through symlinks. Coverage gaps (truncated or unreadable files,
 * skipped binaries, a file-count or time cutoff) are findings that block CLEARED. Files that declare
 * "customs:rules-file" on line 1 are skipped ONLY inside this plugin's own install root, and always listed.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { makeCtx } = require('./ctx');
const { enumerate, wiredIndex, scanEntry, MAX_FILES } = require('./walk');
const { analyze: _a, snippet, maskSecrets } = require('./analyze');
const { build } = require('./inventory');
const { renderHuman, renderManifest } = require('./format');
const { safeName, ensureStore, writeNew, readTargetFile, targetFileArg } = require('./safe');

const note = (rule, cat, sev, msg, file = '.') => ({ rule, cat, sev, file, line: 0, msg, snippet: '' });

function scan(target, opts = {}) {
  const root = fs.realpathSync(target);
  if (!fs.statSync(root).isDirectory()) throw new Error('not a directory: ' + target);
  const ctx = makeCtx(root);
  const entries = enumerate(root, ctx);
  const isWired = wiredIndex(root, entries, ctx);
  for (const e of entries) {
    if (ctx.expired()) { ctx.timedOut = true; break; }
    scanEntry(e, ctx, isWired);
  }
  if (ctx.truncated) ctx.add(note('SK004', 'coverage', 'HIGH', `TRUNCATED: more than ${MAX_FILES} files, the rest were not scanned (security folders are scanned first)`));
  if (ctx.timedOut) ctx.add(note('SK005', 'coverage', 'HIGH', 'Scan time budget exceeded: the scan is incomplete'));
  for (const rel of ctx.vendored) ctx.add(note('SK001', 'coverage', ctx.nmReferenced ? 'HIGH' : 'MEDIUM', ctx.nmReferenced ? 'Vendored node_modules NOT scanned, and hooks, MCP or skill text point into it' : 'Vendored node_modules not scanned', rel));
  for (const s of opts.flagged || []) ctx.add({ rule: 'SY002', cat: 'filesystem', sev: 'HIGH', file: s.file, line: 0, msg: 'Symlink pointing outside the package was removed after the clone', snippet: String(s.target || '').slice(0, 100) });
  const { findings, suppressed } = ctx.result();
  const counts = ctx.counts; // every finding counts, whatever the display cap hides
  const verdict = counts.CRITICAL ? 'DENIED' : counts.HIGH ? 'SECONDARY INSPECTION' : 'CLEARED';
  const inventory = build(ctx.files);
  inventory.other.symlinks = ctx.symlinks;
  return { tool: 'customs', schema: 2, target: root, scannedAt: new Date().toISOString(), verdict, exitCode: counts.CRITICAL ? 2 : counts.HIGH ? 1 : 0,
    counts, files: { scanned: ctx.files.filter((f) => !f.binary && !f.excluded && !f.unreadable).length, total: ctx.files.length, binary: inventory.other.binary.length, oversize: inventory.other.oversize.length, symlinks: ctx.symlinks.length, truncated: ctx.truncated || ctx.timedOut },
    excluded: ctx.excluded, weighted: ctx.weighted.map((w) => w.file), suppressedFindings: suppressed, inventory, findings };
}

// scans/<name>-<day>.json and reports/<name>-<day>.md, named from the manifest with [a-z0-9-] only
function storePaths(result, store) {
  const m = result.inventory.manifest;
  const name = safeName(m && m.name, '') || safeName(path.basename(result.target));
  const day = new Date().toISOString().slice(0, 10);
  const abs = ensureStore(store, ['scans', 'reports']);
  return { scan: path.join(abs, 'scans', `${name}-${day}.json`), report: path.join(abs, 'reports', `${name}-${day}.md`) };
}

function failure(message, json) {
  const r = { tool: 'customs', schema: 2, verdict: 'SECONDARY INSPECTION', exitCode: 3, error: message };
  process.stderr.write(`customs: ${message}\n`);
  process.stdout.write(json ? JSON.stringify(r, null, 2) + '\n' : `CUSTOMS PASSPORT: SECONDARY INSPECTION [AMBER] (scanner error: ${message}). Not cleared.\n`);
  return 3;
}

function main(argv) {
  const json = argv.includes('--json');
  try {
    const si = argv.indexOf('--store');
    const store = si >= 0 ? argv[si + 1] : null;
    if (si >= 0 && (!store || store.startsWith('--'))) { process.stderr.write('usage: scan.js <dir> | --target-file FILE [--json] [--manifest] [--store DIR]\n'); return 3; }
    if (argv.includes('--out')) { process.stderr.write('customs: --out was removed, use --store DIR (the file name is derived by the scanner)\n'); return 3; }
    const tf = targetFileArg(argv);
    const skip = new Set([si >= 0 ? si + 1 : -1, tf ? argv.indexOf('--target-file') + 1 : -1]);
    const positional = argv.filter((a, i) => !a.startsWith('--') && !skip.has(i));
    const dir = tf ? readTargetFile(tf) : positional[0];
    if (!dir) { process.stderr.write('usage: scan.js <dir> | --target-file FILE [--json] [--manifest] [--store DIR]\n'); return 3; }
    let flagged = [];
    if (tf) { try { const f = JSON.parse(fs.readFileSync(path.join(path.dirname(tf), 'fetch-flags.json'), 'utf8')); if (f && fs.realpathSync(f.packageRoot) === fs.realpathSync(dir)) flagged = f.symlinks || []; } catch { /* no flags file */ } }
    const result = scan(dir, { flagged });
    const manifest = argv.includes('--manifest');
    if (store && !manifest) {
      result.paths = storePaths(result, store);
      writeNew(result.paths.scan, JSON.stringify(result, null, 2) + '\n');
    }
    if (manifest) process.stdout.write(json ? JSON.stringify({ target: result.target, inventory: result.inventory, files: result.files }, null, 2) + '\n' : renderManifest(result));
    else process.stdout.write(json ? JSON.stringify(result, null, 2) + '\n' : renderHuman(result));
    return manifest ? 0 : result.exitCode;
  } catch (err) { return failure(String(err && err.message || err), json); }
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));
module.exports = { scan, maskSecrets, snippet, classify: require('./walk').classify, storePaths };
