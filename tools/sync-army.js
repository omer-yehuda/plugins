#!/usr/bin/env node
// Generates everything derived from plugins/army/units.json and the shared standing orders:
//   - agent frontmatter (name, description, model = LEAN, effort, maxTurns, tools)
//   - the standing-orders block inside every agent
//   - the order-of-battle table in skills/raise/SKILL.md
//   - the order-of-battle table in plugins/army/README.md
//   - the drills table (plugins that joined the army) in the README
// Usage: node tools/sync-army.js [--check]     (--check exits 1 if anything is out of date; used in CI)
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'plugins', 'army');
const check = process.argv.includes('--check');
const spec = JSON.parse(fs.readFileSync(path.join(ROOT, 'units.json'), 'utf8'));
const units = spec.units;
const drills = spec.drills || [];
const drillAgents = new Set(drills.flatMap((d) => d.agents));
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
  const fm = ['---', `name: ${u.id}`, `description: ${JSON.stringify(u.description + " Dispatched by army HQ.")}`, `model: ${u.lean}`];
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
  if (f.endsWith('.md') && !units.some((u) => `${u.id}.md` === f) && !drillAgents.has(f.slice(0, -3))) problems.push(`agents/${f} has no entry in units.json`);
}
for (const a of drillAgents) if (!fs.existsSync(path.join(agentDir, `${a}.md`))) problems.push(`agents/${a}.md (a drill agent) is missing`);
for (const d of drills) for (const s of d.skills) if (!fs.existsSync(path.join(ROOT, 'skills', s, 'SKILL.md'))) problems.push(`skills/${s}/SKILL.md (drill ${d.id}) is missing`);

// 2. raise skill table
const raiseFile = path.join(ROOT, 'skills', 'raise', 'SKILL.md');
// The raise skill lists what each unit is for; HQ routes only by the `models` map that `start` prints, so no model columns here.
const raiseRows = ['| Unit (subagent) | Use for |', '|---|---|',
  ...units.map((u) => `| \`army:${u.id}\` | ${u.use} |`)].join('\n');
write(raiseFile, replaceBlock(fs.readFileSync(raiseFile, 'utf8'), 'ORDER OF BATTLE', raiseRows, 'skills/raise/SKILL.md'));

// 2b. drills table (raise skill and README)
const drillRows = ['| Drill | Run | Unit it extends | Use for | Formerly |', '|---|---|---|---|---|',
  ...drills.map((d) => `| ${d.id} | ${d.skills.map((s) => `\`/army:${s}\``).join(' ')} | ${d.unit} | ${d.use} | ${d.from} |`)].join('\n');

// 3. README table
const readmeFile = path.join(ROOT, 'README.md');
const total = Object.values(bodies).reduce((n, b) => n + specialists(b).length, 0);
const readmeRows = [`**${units.length} units, ${total} specialist playbooks.** Generated from \`units.json\`.`, '',
  '| Unit | Callsign | Specialists | Tools | full | lean | eco |', '|---|---|---|---|---|---|---|',
  ...units.map((u) => {
    const s = specialists(bodies[u.id] || '');
    return `| \`${u.id}\` | ${u.callsign} | ${s.length ? s.join(', ') : u.use} | ${u.tools ? 'scoped' : 'all'} | ${u.full} | ${u.lean} | ${u.eco || u.lean} |`;
  })].join('\n');
write(readmeFile, replaceBlock(replaceBlock(fs.readFileSync(readmeFile, 'utf8'), 'ORDER OF BATTLE', readmeRows, 'README.md'), 'DRILLS', drillRows, 'README.md'));

if (problems.length) { console.error(problems.map((p) => 'error: ' + p).join('\n')); process.exit(1); }
if (changed.length) console.log(`${check ? 'out of date' : 'updated'}:\n  ${changed.join('\n  ')}`);
if (check && changed.length) { console.error('Run: node tools/sync-army.js'); process.exit(1); }
console.log(check ? 'army files in sync with units.json' : 'done');
