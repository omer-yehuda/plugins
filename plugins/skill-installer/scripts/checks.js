// customs:rules-file
'use strict';
/*
 * Structural checks that need more than one line of context: hidden characters, HTML comments,
 * minified blobs, hooks, MCP servers, manifest, and the same-file exfiltration combination.
 * Each check returns findings as { rule, cat, sev, line, msg, match? }. scan.js adds the file and snippet.
 * Declares the rules-file marker for the same reason rules.js does (see the header there).
 */
const { NET_RE, URL_RE, ENV_RE, WELL_KNOWN } = require('./rules');

const f = (rule, cat, sev, line, msg, match) => ({ rule, cat, sev, line, msg, match });

// Zero-width and bidi controls. U+200D between emoji is legitimate; LRM/RLM are normal in RTL text.
const STRONG = /[\u200B\u200C\u200D\u2060\u202A-\u202E\u2066-\u2069\uFEFF]/;
const WEAK = /[\u200E\u200F]/;
const TAGS = /[\u{E0000}-\u{E007F}]/u;

function hiddenChars(lines, kind) {
  const out = [];
  lines.forEach((text, i) => {
    const ln = i + 1;
    if (TAGS.test(text)) out.push(f('HT003', 'hidden-text', 'CRITICAL', ln, 'Unicode tag characters (invisible text that models can read)'));
    let s = text;
    if (i === 0) s = s.replace(/^\uFEFF/, ''); // a BOM at the very start is normal
    s = s.replace(/(\p{Extended_Pictographic}|️)\u200D(?=\p{Extended_Pictographic})/gu, '');
    if (STRONG.test(s)) {
      const sev = kind === 'doc' ? 'MEDIUM' : 'HIGH';
      const codes = [...new Set([...s].filter((c) => STRONG.test(c)).map((c) => 'U+' + c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')))];
      out.push(f('HT001', 'hidden-text', sev, ln, `Invisible or bidirectional control characters (${codes.join(', ')})`));
    } else if (WEAK.test(s)) {
      out.push(f('HT004', 'hidden-text', 'LOW', ln, 'Directional mark (normal in right-to-left text, check if unexpected)'));
    }
  });
  return out;
}

const INSTRUCTIONY = /\b(ignore|instruction|you must|you are|you should|do not|don't|secret|silently|assistant|claude|system prompt|always|never|run |execute|curl|send|upload|read )/i;
const MAX_COMMENTS = 2000;
// Linear scan with indexOf (no lazy regex, so repeated "<!--" cannot make it quadratic).
function htmlComments(text, kind) {
  const out = [];
  let pos = 0; let n = 0; let lineAt = 1; let lineFrom = 0;
  const lineOfIdx = (idx) => { for (let k = text.indexOf('\n', lineFrom); k >= 0 && k < idx; k = text.indexOf('\n', lineFrom)) { lineAt++; lineFrom = k + 1; } return lineAt; };
  while (pos < text.length) {
    const s = text.indexOf('<!--', pos);
    if (s < 0) break;
    if (++n > MAX_COMMENTS) { out.push(f('HT005', 'hidden-text', 'MEDIUM', lineOfIdx(s), `More than ${MAX_COMMENTS} HTML comments: the rest were not checked`)); break; }
    const e = text.indexOf('-->', s + 4);
    const body = e < 0 ? text.slice(s + 4, s + 24004) : text.slice(s + 4, e);
    pos = e < 0 ? text.length : e + 3;
    if (/^\s*(BEGIN|END)\b[A-Z0-9 _-]*$/.test(body.slice(0, 200).trim())) continue; // generated-section markers
    if (INSTRUCTIONY.test(body) && body.trim().length > 20)
      out.push(f('HT002', 'hidden-text', kind === 'doc' ? 'MEDIUM' : 'HIGH', lineOfIdx(s), 'HTML comment that reads like instructions (invisible when rendered, visible to the agent)', body.trim().slice(0, 100)));
  }
  return out;
}

function longLines(lines, kind) {
  if (kind !== 'script') return [];
  const out = [];
  lines.forEach((t, i) => {
    if (t.length > 5000) out.push(f('OB004', 'obfuscation', 'MEDIUM', i + 1, `Single line of ${t.length} characters (minified or packed script)`));
    else if (/[A-Za-z0-9+/=]{300,}/.test(t)) {
      const decode = /atob|b64decode|base64\s+(-d|--decode)|Buffer\.from\([^)]*base64|fromhex|unhexlify|decode\(/i.test(t);
      const run = /\beval\b|\bexec\b|Function\s*\(|\|\s*(ba)?sh\b|spawn|execSync|system\(|vm\.run/i.test(t);
      out.push(decode && run
        ? f('OB005', 'obfuscation', 'CRITICAL', i + 1, 'Long encoded blob that is decoded and executed')
        : f('OB006', 'obfuscation', 'MEDIUM', i + 1, 'Long opaque encoded blob (cannot be reviewed)'));
    }
  });
  return out;
}

// ------------------------------------------------------------------ json structures
function tryJson(text) { try { return JSON.parse(text); } catch { return null; } }

function collectHooks(obj) {
  const hooks = obj && (obj.hooks && typeof obj.hooks === 'object' ? obj.hooks : null);
  const list = [];
  if (!hooks) return list;
  for (const [event, groups] of Object.entries(hooks)) {
    for (const g of Array.isArray(groups) ? groups : []) {
      const hs = Array.isArray(g.hooks) ? g.hooks : [];
      for (const h of hs) list.push({ event, matcher: g.matcher === undefined ? '' : String(g.matcher), type: h.type || 'command', command: h.command || h.prompt || h.url || '' });
    }
  }
  return list;
}

function lineOf(text, needle) {
  const idx = needle ? text.indexOf(needle) : -1;
  return idx < 0 ? 1 : text.slice(0, idx).split('\n').length;
}

function hookChecks(text) {
  const obj = tryJson(text);
  const hooks = collectHooks(obj);
  const out = [];
  for (const h of hooks) {
    const ln = lineOf(text, h.command || h.event);
    const wide = ['', '*', '.*', '.+'].includes(h.matcher.trim());
    if ((h.event === 'PreToolUse' || h.event === 'PostToolUse') && wide) {
      out.push(f('HK003', 'hooks', 'MEDIUM', ln, `${h.event} hook with matcher "${h.matcher || '(empty)'}" runs on every tool call`));
    } else if (h.event === 'UserPromptSubmit') {
      out.push(f('HK004', 'hooks', 'LOW', ln, 'Hook runs on every user prompt'));
    }
    if (h.type === 'http') out.push(f('HK002', 'hooks', 'HIGH', ln, 'Hook posts to a remote URL', h.command));
  }
  return out;
}

const PINNED = /@\d|==\d|@[\^~]?\d/;
function mcpChecks(text) {
  const obj = tryJson(text);
  const servers = obj && (obj.mcpServers || (obj.mcp && obj.mcp.servers) || (Object.values(obj).every((v) => v && typeof v === 'object' && (v.command || v.url)) ? obj : null));
  const out = [];
  if (!servers || typeof servers !== 'object') return out;
  for (const [name, s] of Object.entries(servers)) {
    if (!s || typeof s !== 'object') continue;
    const ln = lineOf(text, `"${name}"`);
    const argv = [s.command, ...(Array.isArray(s.args) ? s.args : [])].filter((x) => typeof x === 'string');
    const runner = /^(npx|bunx|uvx|pipx|pnpm|yarn)$/.test(String(s.command || '').split(/[\\/]/).pop().replace(/\.cmd$/, ''));
    if (runner) {
      const pkg = argv.slice(1).find((a) => !a.startsWith('-') && a !== 'dlx' && a !== 'run');
      if (pkg && !PINNED.test(pkg.replace(/^@/, ''))) out.push(f('MC001', 'mcp', 'MEDIUM', ln, `MCP server "${name}" runs unpinned package ${pkg}`));
    }
    if (s.url && !/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])/.test(s.url)) out.push(f('MC002', 'mcp', 'LOW', ln, `MCP server "${name}" connects to remote URL ${s.url}`));
  }
  return out;
}

function lev(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

function manifestChecks(text) {
  const obj = tryJson(text);
  const out = [];
  if (!obj || typeof obj !== 'object') return [f('MF000', 'manifest', 'LOW', 1, 'plugin.json is not valid JSON')];
  if (!obj.license) out.push(f('MF001', 'manifest', 'LOW', 1, 'plugin.json has no license'));
  if (!obj.repository) out.push(f('MF002', 'manifest', 'LOW', 1, 'plugin.json has no repository (cannot verify the source)'));
  const name = String(obj.name || '');
  const ln = lineOf(text, '"name"');
  if (/^(claude|anthropic)([-_]|$)/i.test(name)) out.push(f('MF003', 'manifest', 'MEDIUM', ln, `Name "${name}" starts with a reserved vendor prefix`));
  else if (/[^\x20-\x7E]/.test(name)) out.push(f('MF004', 'manifest', 'MEDIUM', ln, `Name "${name}" contains non-ASCII characters (look-alike letters)`));
  else if (name.length >= 6) {
    const near = WELL_KNOWN.find((k) => k !== name && Math.abs(k.length - name.length) <= 2 && lev(k, name) <= (name.length >= 10 ? 2 : 1));
    if (near) out.push(f('MF005', 'manifest', 'MEDIUM', ln, `Name "${name}" is very close to the well-known "${near}"`));
  }
  if (/[^A-Za-z0-9._@\/-]/.test(name.replace(/[^\x20-\x7E]/g, '')) || name.includes('..') || name.startsWith('-')) out.push(f('MF007', 'manifest', 'HIGH', ln, 'Name contains shell or path characters (never paste it into a command)'));
  out.push(...hookChecks(text), ...mcpChecks(text));
  return out;
}

// tools / allowed-tools in agent and skill frontmatter
function frontmatterChecks(lines, rel) {
  if (lines[0] !== '---') return [];
  const end = lines.indexOf('---', 1);
  if (end < 0) return [];
  const out = [];
  const isAgent = /(^|\/)agents\//.test(rel);
  const fm = lines.slice(1, end);
  const grants = fm.findIndex((l) => /^allowed-tools\s*:/.test(l));
  if (grants >= 0 && /Bash(\(\*\)|\(\*:\*\)|\s*$|\s*,)|Bash\((curl|wget|sudo|rm|sh|bash)[: *)]/.test(fm[grants]))
    out.push(f('PM001', 'permissions', 'MEDIUM', grants + 2, 'Pre-approves broad shell access (allowed-tools)'));
  if (isAgent && !fm.some((l) => /^tools\s*:/.test(l)))
    out.push(f('PM002', 'permissions', 'LOW', 1, 'Agent has no tools list, so it inherits every tool'));
  return out;
}

// network + env/home read (or credential/dump findings) in the same script
function exfilCombo(lines, kind, fileFindings) {
  if (kind !== 'script') return [];
  let net = 0; let netLine = 0; let env = 0;
  lines.forEach((t, i) => {
    if (/^\s*(\/\/|#)/.test(t)) return;
    for (let o = 0; o < t.length || o === 0; o += 3500) {
      const w = t.slice(o, o + 4000);
      if (NET_RE.test(w) && (URL_RE.test(w) || /fetch\s*\(\s*[A-Za-z_$]|requests\.|\bcurl\b\s+\S*\$/.test(w))) { net++; if (!netLine) netLine = i + 1; }
      if (ENV_RE.test(w)) env++;
      if (o + 4000 >= t.length) break;
    }
  });
  if (!net) return [];
  const cred = fileFindings.some((x) => x.cat === 'credential-access' && ['HIGH', 'MEDIUM'].includes(x.sev) && x.rule !== 'CA002' && x.rule !== 'CA006');
  if (cred) return [f('EX003', 'exfiltration', 'CRITICAL', netLine, 'Script reads credentials or dumps the environment AND calls a non-local network address')];
  if (env) return [f('EX004', 'exfiltration', 'MEDIUM', netLine, 'Script reads environment or home-folder data AND calls a non-local network address (check what is sent)')];
  return [];
}

module.exports = { hiddenChars, htmlComments, longLines, hookChecks, mcpChecks, manifestChecks, frontmatterChecks, exfilCombo, collectHooks, tryJson, lev };
