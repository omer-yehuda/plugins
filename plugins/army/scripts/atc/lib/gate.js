'use strict';
/* PreToolUse gate: pure decision function plus a best-effort heartbeat. Never throws to the caller. */
const path = require('path');
const store = require('./store');
const { matchesAny } = require('./glob');

const FILE_TOOLS = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit']);

function targetPath(input) {
  const ti = input.tool_input || {};
  const p = ti.file_path || ti.notebook_path || ti.path;
  return typeof p === 'string' && p ? p : null;
}

function relativeTo(base, abs) {
  const rel = path.relative(base, abs);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return null;
  return rel.split(path.sep).join('/');
}

function heartbeat(root, session) {
  const data = store.readAirspace(root);
  const now = Date.now();
  const mine = Object.entries(data.flights).filter(([id, f]) => store.ownedBy(id, f, session));
  if (!mine.some(([, f]) => now - (Number(f.heartbeat) || 0) > store.HEARTBEAT_MS)) return;
  store.update(root, (d) => {
    for (const [id, f] of Object.entries(d.flights)) if (store.ownedBy(id, f, session)) f.heartbeat = now;
  }, 100);
}

// Returns { decision: 'ask', reason } or null (stay silent, normal permissions apply).
function decide(input) {
  if (!input || typeof input !== 'object' || !FILE_TOOLS.has(input.tool_name)) return null;
  const session = typeof input.session_id === 'string' ? input.session_id : '';
  const file = targetPath(input);
  if (!session || !file) return null;
  const cwd = typeof input.cwd === 'string' && input.cwd ? input.cwd : process.cwd();
  const air = store.findAirspace(cwd);
  if (!air) return null;

  try { heartbeat(air.root, session); } catch { /* best effort */ }

  const abs = store.realpathLoose(path.resolve(cwd, file));
  // A file in a linked worktree is judged by its path inside that worktree, the same lanes apply.
  const rel = relativeTo(air.top, abs) || relativeTo(air.root, abs);
  if (!rel || rel === '.atc' || rel.startsWith('.atc/')) return null;

  const data = store.readAirspace(air.root);
  const now = Date.now();
  for (const [id, f] of Object.entries(data.flights)) {
    if (!store.isLive(f, now) || store.ownedBy(id, f, session)) continue;
    const lane = matchesAny(f.lanes, rel);
    if (lane) {
      const purpose = store.cleanText(f.purpose, store.PURPOSE_MAX);
      const why = purpose ? ` (${purpose})` : '';
      return { decision: 'ask', reason: `Runway occupied: ${store.cleanText(rel, 120)} is in ${store.cleanCallsign(f.callsign)}'s lane${why}. Coordinate before landing. (ATC coordination, not a sandbox. Run /army:radar to see the board.)` };
    }
  }
  return null;
}

function run(stdinText, out = process.stdout) {
  try {
    const input = JSON.parse(stdinText || '{}');
    const d = decide(input);
    if (d) {
      out.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: d.decision, permissionDecisionReason: d.reason } }));
    }
  } catch { /* never break the tool call */ }
}

module.exports = { decide, run, targetPath };
