#!/usr/bin/env node
/**
 * Verify that the Playwright browser builds a test run needs are installed,
 * and fail with the exact command to install them if not.
 *
 *   node check-browsers.js chromium firefox     # exit 1 with instructions if any is missing
 *
 * Also used by test-runner.js before it launches. Playwright resolves each
 * engine to a versioned directory under ~/.cache/ms-playwright; a missing or
 * mismatched version shows up as a missing executable.
 */
import fs from 'fs';
import { chromium, firefox, webkit } from 'playwright';

const ENGINES = { chromium, firefox, webkit };

export function missing_browsers(names) {
  const missing = [];
  for (const name of names) {
    const engine = ENGINES[name];
    if (!engine) { missing.push({ name, reason: `unknown engine "${name}" (chromium, firefox, webkit)` }); continue; }
    const exe = engine.executablePath();
    if (!fs.existsSync(exe)) missing.push({ name, reason: `executable not found at ${exe}` });
  }
  return missing;
}

export function require_browsers(names) {
  const missing = missing_browsers(names);
  if (missing.length === 0) return;
  const installable = missing.filter((m) => ENGINES[m.name]).map((m) => m.name);
  console.error('');
  console.error('ERROR: the browser engine(s) this test run needs are not installed:');
  for (const m of missing) console.error(`  - ${m.name}: ${m.reason}`);
  if (installable.length) {
    console.error('');
    console.error('Install them with Playwright (downloads the build and any system libraries):');
    console.error('');
    console.error(`  cd ${new URL('.', import.meta.url).pathname} && npx playwright install --with-deps ${installable.join(' ')}`);
    console.error('');
    console.error('Builds live under ~/.cache/ms-playwright; a Playwright upgrade needs a re-install.');
  }
  console.error('');
  process.exit(1);
}

if (process.argv[1] && process.argv[1].endsWith('check-browsers.js')) {
  const names = process.argv.slice(2);
  if (!names.length) { console.error('usage: check-browsers.js <engine>...'); process.exit(2); }
  require_browsers(names);
  console.log(`browsers available: ${names.join(', ')}`);
}
