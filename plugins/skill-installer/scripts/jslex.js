'use strict';
/*
 * Tiny JavaScript line lexer: finds regex literals so a detector like /curl.*\|\s*sh/.test(x) is not reported as a command.
 * It tracks strings, template literals and block comments across lines (state object), so text inside a string or a
 * comment is never mistaken for a regex literal. Only a literal directly used as `/re/.test(` or `.match(/re/` counts.
 * Such a line cannot run as shell either: "word.test(" is a shell syntax error.
 */
const REGEX_AFTER = '(,=:[!&|?{};+-*%<>~^';
const KEYWORDS = /^(return|typeof|case|in|of|void|delete|throw|else|do)$/;
const USED_AS_TEST = /^\s*\.(test|exec|match|matchAll|search|replace|replaceAll|split)\s*\(/;
const PASSED_TO = /\.(test|exec|match|matchAll|search|replace|replaceAll|split)\s*\(\s*$/;

function lexLine(line, st) {
  const spans = [];
  const n = line.length;
  let i = 0; let prev = ''; let word = '';
  while (i < n) {
    if (st.block) { const e = line.indexOf('*/', i); if (e < 0) return spans; st.block = false; i = e + 2; continue; }
    if (st.tpl) {
      while (i < n && line[i] !== '`') i += line[i] === '\\' ? 2 : 1;
      if (i >= n) return spans;
      st.tpl = false; i++; prev = 'a'; continue;
    }
    const c = line[i];
    if (c === ' ' || c === '\t') { i++; continue; }
    if (c === '/' && line[i + 1] === '/') return spans;
    if (c === '/' && line[i + 1] === '*') { st.block = true; i += 2; continue; }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n && line[j] !== c) j += line[j] === '\\' ? 2 : 1;
      if (j >= n) return spans;
      i = j + 1; prev = 'a'; word = ''; continue;
    }
    if (c === '`') { st.tpl = true; i++; continue; }
    if (c === '/') {
      if (prev === '' || REGEX_AFTER.includes(prev) || KEYWORDS.test(word)) {
        let j = i + 1; let cls = false;
        while (j < n && (cls || line[j] !== '/')) { if (line[j] === '\\') j++; else if (line[j] === '[') cls = true; else if (line[j] === ']') cls = false; j++; }
        if (j < n) { let e = j + 1; while (e < n && /[a-z]/.test(line[e])) e++; spans.push([i, e]); i = e; prev = 'a'; word = ''; continue; }
      }
      prev = '/'; i++; continue;
    }
    if (/[\w$]/.test(c)) { let j = i; while (j < n && /[\w$]/.test(line[j])) j++; word = line.slice(i, j); prev = 'a'; i = j; continue; }
    prev = c; word = ''; i++;
  }
  return spans;
}

// Line with every regex literal that is only used as a test/match pattern blanked out (same length).
function blankDetectors(line, spans) {
  let out = line;
  for (const [s, e] of spans) {
    if (USED_AS_TEST.test(line.slice(e)) || PASSED_TO.test(line.slice(0, s))) out = out.slice(0, s) + ' '.repeat(e - s) + out.slice(e);
  }
  return out;
}

module.exports = { lexLine, blankDetectors };
