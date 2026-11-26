// customs:rules-file
'use strict';
/*
 * Evasion-proofing for the line rules. Declares the rules-file marker because it names the patterns it undoes.
 *   joinContinuations   a line that ends in "\" or "|" continues on the next one, so the rules see the whole command
 *   normalize           a second copy of a line with escapes decoded (\xHH \uHHHH \u{..}), "a"+"b" folded, empty quote
 *                       pairs and ${IFS} removed, and long base64 strings decoded and appended; every rule runs on both copies
 *   fileChecks          whole-file rules that do not depend on a single line: network + execution in one script (RC007),
 *                       built-in methods reassigned (OB008, which also turns detector blanking off)
 */
const { NET_RE } = require('./rules');

const TRIGGER = /\\x[0-9a-f]{2}|\\u[0-9a-f{]|["'`]\s*\+\s*["'`]|''|""|\$\{?IFS\b|[A-Za-z0-9+/]{16,}={0,2}|[A-Za-z]\\[A-Za-z]|\.concat\s*\(|\.join\s*\(\s*(''|"")\s*\)/i;

const BSLASH = /(?:^|[^\\])\\$/;
const PIPE = /(?:^|[^|])\|$/;
function joinContinuations(lines, kind) {
  if (kind === 'config') return lines;
  const out = lines.slice();
  for (let i = 0; i < out.length - 1; i++) {
    if (/^\s*(\/\/|#(?!!))/.test(lines[i])) continue;
    let cur = lines[i]; let j = i; let k = 0;
    const cont = (l) => { const t = l.replace(/\s+$/, ''); return BSLASH.test(t) || (kind === 'script' && PIPE.test(t)); };
    while (j + 1 < lines.length && k < 40 && cont(lines[j])) {
      const t = lines[j].replace(/\s+$/, '');
      cur = (BSLASH.test(t) ? cur.replace(/\s*\\\s*$/, '') : cur) + ' ' + lines[j + 1].trim();
      j++; k++;
    }
    if (j > i) { out[i] = cur; for (let m = i + 1; m <= j; m++) out[m] = ''; i = j; }
  }
  return out;
}

function decodeB64(s) {
  return (s.match(/[A-Za-z0-9+/]{16,}={0,2}/g) || []).map((b) => {
    try { const t = Buffer.from(b, 'base64').toString('latin1'); return /^[\x20-\x7e\r\n\t]{12,}$/.test(t) ? t : ''; } catch { return ''; }
  }).filter(Boolean).join(' ');
}

function normalize(line) {
  if (!TRIGGER.test(line)) return line;
  let s = line
    .replace(/\\x([0-9a-fA-F]{2})/g, (m, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\u\{([0-9a-fA-F]{1,6})\}/g, (m, h) => { const c = parseInt(h, 16); return c <= 0x10ffff ? String.fromCodePoint(c) : m; })
    .replace(/\\u([0-9a-fA-F]{4})/g, (m, h) => String.fromCharCode(parseInt(h, 16)));
  for (let k = 0; k < 4; k++) s = s.replace(/(["'`])\s*\+\s*(["'`])/g, '').replace(/(["'`])\s*\)?\s*\.concat\(\s*(["'`])/g, '');
  s = s.replace(/["']\s*,\s*["'](?=[^\]]{0,200}\]\s*\.join\(\s*(''|"")\s*\))/g, '').replace(/\$\{IFS\}|\$IFS\b/g, ' ')
    .replace(/(?<=[A-Za-z])(''|"")(?=[A-Za-z])/g, '').replace(/(?<=[A-Za-z])\\(?=[A-Za-z])/g, '');
  const b = decodeB64(s);
  return b ? s + ' ' + b : s;
}

const PROTO = /RegExp\.prototype|\.prototype\.(test|exec|match|matchAll|search|replace|split)\s*=|String\.prototype\.(match|replace|search|split)\s*=|Object\.defineProperty\(\s*(RegExp|String)\.prototype/;
const EXEC_CODE = /\beval\s*\(|\bexec\s*\(|\bnew\s+Function\b|\bvm\.run\w*|\bchild_process\b|\bexecSync\b|\bexecFile(Sync)?\b|\bspawn(Sync)?\s*\(|\bsubprocess\b|\bos\.(system|popen)\b|\bpopen\s*\(|\bFunction\s*\(/;
const EXEC_SH = /^\s*(sudo\s+)?(env\s+)?(\S*\/)?(ba|z|da|k)?sh\s+\S|\bchmod\s+(-\w+\s+)?\S*\+x|^\s*(source|\.)\s+\S|^\s*\.\/\S|^\s*exec\s+\S/;

function fileChecks(rec, lines, jsLike) {
  const out = [];
  const body = lines.filter((l) => !/^\s*(\/\/|#(?!!))/.test(l));
  if (jsLike && PROTO.test(lines.join('\n').slice(0, 600000))) {
    const n = lines.findIndex((l) => PROTO.test(l)) + 1;
    out.push({ rule: 'OB008', cat: 'obfuscation', sev: 'HIGH', line: n, msg: 'A built-in method (RegExp, String) is reassigned: detector blanking is switched off for this file' });
  }
  if (rec.wired && rec.kind === 'script') {
    const net = body.findIndex((l) => NET_RE.test(l.slice(0, 4000)));
    const shell = !jsLike && !/\.(py|rb|pl|php|lua|ps1|psm1)$/i.test(rec.rel);
    const exec = body.some((l) => EXEC_CODE.test(l.slice(0, 4000)) || (shell && EXEC_SH.test(l.slice(0, 4000))));
    if (net >= 0 && exec) out.push({ rule: 'RC007', cat: 'remote-code', sev: 'HIGH', line: net + 1, msg: 'Wired script both fetches from the network and runs code (download-then-execute split across lines)' });
  }
  return out;
}

module.exports = { joinContinuations, normalize, fileChecks, PROTO };
