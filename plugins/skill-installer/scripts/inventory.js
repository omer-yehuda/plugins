'use strict';
/* Builds the "declared goods" list: what a package says it contains. No verdicts here. */
const path = require('path');
const { collectHooks, tryJson } = require('./checks');

function frontmatter(text) {
  const lines = text.split(/\r?\n/);
  const out = {};
  if (lines[0] !== '---') return out;
  const end = lines.indexOf('---', 1);
  if (end < 0) return out;
  for (const l of lines.slice(1, end)) {
    const m = l.match(/^([A-Za-z][\w-]*)\s*:\s*(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
  }
  return out;
}

const list = (v) => (v ? v.replace(/^\[|\]$/g, '').split(',').map((s) => s.trim()).filter(Boolean) : []);
const short = (s, n = 110) => (s && s.length > n ? s.slice(0, n - 1) + '…' : s || '');

function build(files) {
  const inv = { manifest: null, skills: [], agents: [], commands: [], hooks: [], mcpServers: [], scripts: [], permissions: [], other: { binary: [], oversize: [], symlinks: [] } };
  const perms = new Set();
  for (const r of files) {
    const base = path.posix.basename(r.rel);
    if (r.binary) inv.other.binary.push(r.rel);
    if (r.oversize) inv.other.oversize.push(r.rel);
    if (r.kind === 'script') inv.scripts.push({ file: r.rel, bytes: r.size, lines: r.lines });
    if (/^SKILL\.md$/i.test(base) && r.text) {
      const fm = frontmatter(r.text);
      inv.skills.push({ name: fm.name || path.posix.basename(path.posix.dirname(r.rel)), description: short(fm.description), file: r.rel, allowedTools: list(fm['allowed-tools']) });
      list(fm['allowed-tools']).forEach((t) => perms.add(`skill allowed-tools: ${t}`));
    } else if (/(^|\/)agents\/[^/]+\.md$/.test(r.rel) && r.text) {
      const fm = frontmatter(r.text);
      const tools = list(fm.tools);
      inv.agents.push({ name: fm.name || base.replace(/\.md$/, ''), model: fm.model || '(inherit)', tools: tools.length ? tools : ['(all tools)'], file: r.rel });
      (tools.length ? tools : ['(all tools)']).forEach((t) => perms.add(`agent tool: ${t}`));
    } else if (/(^|\/)commands\/[^/]+\.md$/.test(r.rel)) inv.commands.push({ name: base.replace(/\.md$/, ''), file: r.rel });
    if (r.kind === 'config' && r.text) {
      const obj = tryJson(r.text);
      if (!obj) continue;
      if (base === 'plugin.json' && !inv.manifest) inv.manifest = { file: r.rel, name: obj.name, version: obj.version, license: obj.license || null, repository: typeof obj.repository === 'object' ? obj.repository.url : obj.repository || null, author: obj.author && (obj.author.name || obj.author) };
      for (const h of collectHooks(obj)) inv.hooks.push({ file: r.rel, event: h.event, matcher: h.matcher || '(all)', type: h.type, command: short(h.command, 140) });
      const servers = base === '.mcp.json' || base === 'mcp.json' || obj.mcpServers ? (obj.mcpServers || obj) : null;
      if (servers && typeof servers === 'object') for (const [name, s] of Object.entries(servers)) {
        if (s && typeof s === 'object' && (s.command || s.url)) inv.mcpServers.push({ file: r.rel, name, launch: s.url ? `remote ${s.url}` : [s.command, ...(s.args || [])].join(' ') });
      }
      if (obj.permissions && Array.isArray(obj.permissions.allow)) obj.permissions.allow.forEach((p) => perms.add(`settings allow: ${p}`));
    }
  }
  inv.permissions = [...perms].sort();
  return inv;
}

module.exports = { build, frontmatter };
