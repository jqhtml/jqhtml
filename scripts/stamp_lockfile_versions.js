#!/usr/bin/env node
/*
 * stamp_lockfile_versions.js - bring the root package-lock.json's workspace versions in
 * step with the package.json files after the release version bump.
 *
 * Usage: node scripts/stamp_lockfile_versions.js [repo-root]   (default: this repo)
 *
 * Called by publish_internal_npm.sh after it bumps the package.json versions. It edits
 * only version fields: the lockfile's top-level "version", the "version" of the root
 * ("") and each workspace ("packages/<name>") entry, and the @jqhtml/* dependency
 * specs inside those entries (webpack-loader pins @jqhtml/parser exactly). Link
 * entries (node_modules/@jqhtml/<name>) carry no version and are only checked. Nothing
 * is resolved, nothing touches node_modules, nothing needs the network.
 *
 * `npm install --package-lock-only --offline` is not used: with the vendored
 * node_modules present it also rewrites node_modules/.package-lock.json.
 *
 * It fails (exit 1, lockfile untouched) when the lockfile's workspace set or @jqhtml/*
 * dependency names do not match the package.json files; stamping versions cannot fix
 * that, the lockfile needs a real refresh.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '..'));
const LOCK_PATH = path.join(ROOT, 'package-lock.json');
const DEP_FIELDS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const errors = [];
const changes = [];

const lock = readJson(LOCK_PATH);
if (lock.lockfileVersion !== 3) {
  console.error(`ERROR: ${LOCK_PATH}: lockfileVersion ${lock.lockfileVersion}, expected 3`);
  process.exit(1);
}
const entries = lock.packages || {};

// Workspace entries are the lockfile keys outside any node_modules folder.
const lockWorkspaces = Object.keys(entries).filter((k) => k !== '' && !/(^|\/)node_modules\//.test(k));

// Workspaces on disk, from the root package.json's "dir/*" globs and literal paths.
const rootPkg = readJson(path.join(ROOT, 'package.json'));
const diskWorkspaces = [];
for (const pattern of rootPkg.workspaces || []) {
  const pat = pattern.replace(/\/+$/, '').replace(/^\.\//, '');
  let dirs;
  if (/^[^*?[\]{}]+\/\*$/.test(pat)) {
    const base = pat.slice(0, -2);
    dirs = fs.existsSync(path.join(ROOT, base))
      ? fs.readdirSync(path.join(ROOT, base), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => `${base}/${d.name}`)
      : [];
  } else if (!/[*?[\]{}]/.test(pat)) {
    dirs = [pat];
  } else {
    console.error(`ERROR: workspace pattern "${pattern}" is not supported (only "dir/*" and literal paths)`);
    process.exit(1);
  }
  for (const d of dirs) {
    if (fs.existsSync(path.join(ROOT, d, 'package.json'))) diskWorkspaces.push(d);
  }
}

for (const dir of lockWorkspaces) {
  if (!diskWorkspaces.includes(dir)) errors.push(`${dir} is in package-lock.json but has no package.json`);
}
for (const dir of diskWorkspaces) {
  if (!entries[dir]) errors.push(`${dir} has a package.json but no package-lock.json entry`);
}

function stamp(loc, pkg) {
  const e = entries[loc];
  const where = loc || '(root)';
  if (loc !== '') {
    if (e.name !== pkg.name) errors.push(`${where}: lockfile name ${e.name}, package.json name ${pkg.name}`);
    const link = entries[`node_modules/${pkg.name}`];
    if (!link || !link.link || link.resolved !== loc) errors.push(`${where}: no link entry node_modules/${pkg.name} -> ${loc}`);
  }
  if (e.version !== pkg.version) {
    changes.push(`${where} version ${e.version} -> ${pkg.version}`);
    e.version = pkg.version;
  }
  for (const field of DEP_FIELDS) {
    const want = Object.keys(pkg[field] || {}).filter((n) => n.startsWith('@jqhtml/')).sort();
    const have = Object.keys(e[field] || {}).filter((n) => n.startsWith('@jqhtml/')).sort();
    if (want.join() !== have.join()) {
      errors.push(`${where}: ${field} @jqhtml/* names differ (package.json: ${want.join(', ') || 'none'}; lockfile: ${have.join(', ') || 'none'})`);
      continue;
    }
    for (const name of want) {
      if (e[field][name] !== pkg[field][name]) {
        changes.push(`${where} ${field} ${name} ${e[field][name]} -> ${pkg[field][name]}`);
        e[field][name] = pkg[field][name];
      }
    }
  }
}

if (!entries['']) errors.push('package-lock.json has no root ("") entry');
else stamp('', rootPkg);
for (const dir of diskWorkspaces) {
  if (entries[dir]) stamp(dir, readJson(path.join(ROOT, dir, 'package.json')));
}

if (errors.length) {
  console.error('ERROR: package-lock.json does not match the package.json files; versions not stamped:');
  for (const msg of errors) console.error(`  - ${msg}`);
  console.error('Refresh the lockfile (npm install --package-lock-only --offline on a copy without');
  console.error('node_modules, then copy package-lock.json back), commit it, and release again.');
  process.exit(1);
}

if (lock.version !== rootPkg.version) {
  changes.unshift(`lockfile version ${lock.version} -> ${rootPkg.version}`);
  lock.version = rootPkg.version;
}

if (changes.length) fs.writeFileSync(LOCK_PATH, JSON.stringify(lock, null, 2) + '\n');
console.log(`package-lock.json: ${changes.length ? changes.join('; ') : 'already current'}`);
