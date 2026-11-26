'use strict';
/* ASCII radar board. */
const path = require('path');
const store = require('./store');
const { lanesOverlap } = require('./glob');

function age(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}m`;
}
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + '~' : s);

function collect(root, session, now = Date.now()) {
  const data = store.readAirspace(root);
  const entries = Object.entries(data.flights).map(([id, f]) => ({
    id, callsign: store.cleanCallsign(f.callsign), purpose: store.cleanText(f.purpose, store.PURPOSE_MAX), lanes: (Array.isArray(f.lanes) ? f.lanes : []).map((l) => store.cleanText(l, 200)), owner: f.owner || id,
    claimedAgo: now - (f.claimedAt || now), heartbeatAgo: now - (f.heartbeat || 0),
    live: store.isLive(f, now), mine: !!session && store.ownedBy(id, f, session),
  }));
  const live = entries.filter((e) => e.live);
  const conflicts = [];
  for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
    const hits = lanesOverlap(live[i].lanes, live[j].lanes);
    if (hits.length) conflicts.push({ a: live[i].callsign, b: live[j].callsign, lanes: hits.map(([x, y]) => `${x} <> ${y}`) });
  }
  return { root, flights: entries, live: live.length, expired: entries.length - live.length, conflicts };
}

function render(info) {
  const out = [];
  const head = `ATC RADAR  ${path.basename(info.root)}  |  ${info.live} live, ${info.expired} expired, ${info.conflicts.length} conflict${info.conflicts.length === 1 ? '' : 's'}`;
  out.push('+' + '-'.repeat(head.length + 2) + '+', `| ${head} |`, '+' + '-'.repeat(head.length + 2) + '+');
  if (!info.flights.length) { out.push('', '  Sky is clear. No flights registered.  (claim lanes with /army:claim)'); return out.join('\n'); }
  out.push('');
  for (const f of info.flights) {
    const state = f.live ? (f.mine ? 'YOU' : 'LIVE') : 'EXPIRED';
    out.push(`  [${state.padEnd(7)}] ${f.callsign.padEnd(12)} up ${age(f.claimedAgo).padEnd(6)} last seen ${age(f.heartbeatAgo).padEnd(6)} ${clip(f.purpose || '(no purpose)', 40)}`);
    for (const l of f.lanes) out.push(`      lane  ${l}`);
  }
  if (info.conflicts.length) {
    out.push('', '  !! CONFLICTS (overlapping lanes)');
    for (const c of info.conflicts) out.push(`     ${c.a} x ${c.b}: ${c.lanes.join(', ')}`);
  }
  return out.join('\n');
}

module.exports = { collect, render, age };
