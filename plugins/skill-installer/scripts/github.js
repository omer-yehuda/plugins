'use strict';
/* Read files from GitHub without running anything: one tree API call plus raw downloads, with a hardened
   sparse git clone as the fallback for private repos or API limits. Adapted from OpenAI's Codex
   skill-installer (Apache-2.0); see NOTICE. */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { InstallError } = require('./source');

const UA = 'claude-skill-installer';
const MAX_FILES = 300;
const MAX_BYTES = 10 * 1024 * 1024;

function headers(api, accept) {
  const h = { 'User-Agent': UA };
  if (accept) h.Accept = accept;
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (token && api) h.Authorization = `Bearer ${token}`;
  return h;
}

async function get(url, api, accept) {
  let res;
  try { res = await fetch(url, { headers: headers(api, accept), redirect: 'follow' }); } catch (e) {
    const err = new InstallError(`Network error for ${new URL(url).hostname}: ${e.cause ? e.cause.code || e.cause.message : e.message}`);
    err.network = true; throw err;
  }
  if (!res.ok) { const err = new InstallError(`HTTP ${res.status} for ${url}`); err.status = res.status; throw err; }
  return Buffer.from(await res.arrayBuffer());
}

const enc = (p) => p.split('/').map(encodeURIComponent).join('/');

const SHA_RE = /^[0-9a-f]{40}$/;

// Resolve the branch or tag to one commit, so the tree and every file come from the same snapshot.
async function apiCommit(src) {
  const url = `https://api.github.com/repos/${src.owner}/${src.repo}/commits/${encodeURIComponent(src.ref)}`;
  const sha = (await get(url, true, 'application/vnd.github.sha')).toString('utf8').trim();
  if (!SHA_RE.test(sha)) throw new InstallError('Unexpected commit response from GitHub.');
  return sha;
}

async function apiTree(src) {
  const url = `https://api.github.com/repos/${src.owner}/${src.repo}/git/trees/${encodeURIComponent(src.ref)}?recursive=1`;
  const data = JSON.parse((await get(url, true)).toString('utf8'));
  if (!Array.isArray(data.tree)) throw new InstallError('Unexpected tree response from GitHub.');
  return data.tree.map((t) => ({ path: t.path, type: t.type, mode: t.mode, size: t.size || 0 }));
}

function gitTree(src, dir) {
  const repoDir = path.join(dir, 'repo');
  const url = `https://github.com/${src.owner}/${src.repo}.git`;
  const git = (args) => execFileSync('git', ['-c', 'core.symlinks=false', '-c', 'core.hooksPath=' + os.devNull,
    '-c', 'protocol.file.allow=never', ...args], { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_LFS_SKIP_SMUDGE: '1' } });
  try {
    git(['clone', '--depth', '1', '--filter=blob:none', '--no-checkout', '--single-branch', '--branch', src.ref, '--', url, repoDir]);
    git(['-C', repoDir, 'checkout', '--quiet']);
  } catch (e) {
    throw new InstallError(`git clone failed: ${String(e.stderr || e.message).trim().split('\n').pop()}`);
  }
  const commit = git(['-C', repoDir, 'rev-parse', 'HEAD']).toString('utf8').trim();
  return { tree: localTree(repoDir), commit: SHA_RE.test(commit) ? commit : null };
}

// A source with .local reads a folder on disk (tests and offline use).
function localTree(root) {
  const out = [];
  (function walk(d, rel) {
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      if (ent.name === '.git') continue;
      const r = rel ? `${rel}/${ent.name}` : ent.name;
      const full = path.join(d, ent.name);
      const st = fs.lstatSync(full);
      if (st.isDirectory()) { out.push({ path: r, type: 'tree', mode: '040000' }); walk(full, r); }
      else out.push({ path: r, type: 'blob', mode: st.isSymbolicLink() ? '120000' : '100644', size: st.size, local: full });
    }
  })(root, '');
  return out;
}

class Repo {
  constructor(src, method = 'auto') { this.src = src; this.method = method; this.tree = null; this.tmp = null; this.via = null; this.commit = null; }

  async load() {
    if (this.tree) return this.tree;
    if (this.src.local) { this.tree = localTree(this.src.local); this.via = 'local'; return this.tree; }
    if (this.method !== 'git') {
      try {
        const commit = await apiCommit(this.src);
        this.tree = await apiTree({ ...this.src, ref: commit }); this.commit = commit; this.via = 'api'; return this.tree;
      } catch (e) {
        if (this.method === 'api' || !(e.network || [401, 403, 404, 429].includes(e.status))) throw e;
      }
    }
    this.tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-installer-git-'));
    const g = gitTree(this.src, this.tmp);
    this.tree = g.tree; this.commit = g.commit; this.via = 'git';
    return this.tree;
  }

  // Folders under `base` that hold a SKILL.md.
  async skillDirs(base = '') {
    const tree = await this.load();
    const pre = base ? `${base}/` : '';
    return tree.filter((t) => t.type === 'blob' && (t.path === `${pre}SKILL.md` || (t.path.startsWith(pre) && t.path.endsWith('/SKILL.md'))))
      .map((t) => path.posix.dirname(t.path)).map((d) => (d === '.' ? '' : d)).sort();
  }

  // Every file of one skill folder, as [{ rel, buf }]. Refuses symlinks, submodules and oversize skills.
  async files(dir) {
    const tree = await this.load();
    const pre = dir ? `${dir}/` : '';
    const items = tree.filter((t) => t.path.startsWith(pre) && t.type !== 'tree');
    if (!items.some((t) => t.path === `${pre}SKILL.md`)) throw new InstallError(`No SKILL.md in ${dir || 'repo root'}.`);
    const bad = items.find((t) => t.type === 'commit' || t.mode === '120000');
    if (bad) throw new InstallError(`Refusing ${bad.path}: symlinks and submodules are not installed.`);
    if (items.length > MAX_FILES) throw new InstallError(`Skill has ${items.length} files (limit ${MAX_FILES}).`);
    const total = items.reduce((n, t) => n + (t.size || 0), 0);
    if (total > MAX_BYTES) throw new InstallError(`Skill is ${(total / 1048576).toFixed(1)} MB (limit 10 MB).`);
    const out = [];
    for (let i = 0; i < items.length; i += 8) { // 8 downloads at a time
      out.push(...await Promise.all(items.slice(i, i + 8).map(async (t) => ({
        rel: t.path.slice(pre.length),
        buf: t.local ? fs.readFileSync(t.local)
          : await get(`https://raw.githubusercontent.com/${this.src.owner}/${this.src.repo}/${enc(this.commit || this.src.ref)}/${enc(t.path)}`, false),
      }))));
    }
    return out;
  }

  async raw(p) {
    const tree = await this.load();
    const t = tree.find((x) => x.path === p && x.type === 'blob');
    if (!t) throw new InstallError(`${p} not found in ${this.src.owner}/${this.src.repo}.`);
    if (t.local) return fs.readFileSync(t.local);
    return get(`https://raw.githubusercontent.com/${this.src.owner}/${this.src.repo}/${enc(this.commit || this.src.ref)}/${enc(p)}`, false);
  }

  close() { if (this.tmp) fs.rmSync(this.tmp, { recursive: true, force: true }); }
}

module.exports = { Repo, MAX_FILES, MAX_BYTES };
