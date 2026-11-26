'use strict';
/* Airspace store: .atc/airspace.json at the project root. Atomic writes, lock file, expiry. */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const EXPIRY_MS = 2 * 60 * 60 * 1000;
const MAX_FLIGHT_MS = 8 * 60 * 60 * 1000; // hard cap on a flight's lifetime, whatever its heartbeat says
const FUTURE_SLACK_MS = 60 * 1000;
const PURPOSE_MAX = 80;
const HEARTBEAT_MS = 30 * 1000;
const LOCK_STALE_MS = 10 * 1000;
const LOCK_WAIT_MS = 4000;
const CALLSIGNS = ['FALCON', 'EAGLE', 'HAWK', 'RAVEN', 'COBRA', 'VIPER', 'ORION', 'NOMAD', 'TALON', 'COMET', 'DELTA', 'ECHO', 'SABRE', 'PHOENIX', 'ORBIT', 'ARROW'];

const atcDir = (root) => path.join(root, '.atc');
const airspacePath = (root) => path.join(atcDir(root), 'airspace.json');
const emptyAirspace = () => ({ version: 1, flights: {} });

function git(args, cwd) {
  try { return execFileSync('git', args, { cwd, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return ''; }
}

function realpathLoose(p) {
  const rest = [];
  let cur = path.resolve(p);
  for (;;) {
    try { return path.join(fs.realpathSync(cur), ...rest.reverse()); } catch { /* climb */ }
    const parent = path.dirname(cur);
    if (parent === cur) return path.resolve(p);
    rest.push(path.basename(cur));
    cur = parent;
  }
}

// Top of the checkout (or linked worktree) that contains dir, found without spawning git.
function checkoutTop(dir) {
  let d = path.resolve(dir);
  for (;;) {
    if (fs.existsSync(path.join(d, '.git'))) return d;
    const p = path.dirname(d);
    if (p === d) return null;
    d = p;
  }
}

// Main repo root for a linked worktree (its .git is a file pointing at <main>/.git/worktrees/<name>).
function mainRootOf(top) {
  try {
    const gitPath = path.join(top, '.git');
    if (!fs.statSync(gitPath).isFile()) return top;
    const m = fs.readFileSync(gitPath, 'utf8').match(/^gitdir:\s*(.+)$/m);
    if (!m) return top;
    const gitdir = path.resolve(top, m[1].trim());
    const wt = path.dirname(gitdir);
    if (path.basename(wt) === 'worktrees') return path.dirname(path.dirname(wt));
  } catch { /* fall through */ }
  return top;
}

// Hook-side discovery: cheap, no git process. Returns { root, top } or null when no airspace exists.
function findAirspace(cwd) {
  const top = checkoutTop(cwd);
  if (!top) return null;
  const root = mainRootOf(top);
  if (!fs.existsSync(airspacePath(root))) return null;
  if (isTracked(root)) return null; // a committed airspace is planted, never trust it
  return { root: realpathLoose(root), top: realpathLoose(top) };
}

// CLI-side: the project root every session shares (main checkout, never a linked worktree).
function projectRoot(cwd) {
  const common = git(['rev-parse', '--path-format=absolute', '--git-common-dir'], cwd);
  if (common && path.basename(common) === '.git') return path.dirname(common);
  return git(['rev-parse', '--show-toplevel'], cwd) || null;
}

// True when anything under .atc/ is tracked in git (planted state shipped by a repo).
function isTracked(root) { return !!git(['ls-files', '--', '.atc'], root); }

const PLANTED = { ok: false, error: 'planted-airspace', message: '.atc/ is tracked in git, so its airspace is ignored. Remove it from the index (git rm -r --cached .atc) before using ATC.' };

// Strip control characters and cap the length, for any text taken from the airspace file.
function cleanText(v, max) {
  return String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}
const cleanCallsign = (v) => String(v == null ? '' : v).toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 16) || 'UNKNOWN';

function protect(root) {
  const dir = atcDir(root);
  if (isTracked(root)) return PLANTED;
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, '.gitignore'), '# atc: local coordination state, never commit\n*\n');
  return { ok: true };
}

