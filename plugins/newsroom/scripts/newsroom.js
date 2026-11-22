#!/usr/bin/env node
/*
 * The Newsroom helper. Zero dependencies (Node 18+), no network.
 *
 *   newsroom.js prep [--project DIR]                 make a fresh temp folder, print {"input": "<tmp>/input.json"}
 *   newsroom.js open --input-file F [--project DIR]  F is that prep path, JSON {"title": "...", "since": "<ref or empty>", "unit": "<name or empty>"}
 *                                                    opens an edition, writes facts.json, prints the file paths
 *   newsroom.js facts [--since REF] [--project DIR]  print the release facts without opening an edition
 *   newsroom.js check <id> [--project DIR]           check the drafts: cited commits exist, lengths fit, metadata parses
 *   newsroom.js list [--project DIR]
 *
 * It only reads the repository and writes inside .newsroom/. It never posts, publishes, tags or pushes.
 * Citation format in drafts: the short commit hash in parentheses, for example (a1b2c3d).
 */
'use strict';

const fs = require('fs');
const path = require('path');
const inputfile = require('./inputfile');
const { make, isLink, parseArgs } = require('./state');
const gf = require('./gitfacts');

const store = make('.newsroom', 'editions', 'planted-newsroom');
const FILES = { wire: 'wire.md', notes: 'release-notes.md', changelog: 'changelog-draft.md', posts: 'posts.md', youtube: 'youtube-meta.json', brief: 'studio-brief.md', sources: 'sources.md', corrections: 'corrections.md' };
const X_LIMIT = 280;
const fail = (error, message) => ({ ok: false, error, message });

function topEntry(project, rel) {
  try {
    const f = path.join(project, rel);
    if (isLink(f)) return null;
    const m = /^##\s+.*$[\s\S]*?(?=^##\s)/m.exec(fs.readFileSync(f, 'utf8') + '\n## ');
    return m ? m[0].trim().slice(0, 2000) : null;
  } catch { return null; }
}

function facts(project, since, only) {
  const f = gf.collect(project, since);
  if (!f.ok) return f;
  const units = gf.findUnits(project).filter((u) => u.dir !== '.');
  const claimed = new Set();
  let desks = units.map((u) => {
    const commits = f.commits.filter((c) => c.files.some((x) => gf.inUnit(u, x)));
    f.changedFiles.filter((x) => gf.inUnit(u, x)).forEach((x) => claimed.add(x));
    const from = gf.versionAt(project, f.base, u.manifest);
    return { unit: u.name, dir: u.dir, from, to: u.version, bumped: !!from && from !== u.version, isNew: !!f.base && !from,
      commits: commits.map((c) => c.hash), changelogTop: commits.length ? topEntry(project, u.changelog) : null };
  }).filter((d) => d.commits.length);
  const rest = f.changedFiles.filter((x) => !claimed.has(x));
  if (rest.length) desks.push({ unit: 'project', dir: '.', from: null, to: null, bumped: false, isNew: false, commits: f.commits.filter((c) => c.files.some((x) => rest.includes(x))).map((c) => c.hash), changelogTop: null });
  if (only) {
    desks = desks.filter((d) => d.unit === only);
    if (!desks.length) return fail('no-such-unit', 'nothing changed in that unit in this range (or it does not exist)');
  }
  return { ...f, desks, quiet: f.commits.length === 0 };
}

function open(project, title, since, only) {
  const f = facts(project, since, only);
  if (!f.ok) return f;
  if (f.quiet) return fail('nothing-to-report', 'no commits in the range, so there is no edition to write');
  const made = store.create(project, title || `edition-${f.head}`);
  if (!made.ok) return made;
  fs.writeFileSync(path.join(made.dir, 'facts.json'), JSON.stringify(f, null, 2) + '\n');
  return { ok: true, id: made.id, dir: made.dir, base: f.base, baseKind: f.baseKind, commits: f.commits.length, desks: f.desks.map((d) => d.unit),
    files: { facts: path.join(made.dir, 'facts.json'), ...Object.fromEntries(Object.entries(FILES).map(([k, v]) => [k, path.join(made.dir, v)])) } };
}

const readIf = (f) => { try { return isLink(f) ? null : fs.readFileSync(f, 'utf8'); } catch { return null; } };
const cited = (text) => [...String(text).matchAll(/\(([0-9a-f]{7,40})\)/g)].map((m) => m[1]);

