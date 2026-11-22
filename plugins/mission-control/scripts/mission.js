#!/usr/bin/env node
/*
 * Mission Control helper. Zero dependencies (Node 18+), no network.
 *
 *   mission.js prep [--project DIR]                 make a fresh temp folder, print {"input": "<tmp>/input.json"}
 *   mission.js open --input-file F [--project DIR]  F is that prep path, JSON {"title": "...", "since": "<ref or empty>"}
 *                                                   opens a countdown, writes facts.json, prints the file paths
 *   mission.js facts [--since REF] [--project DIR]  print the release facts without opening a countdown
 *   mission.js list [--project DIR]                 list countdowns and their rulings
 *   mission.js path <id> [--project DIR]            print a countdown folder
 *
 * It only reads the repository. It never tags, pushes, deploys or edits anything outside .mission/.
 * The telemetry "floor" is the best ruling the facts allow: the flight director may rule lower, never higher.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const inputfile = require('./inputfile');
const { make, readField, parseArgs } = require('./state');
const gf = require('./gitfacts');

const store = make('.mission', 'countdowns', 'planted-mission');
const STATIONS = ['flight', 'payload', 'range-safety', 'recovery'];
const RULINGS = ['GO', 'HOLD', 'NO-GO'];

function findings(project, facts) {
  const out = [];
  const add = (level, code, message, files) => out.push({ level, code, message, files: files || [] });
  const units = gf.findUnits(project);
  const readme = gf.readmeVersions(project);
  for (const u of units) {
    if (u.changelogVersion && u.changelogVersion !== u.version) {
      add('no-go', 'version-mismatch', `${u.name}: ${u.manifest} says ${u.version} but ${u.changelog} starts at ${u.changelogVersion}`, [u.manifest, u.changelog]);
    }
    if (readme[u.name] && readme[u.name] !== u.version) {
      add('no-go', 'readme-version-mismatch', `${u.name}: ${u.manifest} says ${u.version} but README.md lists ${readme[u.name]}`, [u.manifest, 'README.md']);
    }
    if (u.dir === '.') continue;
    const touched = facts.changedFiles.filter((f) => gf.inUnit(u, f));
    if (touched.length && !touched.includes(u.changelog)) {
      add('hold', 'changed-without-changelog', `${u.name}: ${touched.length} file(s) changed but ${u.changelog} did not`, touched.slice(0, 5));
    }
  }
  if (facts.dirty.length) add('hold', 'dirty-tree', `${facts.dirty.length} uncommitted change(s) in the working tree`, facts.dirty.slice(0, 5));
  if (facts.baseKind === 'none') add('hold', 'no-base', 'no tag found, so the release range is a guess (last 50 commits). Pass a since ref.');
  if (!facts.commits.length) add('hold', 'nothing-to-launch', 'no commits in the release range');
  const floor = out.some((f) => f.level === 'no-go') ? 'NO-GO' : out.some((f) => f.level === 'hold') ? 'HOLD' : 'GO';
  return { units, findings: out, floor };
}

function facts(project, since) {
  const f = gf.collect(project, since);
  return f.ok ? { ...f, ...findings(project, f) } : f;
}

function open(project, title, since) {
  const f = facts(project, since);
  if (!f.ok) return f;
  const made = store.create(project, title || `launch-${f.head}`);
  if (!made.ok) return made;
  const file = (n) => path.join(made.dir, n);
  fs.writeFileSync(file('facts.json'), JSON.stringify(f, null, 2) + '\n');
  return {
    ok: true, id: made.id, dir: made.dir, floor: f.floor, findings: f.findings.length,
    files: { facts: file('facts.json'), ruling: file('ruling.md'), stations: Object.fromEntries(STATIONS.map((s) => [s, file(`station-${s}.md`)])) },
  };
}

// ruling.md starts with "Ruling: GO | HOLD | NO-GO"; anything else counts as no ruling.
function readRuling(dir) {
  const r = (readField(path.join(dir, 'ruling.md'), 'Ruling') || '').toUpperCase();
  return RULINGS.includes(r) ? r : null;
}

function list(project) {
  return store.listIds(project).map((id) => {
    const dir = path.join(store.items(project), id);
    const ruling = readRuling(dir);
    let floor = null;
    try { floor = JSON.parse(fs.readFileSync(path.join(dir, 'facts.json'), 'utf8')).floor; } catch { /* no facts */ }
    return { id, status: ruling ? 'ruled' : 'open', ruling, floor, dir };
  });
}

function readInput(file) {
  const r = inputfile.readPrepFile(file);
  if (!r.ok) return { error: r.message };
  let j;
  try { j = JSON.parse(r.text); } catch { return { error: 'input file is not valid JSON' }; }
  if (!j || typeof j !== 'object') return { error: 'input file is not valid JSON' };
  r.done();
  return { title: String(j.title || ''), since: j.since ? String(j.since) : '' };
}

function main(argv) {
  const { _, flags } = parseArgs(argv, ['project', 'input-file', 'since']);
  const project = path.resolve(flags.project || process.cwd());
  const [cmd, arg] = _;
  let res;
  if (cmd === 'prep') res = store.planted(project) || inputfile.prep('input.json');
  else if (cmd === 'open') {
    const inp = readInput(flags['input-file']);
    res = inp.error ? { ok: false, error: 'bad-input', message: inp.error } : open(project, inp.title, inp.since);
  } else if (cmd === 'facts') res = facts(project, typeof flags.since === 'string' ? flags.since : '');
  else if (cmd === 'list') res = store.planted(project) || { ok: true, countdowns: list(project) };
  else if (cmd === 'path') res = store.planted(project) || store.pathOf(project, arg);
  else { process.stderr.write('usage: mission.js prep | open --input-file F | facts [--since REF] | list | path <id>\n'); return 2; }
  process.stdout.write(JSON.stringify(res, null, 2) + '\n');
  return res.ok ? 0 : 1;
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));
module.exports = { facts, findings, open, list, readRuling, STATIONS };
