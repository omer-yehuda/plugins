// customs:rules-file
'use strict';
/*
 * Per-file analysis: runs the rule table over every line (long lines in overlapping windows, so no regex ever sees
 * more than 4 KB) and decides severity. Declares the rules-file marker because it holds example patterns in comments.
 * Severity rules, none of which trusts claims made inside the scanned text:
 *   - markdown: command rules are capped (doc LOW, agent file MEDIUM or the rule's mdCap); injection rules are never softened
 *   - comment lines (only the language's own marker at the start of a line) lower a rule by one band, never to LOW for CRITICAL
 *   - a match that sits only inside a regex literal used as `/re/.test(` (a detector, see jslex.js) is LOW
 *   - destructive-command text that is clearly a message ("git reset --hard (discards work)") is data, because the shell rejects it
 *   - test files that nothing wires up are capped at HIGH (still SECONDARY), wired ones keep full severity
 */
const path = require('path');
const { RULES } = require('./rules');
const C = require('./checks');
const { cleanText } = require('./safe');
const { lexLine, blankDetectors } = require('./jslex');
const { RANK } = require('./ctx');
const { joinContinuations, normalize, fileChecks, PROTO } = require('./norm');

const NAMES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const lower = (a, b) => (RANK[a] <= RANK[b] ? a : b);
const stepDown = (s) => NAMES[Math.max(0, RANK[s] - 2)];
const WIN = 4000;
const STEP = 3500;
const JS_EXT = new Set(['.js', '.mjs', '.cjs', '.ts']);
const SLASH_COMMENT = new Set(['.js', '.mjs', '.cjs', '.ts', '.php']);
const HASH_COMMENT = new Set(['.sh', '.bash', '.zsh', '.py', '.rb', '.pl', '.ps1', '.psm1']);
// A quoted string that is plain wording: no shell syntax, ends in a "(note)". `sh` rejects "cmd (note)" as a syntax error.
const MESSAGE = /^[^;&|$`<>\n()'"\\]*[A-Za-z0-9_.\/=-] \([A-Za-z][A-Za-z ,'-]*\)$/;

function windows(line) {
  if (line.length <= WIN) return [[0, line]];
  const out = [];
  for (let o = 0; o < line.length; o += STEP) { out.push([o, line.slice(o, o + WIN)]); if (o + WIN >= line.length) break; }
  return out;
}

function commentLine(line, ext, shebang) {
  if (SLASH_COMMENT.has(ext)) return /^\s*\/\//.test(line);
  if (HASH_COMMENT.has(ext) || shebang) return /^\s*#(?!!)/.test(line);
  return false;
}

function isMessageLiteral(win, idx, len) {
  const re = /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"/g;
  let q;
  while ((q = re.exec(win))) {
    const start = q.index + 1;
    const body = q[1] !== undefined ? q[1] : q[2];
    if (idx >= start && idx + len <= start + body.length) return MESSAGE.test(body);
    if (q.index > idx) break;
  }
  return false;
}

function maskSecrets(s) {
  return s
    .replace(/\b(gh[pousr]_|github_pat_|sk-|xox[baprs]-)([A-Za-z0-9_-]{4})[A-Za-z0-9_-]{6,}/g, (m, p, k) => p + k + '****')
    .replace(/\bAKIA([0-9A-Z]{4})[0-9A-Z]{12}\b/g, 'AKIA$1****')
    .replace(/\bAIza([0-9A-Za-z_-]{4})[0-9A-Za-z_-]{26,}/g, 'AIza$1****')
    .replace(/((?:api[_-]?key|secret|token|passw(?:or)?d|auth\w*)["']?\s*[:=]\s*["']?)([A-Za-z0-9_\-/+=.]{4})[A-Za-z0-9_\-/+=.]{8,}/gi, '$1$2****');
}
function snippet(line, idx) {
  let s = line.trim();
  if (s.length > 120 && idx > 60) { const start = Math.max(0, idx - 40); s = '…' + line.slice(start).trim(); }
  s = cleanText(maskSecrets(s));
  return s.length > 120 ? s.slice(0, 119) + '…' : s;
}

// lineBase: number added to line numbers, or null when the text is a file tail whose line numbers are unknown (reported as 0).
function analyze(rec, rel, text, lines, ctx, lineBase = 0) {
  const kind = rec.kind;
  const ext = path.extname(rel).toLowerCase();
  const isMd = kind === 'agentmd' || kind === 'doc';
  const shebang = /^#!/.test(lines[0] || '');
  const mine = [];
  const lineNo = (i) => (lineBase === null ? 0 : lineBase + i + 1);
  const push = (x, lineText) => {
    if (rec.weighted && x.cat !== 'hidden-text') x = { ...x, sev: lower(x.sev, 'HIGH') };
    const o = { ...x, file: rel, snippet: x.match ? snippet(x.match, 0) : snippet(lineText || '', x.idx || 0) };
    delete o.match; delete o.idx; mine.push(o);
  };
  let fence = false;
  const lexState = { tpl: false, block: false };
  const isJs = kind === 'script' && JS_EXT.has(ext);
  const hijack = isJs && PROTO.test(text); // built-ins reassigned: a "detector" regex may be the payload, so no blanking at all
  const jl = joinContinuations(lines, kind); // commands split with "\" or a trailing "|" are rejoined for matching
  for (let i = 0; i < lines.length; i++) {
    const line = jl[i];
    if ((i & 1023) === 0 && ctx.expired()) { ctx.timedOut = true; break; }
    if (isMd && /^\s*(```|~~~)/.test(line)) fence = !fence;
    if (!line.trim()) continue;
    const comment = kind === 'script' && commentLine(line, ext, shebang);
    const seen = new Set();
    const spans = isJs ? lexLine(line, lexState) : [];
    const blanked = !hijack && spans.length && line.length <= WIN ? blankDetectors(line, spans) : null;
    const nline = normalize(line);
    const variants = [{ text: line, blank: blanked }];
    if (nline !== line) variants.push({ text: nline, blank: blanked ? normalize(blanked) : null, norm: true });
    for (const { text: vtext, blank: blanked, norm } of variants) for (const [off, win] of windows(vtext)) {
      for (const r of RULES) {
        if (!r.kinds.includes(kind)) continue;
        if (norm && seen.has('id:' + r.id)) continue; // the plain copy already reported it
        if (r.pre && !r.pre.test(win)) continue;
        const m = r.fn ? (r.fn(win) ? { index: 0, 0: '' } : null) : win.match(r.re);
        if (!m) continue;
        const abs = off + (m.index || 0);
        const key = r.id + abs;
        if (seen.has(key)) continue;
        seen.add(key); if (!norm) seen.add('id:' + r.id);
        let sev = r.sev;
        if (isMd && r.exec) { let cap = kind === 'doc' ? 'LOW' : (r.mdCap || 'MEDIUM'); if (fence && kind !== 'doc' && r.sev !== 'CRITICAL') cap = stepDown(cap); sev = lower(sev, cap); }
        else if (isMd && r.inj && kind === 'doc') sev = lower(sev, 'MEDIUM');
        else if (isMd && !r.inj) sev = lower(sev, kind === 'doc' ? 'LOW' : 'MEDIUM');
        if (comment && r.exec) sev = lower(sev, r.sev === 'CRITICAL' ? 'HIGH' : 'MEDIUM');
        else if (blanked && r.exec && blanked !== vtext && !(r.fn ? r.fn(blanked) : r.re.test(blanked))) sev = 'LOW'; // the match was only inside a regex detector
        else if (kind === 'script' && r.cat === 'destructive' && isMessageLiteral(win, m.index || 0, (m[0] || '').length)) sev = lower(sev, r.sev === 'CRITICAL' ? 'HIGH' : 'LOW');
        push({ rule: r.id, cat: r.cat, sev, line: lineNo(i), msg: r.msg, idx: m.index || 0 }, win);
      }
    }
  }
  const extra = [...C.hiddenChars(lines, kind), ...C.longLines(lines, kind), ...fileChecks(rec, lineBase === null ? [] : jl, isJs)];
  if (isMd) extra.push(...C.htmlComments(text, kind), ...(kind === 'agentmd' ? C.frontmatterChecks(lines, rel) : []));
  if (kind === 'config') {
    const base = path.posix.basename(rel);
    if (base === 'plugin.json') extra.push(...C.manifestChecks(text));
    else { extra.push(...C.hookChecks(text)); if (/mcp/i.test(base)) extra.push(...C.mcpChecks(text)); }
  }
  extra.push(...C.exfilCombo(lines, kind, mine));
  extra.forEach((x) => push(lineBase === null ? { ...x, line: 0 } : { ...x, line: x.line + lineBase }, lines[x.line - 1] || ''));
  ctx.addAll(mine);
}

module.exports = { analyze, snippet, maskSecrets, windows };