function checkMeta(text, errors) {
  let j;
  try { j = JSON.parse(text); } catch { return errors.push('youtube-meta.json is not valid JSON'); }
  for (const [key, v] of Object.entries(j || {})) {
    if (!v || typeof v !== 'object' || typeof v.title !== 'string') continue; // strings such as pinned_comment
    if (v.title.length > 100) errors.push(`youtube-meta.json ${key}: title is ${v.title.length} characters (limit 100)`);
    if (String(v.description || '').length > 5000) errors.push(`youtube-meta.json ${key}: description is over 5000 characters`);
    if (/[<>]/.test(v.title + String(v.description || ''))) errors.push(`youtube-meta.json ${key}: angle brackets are not allowed in titles or descriptions`);
    if (v.tags !== undefined && (!Array.isArray(v.tags) || v.tags.join(',').length > 500)) errors.push(`youtube-meta.json ${key}: tags must be a list under 500 characters in total`);
  }
}

function check(project, id) {
  const p = store.planted(project) || store.pathOf(project, id);
  if (!p.ok) return p;
  let f;
  try { f = JSON.parse(readIf(path.join(p.dir, 'facts.json'))); } catch { return fail('no-facts', 'this edition has no facts.json'); }
  const hashes = (f.commits || []).map((c) => c.hash);
  const known = (h) => hashes.some((x) => x.startsWith(h) || h.startsWith(x));
  const errors = []; const warnings = []; const present = {};
  for (const [k, name] of Object.entries(FILES)) present[k] = readIf(path.join(p.dir, name)) !== null;
  for (const k of ['notes', 'changelog']) {
    const text = readIf(path.join(p.dir, FILES[k]));
    if (text === null) continue;
    const unknown = [...new Set(cited(text).filter((h) => !known(h)))];
    if (unknown.length) errors.push(`${FILES[k]} cites commit(s) that are not in this release: ${unknown.join(', ')}`);
    const bare = text.split('\n').filter((l) => /^\s*[-*]\s+\S/.test(l) && !cited(l).length);
    if (bare.length) errors.push(`${FILES[k]} has ${bare.length} claim(s) with no commit behind them, first: "${bare[0].trim().slice(0, 80)}"`);
  }
  if (!present.notes) errors.push('release-notes.md is missing');
  if (!present.sources) warnings.push('sources.md is missing');
  const posts = readIf(path.join(p.dir, FILES.posts));
  if (posts !== null) {
    const x = /^##\s+X\b[^\n]*\n([\s\S]*?)(?=^##\s|$(?![\s\S]))/m.exec(posts);
    const long = x ? x[1].split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean).filter((s) => s.length > X_LIMIT) : [];
    if (long.length) errors.push(`posts.md has ${long.length} X post(s) over ${X_LIMIT} characters`);
  }
  const meta = readIf(path.join(p.dir, FILES.youtube));
  if (meta !== null) checkMeta(meta, errors);
  const corr = readIf(path.join(p.dir, FILES.corrections));
  const open = corr === null ? null : (corr.match(/^\s*[-*]\s+\[ \]/gm) || []).length;
  if (open) warnings.push(`${open} correction(s) from the fact-checker are still open`);
  return { ok: errors.length === 0, id, errors, warnings, present, openCorrections: open };
}

function list(project) {
  return store.listIds(project).map((id) => {
    const dir = path.join(store.items(project), id);
    return { id, status: fs.existsSync(path.join(dir, FILES.notes)) ? 'written' : 'open', dir };
  });
}

function readInput(file) {
  const r = inputfile.readPrepFile(file);
  if (!r.ok) return { error: r.message };
  let j;
  try { j = JSON.parse(r.text); } catch { return { error: 'input file is not valid JSON' }; }
  if (!j || typeof j !== 'object') return { error: 'input file is not valid JSON' };
  r.done();
  return { title: String(j.title || ''), since: j.since ? String(j.since) : '', unit: j.unit ? String(j.unit) : '' };
}

function main(argv) {
  const { _, flags } = parseArgs(argv, ['project', 'input-file', 'since']);
  const project = path.resolve(flags.project || process.cwd());
  const [cmd, arg] = _;
  let res;
  if (cmd === 'prep') res = store.planted(project) || inputfile.prep('input.json');
  else if (cmd === 'open') {
    const inp = readInput(flags['input-file']);
    res = inp.error ? fail('bad-input', inp.error) : open(project, inp.title, inp.since, inp.unit);
  } else if (cmd === 'facts') res = facts(project, typeof flags.since === 'string' ? flags.since : '', '');
  else if (cmd === 'check') res = check(project, arg);
  else if (cmd === 'list') res = store.planted(project) || { ok: true, editions: list(project) };
  else { process.stderr.write('usage: newsroom.js prep | open --input-file F | facts [--since REF] | check <id> | list\n'); return 2; }
  process.stdout.write(JSON.stringify(res, null, 2) + '\n');
  return res.ok ? 0 : 1;
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));
module.exports = { facts, open, check, list, FILES };
