#!/usr/bin/env node
'use strict';
/*
 * Token budget for every plugin in this marketplace. Zero dependencies.
 *
 * What a plugin costs in context:
 *   - ALWAYS (every session it is installed in): the description of each skill the model can invoke, and of each agent.
 *   - ON USE: a skill's body when it runs, an agent's body when it is dispatched.
 * Skills with `disable-model-invocation: true` cost nothing until the user types them.
 *
 * Usage: node tools/token-budget.js            report
 *        node tools/token-budget.js --check    exit 1 when a budget below is exceeded (CI)
 *        node tools/token-budget.js --json     machine-readable report
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'plugins');
const BUDGET = { pluginAlways: 3000, description: 520, body: 12000 }; // characters; about 4 characters per token
const tok = (chars) => Math.round(chars / 4);

function frontmatter(text) {
  const m = /^---\n([\s\S]*?)\n---/.exec(text);
  if (!m) return null;
  const get = (k) => { const r = new RegExp(`^${k}:\\s*(.*)$`, 'm').exec(m[1]); return r ? r[1].trim().replace(/^"(.*)"$/, '$1') : ''; };
  return { description: get('description'), hidden: get('disable-model-invocation') === 'true', body: text.length - m[0].length };
}

function scan(plugin) {
  const dir = path.join(ROOT, plugin); const items = [];
  const skills = path.join(dir, 'skills');
  if (fs.existsSync(skills)) for (const s of fs.readdirSync(skills)) {
    const f = path.join(skills, s, 'SKILL.md');
    if (fs.existsSync(f)) { const fm = frontmatter(fs.readFileSync(f, 'utf8')); if (fm) items.push({ kind: 'skill', name: s, ...fm }); }
  }
  const agents = path.join(dir, 'agents');
  if (fs.existsSync(agents)) for (const a of fs.readdirSync(agents).filter((x) => x.endsWith('.md'))) {
    const fm = frontmatter(fs.readFileSync(path.join(agents, a), 'utf8'));
    if (fm) items.push({ kind: 'agent', name: a.replace(/\.md$/, ''), ...fm, hidden: false });
  }
  const always = items.filter((i) => !i.hidden).reduce((n, i) => n + i.description.length, 0);
  // A visible skill that says it runs only on request. Hiding it saves tokens but also drops its spoken trigger phrase.
  const hideable = items.filter((i) => i.kind === 'skill' && !i.hidden && /use only when the user (runs|types)|runs only when you type/i.test(i.description));
  return { plugin, items, always, hideable };
}

function main(argv) {
  const rows = fs.readdirSync(ROOT).filter((p) => fs.existsSync(path.join(ROOT, p, '.claude-plugin', 'plugin.json'))).sort().map(scan);
  const problems = [];
  for (const r of rows) {
    if (r.always > BUDGET.pluginAlways) problems.push(`${r.plugin}: ${r.always} always-loaded characters (budget ${BUDGET.pluginAlways})`);
    for (const i of r.items) {
      if (!i.hidden && i.description.length > BUDGET.description) problems.push(`${r.plugin}/${i.kind}s/${i.name}: description ${i.description.length} characters (budget ${BUDGET.description})`);
      if (i.body > BUDGET.body) problems.push(`${r.plugin}/${i.kind}s/${i.name}: body ${i.body} characters (budget ${BUDGET.body})`);
    }
  }
  if (argv.includes('--json')) { process.stdout.write(JSON.stringify({ budget: BUDGET, plugins: rows.map(({ items, hideable, ...r }) => ({ ...r, hideable: hideable.map((h) => h.name) })), problems }, null, 2) + '\n'); return problems.length && argv.includes('--check') ? 1 : 0; }
  const total = rows.reduce((n, r) => n + r.always, 0);
  const out = ['Always-loaded context per plugin (skill + agent descriptions; hidden skills cost nothing until typed)', '',
    'plugin             always   ~tokens  visible  hidden  agents  could hide'];
  for (const r of rows) {
    const c = (k, h) => r.items.filter((i) => i.kind === k && (h === undefined || i.hidden === h)).length;
    out.push(`${r.plugin.padEnd(18)} ${String(r.always).padStart(6)}  ${String(tok(r.always)).padStart(7)}  ${String(c('skill', false)).padStart(7)}  ${String(c('skill', true)).padStart(6)}  ${String(c('agent')).padStart(6)}  ${r.hideable.map((h) => h.name).join(', ')}`);
  }
  out.push('', `All ${rows.length} plugins installed: ${total} characters, about ${tok(total)} tokens in every session.`);
  const save = rows.flatMap((r) => r.hideable.map((h) => h.description.length)).reduce((a, b) => a + b, 0);
  if (save) out.push(`Hiding the "could hide" skills (disable-model-invocation: true) would save about ${tok(save)} more tokens per session, but they would then run only when typed as /commands, not on spoken phrases.`);
  out.push('', problems.length ? `Over budget:\n  ${problems.join('\n  ')}` : 'All plugins are within budget.');
  process.stdout.write(out.join('\n') + '\n');
  return problems.length && argv.includes('--check') ? 1 : 0;
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));
module.exports = { scan, frontmatter, BUDGET };
