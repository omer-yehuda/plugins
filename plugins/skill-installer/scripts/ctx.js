'use strict';
/*
 * Scan context: collects findings. The verdict counts EVERY finding; only the stored list is capped per rule and file,
 * and the cap keeps the most severe ones, so nothing that matters is hidden by the display limit.
 */
const RANK = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
const PER_RULE_FILE = 8;
const bySev = (a, b) => RANK[b.sev] - RANK[a.sev] || a.line - b.line;
const BUDGET_MS = Math.max(1, Number(process.env.CUSTOMS_TIME_BUDGET_MS) || 30000);

function makeCtx(root) {
  const byKey = new Map();
  const totals = new Map();
  const counts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  const deadline = Date.now() + BUDGET_MS;
  return {
    root, files: [], excluded: [], weighted: [], symlinks: [], vendored: [], nmReferenced: false, truncated: false, timedOut: false, counts,
    expired() { return Date.now() > deadline; },
    add(f) {
      counts[f.sev]++;
      const k = `${f.rule}|${f.file}`;
      totals.set(k, (totals.get(k) || 0) + 1);
      let a = byKey.get(k);
      if (!a) { a = []; byKey.set(k, a); }
      a.push(f);
      if (a.length > 4 * PER_RULE_FILE) { a.sort(bySev); a.length = PER_RULE_FILE; }
    },
    addAll(list) { list.forEach((f) => this.add(f)); },
    result() {
      const findings = [];
      let suppressed = 0;
      for (const [k, a] of byKey) { a.sort(bySev); const kept = a.slice(0, PER_RULE_FILE); findings.push(...kept); suppressed += totals.get(k) - kept.length; }
      findings.sort((a, b) => RANK[b.sev] - RANK[a.sev] || (a.file < b.file ? -1 : a.file > b.file ? 1 : a.line - b.line));
      return { findings, suppressed };
    },
  };
}

module.exports = { makeCtx, RANK, PER_RULE_FILE };