function readAirspace(root) {
  try {
    const d = JSON.parse(fs.readFileSync(airspacePath(root), 'utf8'));
    if (d && typeof d === 'object' && d.flights && typeof d.flights === 'object') return d;
  } catch { /* missing or corrupt */ }
  return emptyAirspace();
}

// Live = well-formed lanes, a sane heartbeat (not in the future), under the idle expiry, and under the
// hard lifetime cap measured from claimedAt. Missing, future or absurd timestamps mean expired.
function isLive(f, now = Date.now()) {
  if (!f || typeof f !== 'object' || !Array.isArray(f.lanes)) return false;
  const hb = Number(f.heartbeat);
  const claimed = Number(f.claimedAt);
  if (!Number.isFinite(hb) || !Number.isFinite(claimed) || hb <= 0 || claimed <= 0) return false;
  if (hb > now + FUTURE_SLACK_MS || claimed > now + FUTURE_SLACK_MS) return false;
  return now - hb < EXPIRY_MS && now - claimed < MAX_FLIGHT_MS;
}
const ownedBy = (id, f, session) => id === session || (f && f.owner === session);

function sleep(ms) { try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); } catch { /* ignore */ } }

function withLock(root, fn, waitMs = LOCK_WAIT_MS) {
  const lock = path.join(atcDir(root), 'airspace.lock');
  const deadline = Date.now() + waitMs;
  const token = `${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}`;
  for (;;) {
    try { const fd = fs.openSync(lock, 'wx'); fs.writeSync(fd, token); fs.closeSync(fd); break; } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      // Break a stale lock by renaming it away: rename is atomic, so only one waiter wins.
      try {
        if (Date.now() - fs.statSync(lock).mtimeMs > LOCK_STALE_MS) {
          const gone = `${lock}.${token}.stale`;
          fs.renameSync(lock, gone);
          fs.unlinkSync(gone);
        }
      } catch { /* raced */ }
      if (Date.now() > deadline) throw new Error('airspace is busy (lock timeout)');
      sleep(5 + Math.floor(Math.random() * 25));
    }
  }
  try { return fn(); } finally {
    try { if (fs.readFileSync(lock, 'utf8') === token) fs.unlinkSync(lock); } catch { /* gone or not ours */ }
  }
}

// Read-modify-write under the lock; the write is temp file + rename so readers never see half a file.
function update(root, mutator, waitMs) {
  return withLock(root, () => {
    const data = readAirspace(root);
    const result = mutator(data);
    const tmp = path.join(atcDir(root), `airspace.json.${process.pid}.${Date.now()}.tmp`);
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n');
    fs.renameSync(tmp, airspacePath(root));
    return result;
  }, waitMs);
}

function pruneExpired(data, now = Date.now()) {
  for (const [id, f] of Object.entries(data.flights)) if (!isLive(f, now)) delete data.flights[id];
}

function makeCallsign(id, flights) {
  let h = 0;
  for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const taken = new Set(Object.values(flights).map((f) => f.callsign));
  for (let i = 0; i < 200; i++) {
    const n = h + i * 7;
    const cs = `${CALLSIGNS[n % CALLSIGNS.length]}-${(Math.floor(n / CALLSIGNS.length) % 9) + 1}`;
    if (!taken.has(cs)) return cs;
  }
  return `FLIGHT-${Object.keys(flights).length + 1}`;
}

module.exports = { EXPIRY_MS, MAX_FLIGHT_MS, PURPOSE_MAX, PLANTED, isTracked, cleanText, cleanCallsign, HEARTBEAT_MS, atcDir, airspacePath, git, realpathLoose, checkoutTop, findAirspace, projectRoot, protect, readAirspace, isLive, ownedBy, withLock, update, pruneExpired, makeCallsign };
