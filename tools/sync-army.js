#!/usr/bin/env node
// Generates everything derived from plugins/army/units.json and the shared standing orders:
//   - agent frontmatter (name, description, model = LEAN, effort, maxTurns, tools)
//   - the standing-orders block inside every agent
//   - the order-of-battle table in skills/raise/SKILL.md
//   - the order-of-battle table in plugins/army/README.md
// Usage: node tools/sync-army.js [--check]     (--check exits 1 if anything is out of date; used in CI)
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'plugins', 'army');
const check = process.argv.includes('--check');
const units = JSON.parse(fs.readFileSync(path.join(ROOT, 'units.json'), 'utf8')).units;
const orders = fs.readFileSync(path.join(ROOT, 'doctrine', 'shared', 'standing-orders.md'), 'utf8').trim();
const changed = [];
const problems = [];

function write(file, next) {
  const prev = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  if (prev !== next) { changed.push(path.relative(path.join(ROOT, '..', '..'), file)); if (!check) fs.writeFileSync(file, next); }
}
function replaceBlock(text, name, content, file) {
  const re = new RegExp(`<!-- BEGIN ${name} -->[\\s\\S]*?<!-- END ${name} -->`);
  if (!re.test(text)) { problems.push(`${file}: missing <!-- BEGIN ${name} --> block`); return text; }
  return text.replace(re, `<!-- BEGIN ${name} -->\n${content}\n<!-- END ${name} -->`);
}
function specialists(body) {
  const out = [];
  const re = /^- \*\*(.+?)\*\*: .+?Playbook: `/gm;
  let m;
  while ((m = re.exec(body))) out.push(m[1]);
  return out;
}

// 1. agents
const agentDir = path.join(ROOT, 'agents');
const bodies = {};
for (const u of units) {
  const file = path.join(agentDir, `${u.id}.md`);
  if (!fs.existsSync(file)) { problems.push(`agents/${u.id}.md is missing`); continue; }
  const text = fs.readFileSync(file, 'utf8');
  const body = text.replace(/^---\n[\s\S]*?\n---\n?/, '');
  const fm = ['---', `name: ${u.id}`, `description: ${JSON.stringify(u.description + " Dispatched by army HQ, or when the user names this unit.")}`, `model: ${u.lean}`];
  if (u.effort) fm.push(`effort: ${u.effort}`);
  if (u.maxTurns) fm.push(`maxTurns: ${u.maxTurns}`);
  if (u.tools) fm.push(`tools: ${u.tools.join(', ')}`);
  fm.push('---', '');
  let next = fm.join('\n') + body.replace(/^\n+/, '\n');
  if (/<!-- BEGIN STANDING ORDERS -->/.test(next)) next = replaceBlock(next, 'STANDING ORDERS', orders, `agents/${u.id}.md`);
  bodies[u.id] = next;
  write(file, next);
}
for (const f of fs.readdirSync(agentDir)) {
  if (f.endsWith('.md') && !units.some((u) => `${u.id}.md` === f)) problems.push(`agents/${f} has no entry in units.json`);
}

// 2. raise skill table
const raiseFile = path.join(ROOT, 'skills', 'raise', 'SKILL.md');
const raiseRows = ['| Unit (subagent) | Use for | full | lean | eco |', '|---|---|---|---|---|',
  ...units.map((u) => `| \`army:${u.id}\` | ${u.use} | ${u.full} | ${u.lean} | ${u.eco || u.lean} |`)].join('\n');
write(raiseFile, replaceBlock(fs.readFileSync(raiseFile, 'utf8'), 'ORDER OF BATTLE', raiseRows, 'skills/raise/SKILL.md'));

// 3. README table
const readmeFile = path.join(ROOT, 'README.md');
const total = Object.values(bodies).reduce((n, b) => n + specialists(b).length, 0);
const readmeRows = [`**${units.length} units, ${total} specialist playbooks.** Generated from \`units.json\`.`, '',
  '| Unit | Callsign | Specialists | Tools | full | lean | eco |', '|---|---|---|---|---|---|---|',
  ...units.map((u) => {
    const s = specialists(bodies[u.id] || '');
    return `| \`${u.id}\` | ${u.callsign} | ${s.length ? s.join(', ') : u.use} | ${u.tools ? 'scoped' : 'all'} | ${u.full} | ${u.lean} | ${u.eco || u.lean} |`;
  })].join('\n');
write(readmeFile, replaceBlock(fs.readFileSync(readmeFile, 'utf8'), 'ORDER OF BATTLE', readmeRows, 'README.md'));

if (problems.length) { console.error(problems.map((p) => 'error: ' + p).join('\n')); process.exit(1); }
if (changed.length) console.log(`${check ? 'out of date' : 'updated'}:\n  ${changed.join('\n  ')}`);
if (check && changed.length) { console.error('Run: node tools/sync-army.js'); process.exit(1); }
console.log(check ? 'army files in sync with units.json' : 'done');
