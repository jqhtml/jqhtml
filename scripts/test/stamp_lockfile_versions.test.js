// Tests for scripts/stamp_lockfile_versions.js. Run: node --test scripts/test/stamp_lockfile_versions.test.js
import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCRIPT = path.join(REPO, 'scripts', 'stamp_lockfile_versions.js');

const made = [];
test.after(() => { for (const d of made) fs.rmSync(d, { recursive: true, force: true }); });

const json = (obj) => JSON.stringify(obj, null, 2) + '\n';
function write(dir, rel, obj) {
  fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
  fs.writeFileSync(path.join(dir, rel), typeof obj === 'string' ? obj : json(obj));
}

// A monorepo after the release bump: package.json files at 2.0.1, lockfile at 2.0.0.
function makeTree({ lockPackages = {}, extraWorkspaces = {} } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stamp-lock-'));
  made.push(dir);
  write(dir, 'package.json', { name: '@jqhtml/monorepo', version: '2.0.1', workspaces: ['packages/*'] });
  write(dir, 'packages/parser/package.json', { name: '@jqhtml/parser', version: '2.0.1', dependencies: { 'source-map': '^0.7.4' } });
  write(dir, 'packages/loader/package.json', { name: '@jqhtml/loader', version: '2.0.1', dependencies: { '@jqhtml/parser': '2.0.1' }, devDependencies: { webpack: '^5.96.1' } });
  for (const [rel, pkg] of Object.entries(extraWorkspaces)) write(dir, `${rel}/package.json`, pkg);
  write(dir, 'package-lock.json', {
    name: '@jqhtml/monorepo', version: '2.0.0', lockfileVersion: 3, requires: true,
    packages: {
      '': { name: '@jqhtml/monorepo', version: '2.0.0', workspaces: ['packages/*'] },
      'node_modules/@jqhtml/loader': { resolved: 'packages/loader', link: true },
      'node_modules/@jqhtml/parser': { resolved: 'packages/parser', link: true },
      'node_modules/source-map': { version: '0.7.4', resolved: 'https://registry.npmjs.org/source-map/-/source-map-0.7.4.tgz', integrity: 'sha512-x', license: 'BSD-3-Clause' },
      'node_modules/webpack': { version: '5.96.1', resolved: 'https://registry.npmjs.org/webpack/-/webpack-5.96.1.tgz', integrity: 'sha512-y', dev: true },
      'packages/loader': { name: '@jqhtml/loader', version: '2.0.0', dependencies: { '@jqhtml/parser': '2.0.0' }, devDependencies: { webpack: '^5.96.1' } },
      'packages/loader/node_modules/source-map': { version: '0.6.1', resolved: 'https://registry.npmjs.org/source-map/-/source-map-0.6.1.tgz', integrity: 'sha512-z' },
      'packages/parser': { name: '@jqhtml/parser', version: '2.0.0', dependencies: { 'source-map': '^0.7.4' } },
      ...lockPackages,
    },
  });
  return dir;
}

const run = (dir) => spawnSync(process.execPath, [SCRIPT, dir], { encoding: 'utf8' });
const lockText = (dir) => fs.readFileSync(path.join(dir, 'package-lock.json'), 'utf8');

test('stamps the root, workspace and @jqhtml/* pin versions and nothing else', () => {
  const dir = makeTree();
  const before = JSON.parse(lockText(dir));
  const r = run(dir);
  assert.strictEqual(r.status, 0, r.stderr);
  const after = JSON.parse(lockText(dir));
  assert.strictEqual(after.version, '2.0.1');
  assert.strictEqual(after.packages[''].version, '2.0.1');
  assert.strictEqual(after.packages['packages/parser'].version, '2.0.1');
  assert.strictEqual(after.packages['packages/loader'].version, '2.0.1');
  assert.deepStrictEqual(after.packages['packages/loader'].dependencies, { '@jqhtml/parser': '2.0.1' });
  // Everything else is untouched, including a nested package under a workspace.
  const expected = structuredClone(before);
  expected.version = '2.0.1';
  expected.packages[''].version = '2.0.1';
  expected.packages['packages/parser'].version = '2.0.1';
  expected.packages['packages/loader'].version = '2.0.1';
  expected.packages['packages/loader'].dependencies['@jqhtml/parser'] = '2.0.1';
  assert.deepStrictEqual(after, expected);
  assert.strictEqual(lockText(dir), json(expected), 'formatting and key order preserved');
});

test('a current lockfile is left byte-identical and not rewritten', () => {
  const dir = makeTree();
  assert.strictEqual(run(dir).status, 0);
  const text = lockText(dir);
  const mtime = fs.statSync(path.join(dir, 'package-lock.json')).mtimeMs;
  const r = run(dir);
  assert.strictEqual(r.status, 0, r.stderr);
  assert.match(r.stdout, /already current/);
  assert.strictEqual(lockText(dir), text);
  assert.strictEqual(fs.statSync(path.join(dir, 'package-lock.json')).mtimeMs, mtime);
});

function assertFailsUntouched(dir, pattern) {
  const text = lockText(dir);
  const r = run(dir);
  assert.strictEqual(r.status, 1, `expected failure, got ${r.status}: ${r.stdout}`);
  assert.match(r.stderr, pattern);
  assert.strictEqual(lockText(dir), text, 'lockfile must be untouched on failure');
}

test('fails, lockfile untouched, on a lockfile workspace with no package.json', () => {
  const dir = makeTree({ lockPackages: { 'packages/router': { name: '@jqhtml/router', version: '2.2.222', extraneous: true } } });
  assertFailsUntouched(dir, /packages\/router is in package-lock.json but has no package.json/);
});

test('fails, lockfile untouched, on a workspace with no lockfile entry', () => {
  const dir = makeTree({ extraWorkspaces: { 'packages/ssr': { name: '@jqhtml/ssr', version: '2.0.1' } } });
  assertFailsUntouched(dir, /packages\/ssr has a package.json but no package-lock.json entry/);
});

test('fails, lockfile untouched, when the @jqhtml/* dependency names differ', () => {
  const dir = makeTree();
  write(dir, 'packages/loader/package.json', { name: '@jqhtml/loader', version: '2.0.1', dependencies: { '@jqhtml/parser': '2.0.1', '@jqhtml/core': '2.0.1' } });
  assertFailsUntouched(dir, /packages\/loader: dependencies @jqhtml\/\* names differ/);
});

test('fails, lockfile untouched, when a workspace has no link entry', () => {
  const dir = makeTree({ lockPackages: { 'node_modules/@jqhtml/parser': undefined } }); // dropped by JSON
  assertFailsUntouched(dir, /no link entry node_modules\/@jqhtml\/parser -> packages\/parser/);
});

test("the repository's own lockfile matches its workspaces", () => {
  // Copy the repo's package.json files and lockfile; the stamper must accept them.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stamp-lock-repo-'));
  made.push(dir);
  fs.copyFileSync(path.join(REPO, 'package.json'), path.join(dir, 'package.json'));
  fs.copyFileSync(path.join(REPO, 'package-lock.json'), path.join(dir, 'package-lock.json'));
  for (const d of fs.readdirSync(path.join(REPO, 'packages'))) {
    const src = path.join(REPO, 'packages', d, 'package.json');
    if (fs.existsSync(src)) write(dir, `packages/${d}/package.json`, fs.readFileSync(src, 'utf8'));
  }
  const r = run(dir);
  assert.strictEqual(r.status, 0, r.stderr);
});
