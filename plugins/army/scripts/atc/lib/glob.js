'use strict';
/*
 * Tiny glob engine for lanes. Paths are POSIX-style and relative to the project root.
 *   **   any number of path segments (including none)
 *   *    anything inside one segment
 *   ?    one character inside a segment
 *   {a,b} alternatives (no nesting)
 * A pattern that names a directory ("src/api") also covers everything under it.
 */

function normalizePattern(p) {
  let s = String(p).trim().replace(/\\/g, '/').replace(/^(\.\/)+/, '').replace(/\/{2,}/g, '/');
  if (s.endsWith('/')) s += '**';
  return s;
}

function validatePattern(p) {
  const s = normalizePattern(p);
  if (!s) return 'empty pattern';
  if (s.startsWith('/') || /^[A-Za-z]:\//.test(s)) return 'lanes must be relative to the project root';
  if (s.split('/').includes('..')) return 'lanes may not contain ".."';
  if ((s.match(/{/g) || []).length !== (s.match(/}/g) || []).length) return 'unbalanced braces';
  return null;
}

function escapeRe(c) { return c.replace(/[.+^$()|[\]\\]/g, '\\$&'); }

function segmentToRe(seg) {
  let out = '';
  let inBrace = false;
  for (const c of seg) {
    if (c === '*') out += '[^/]*';
    else if (c === '?') out += '[^/]';
    else if (c === '{') { out += '(?:'; inBrace = true; }
    else if (c === '}') { out += ')'; inBrace = false; }
    else if (c === ',' && inBrace) out += '|';
    else out += escapeRe(c);
  }
  return out;
}

function globToRegex(pattern) {
  const segs = normalizePattern(pattern).split('/');
  let re = '';
  segs.forEach((seg, i) => {
    const last = i === segs.length - 1;
    if (seg === '**') re += last ? '.*' : '(?:[^/]+/)*';
    else re += segmentToRe(seg) + (last ? '' : '/');
  });
  // a directory pattern also covers its contents
  return new RegExp('^' + re + '(?:/.*)?$');
}

function toRel(file) { return String(file).replace(/\\/g, '/').replace(/^(\.\/)+/, ''); }

function matches(pattern, file) { return globToRegex(pattern).test(toRel(file)); }
function matchesAny(patterns, file) { return patterns.find((p) => matches(p, file)) || null; }

const hasWild = (s) => /[*?{]/.test(s);

// Conservative: true when the two patterns could claim a common file.
function patternsOverlap(a, b) {
  const sa = normalizePattern(a).split('/');
  const sb = normalizePattern(b).split('/');
  const n = Math.min(sa.length, sb.length);
  for (let i = 0; i < n; i++) {
    const x = sa[i];
    const y = sb[i];
    if (x === '**' || y === '**') return true;
    if (!hasWild(x) && !hasWild(y)) { if (x !== y) return false; continue; }
    if (hasWild(x) && !hasWild(y)) { if (!new RegExp('^' + segmentToRe(x) + '$').test(y)) return false; continue; }
    if (hasWild(y) && !hasWild(x)) { if (!new RegExp('^' + segmentToRe(y) + '$').test(x)) return false; continue; }
    // both wild: assume they can meet
  }
  return true; // one is a directory prefix of the other (or both ran out together)
}

function lanesOverlap(lanesA, lanesB) {
  const hits = [];
  for (const a of lanesA) for (const b of lanesB) if (patternsOverlap(a, b)) hits.push([a, b]);
  return hits;
}

module.exports = { normalizePattern, validatePattern, globToRegex, matches, matchesAny, patternsOverlap, lanesOverlap, toRel };
