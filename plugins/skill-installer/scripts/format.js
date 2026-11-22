'use strict';
/* Human-readable output for scan.js (passport card, findings table, manifest). */
const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code, s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
const VERDICT = { CLEARED: ['32', 'GREEN'], 'SECONDARY INSPECTION': ['33', 'AMBER'], DENIED: ['31', 'RED'] };
const SEV = { CRITICAL: '31;1', HIGH: '31', MEDIUM: '33', LOW: '90' };
const rule = '-'.repeat(64);

function goods(inv) {
  const m = inv.manifest;
  const rows = [
    ['Package', m ? `${m.name || '?'} ${m.version || ''}`.trim() : '(no plugin.json)'],
    ['Skills', inv.skills.map((s) => s.name).join(', ') || 'none'],
    ['Agents', inv.agents.map((a) => `${a.name} (${a.model})`).join(', ') || 'none'],
    ['Commands', inv.commands.map((c) => c.name).join(', ') || 'none'],
    ['Hooks', inv.hooks.map((h) => `${h.event}[${h.matcher}]`).join(', ') || 'none'],
    ['Scripts', inv.scripts.length ? `${inv.scripts.length} (${inv.scripts.slice(0, 4).map((s) => s.file).join(', ')}${inv.scripts.length > 4 ? ', ...' : ''})` : 'none'],
    ['MCP servers', inv.mcpServers.map((s) => `${s.name}: ${s.launch}`).join('; ') || 'none'],
    ['Permissions', inv.permissions.length ? inv.permissions.join('; ') : 'none declared'],
  ];
  return rows.map(([k, v]) => `  ${k.padEnd(12)} ${v}`).join('\n');
}

function renderHuman(r) {
  const [color, tag] = VERDICT[r.verdict];
  const c = r.counts;
  const out = [];
  out.push(rule, paint(color + ';1', `  CUSTOMS PASSPORT: ${r.verdict} [${tag}]`), rule);
  out.push(`  Target   ${r.target}`);
  out.push(`  Files    ${r.files.scanned} scanned of ${r.files.total}` + (r.files.binary ? `, ${r.files.binary} binary` : '') + (r.files.oversize ? `, ${r.files.oversize} oversize` : '') + (r.files.symlinks ? `, ${r.files.symlinks} symlinks (not followed)` : ''));
  out.push(`  Findings CRITICAL ${c.CRITICAL}  HIGH ${c.HIGH}  MEDIUM ${c.MEDIUM}  LOW ${c.LOW}`, '', '  DECLARED GOODS', goods(r.inventory), '');
  if (r.excluded.length) { out.push('  EXCLUDED (transparency)'); r.excluded.forEach((e) => out.push(`  - ${e.file}: ${e.reason}`)); out.push(''); }
  if (r.weighted && r.weighted.length) { out.push(`  WEIGHTED DOWN: ${r.weighted.length} unwired test file(s) capped at HIGH (${r.weighted.slice(0, 3).join(', ')}${r.weighted.length > 3 ? ', ...' : ''})`, ''); }
  if (!r.findings.length) out.push('  No findings.');
  else {
    out.push('  FINDINGS (top 25)');
    r.findings.slice(0, 25).forEach((f) => out.push(`  ${paint(SEV[f.sev], f.sev.padEnd(8))} ${f.rule}  ${f.file}${f.line ? ':' + f.line : ''}\n           ${f.msg}${f.snippet ? '\n           > ' + f.snippet : ''}`));
    if (r.findings.length > 25) out.push(`  ... and ${r.findings.length - 25} more (use --json for all)`);
  }
  if (r.suppressedFindings) out.push(`  (${r.suppressedFindings} repeated findings not listed; they ARE counted in the totals and the verdict)`);
  if (r.files.truncated) out.push('  COVERAGE GAP: the scan is incomplete (see TRUNCATED / SK0xx findings). It can never be CLEARED.');
  if (r.paths) out.push(`  Saved    scan ${r.paths.scan}`, `  Report   ${r.paths.report}`);
  out.push('', '  Static analysis is a first filter, not a guarantee.', rule);
  return out.join('\n') + '\n';
}

function renderManifest(r) {
  const i = r.inventory;
  const out = [rule, '  CUSTOMS MANIFEST (inventory only, no verdict)', rule, goods(i), ''];
  if (i.skills.length) { out.push('  Skills'); i.skills.forEach((s) => out.push(`  - ${s.name}: ${s.description}`)); }
  if (i.agents.length) { out.push('  Agents'); i.agents.forEach((a) => out.push(`  - ${a.name} [${a.model}] tools: ${a.tools.join(', ')}`)); }
  if (i.hooks.length) { out.push('  Hooks'); i.hooks.forEach((h) => out.push(`  - ${h.event} matcher ${h.matcher}: ${h.command}`)); }
  if (i.other.binary.length) out.push(`  Binary files: ${i.other.binary.join(', ')}`);
  if (i.other.oversize.length) out.push(`  Oversize files (not read): ${i.other.oversize.join(', ')}`);
  out.push(rule);
  return out.join('\n') + '\n';
}

module.exports = { renderHuman, renderManifest };
