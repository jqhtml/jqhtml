#!/usr/bin/env node

/**
 * JQHTML CLI Test Runner
 *
 * Bundles a .jqhtml file with JQHTML core using Webpack (like RSpade does), compiling
 * templates through @jqhtml/webpack-loader, loads it in a browser via Playwright, and
 * outputs the rendered DOM and console logs.
 *
 * Usage: node test-runner.js <file.jqhtml>
 */

import fs from 'fs';
import path from 'path';
import http from 'http';
import crypto from 'crypto';
import { exec } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { chromium, firefox, webkit } from 'playwright';
import { require_browsers } from './check-browsers.js';

// Which engine runs the test: --browser=chromium|firefox|webkit, else the
// JQHTML_BROWSER environment variable (set by run-all-tests.sh / run-all-suites.sh
// --browser=...), else Chromium.
const ENGINES = { chromium, firefox, webkit };
let BROWSER_NAME = process.env.JQHTML_BROWSER || 'chromium';
for (const arg of process.argv) if (arg.startsWith('--browser=')) BROWSER_NAME = arg.split('=')[1];
if (!ENGINES[BROWSER_NAME]) {
  console.error(`Error: --browser must be one of chromium, firefox, webkit (got ${BROWSER_NAME})`);
  process.exit(1);
}
import webpack from 'webpack';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration defaults
const DEFAULT_PORT = 8989;

// Built bundles are cached here across runs: the 300 runs of the browser suite
// (100 tests x 3 cache modes) mostly re-bundle byte-identical code.
const BUNDLE_CACHE_DIR = '/tmp/jqhtml_bundle_cache';
const BUNDLE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// Parse command line args
let delaySeconds = 0;
// Check environment variable first (for parallel test runner), then fall back to default
let TEST_PORT = process.env.JQHTML_TEST_PORT ? parseInt(process.env.JQHTML_TEST_PORT, 10) : DEFAULT_PORT;
// Cache mode: 'none' (no caching), 'data' (data cache mode), 'html' (html cache mode)
// Check environment variable first (for parallel test runner), then fall back to 'none'
let CACHE_MODE = process.env.JQHTML_TEST_CACHE_MODE || 'none';
// Verdict gate opt-ins (see "The verdict gate" below). Each may also be declared from
// inside the page as window.__expect_boot_errors / __expect_page_errors / __dom_only.
let EXPECT_BOOT_ERRORS = false;
let EXPECT_PAGE_ERRORS = false;
let DOM_ONLY = false;
// How long to wait for the page to report its verdict before the run fails.
let VERDICT_TIMEOUT_SECONDS = 15;
const args = process.argv.slice(2);
const files = [];

for (const arg of args) {
  if (arg.startsWith('--delay=')) {
    delaySeconds = parseInt(arg.split('=')[1], 10);
    if (isNaN(delaySeconds) || delaySeconds < 0) {
      console.error('Error: --delay must be a positive number');
      process.exit(1);
    }
  } else if (arg.startsWith('--port=')) {
    TEST_PORT = parseInt(arg.split('=')[1], 10);
    if (isNaN(TEST_PORT) || TEST_PORT < 1024 || TEST_PORT > 65535) {
      console.error('Error: --port must be a number between 1024 and 65535');
      process.exit(1);
    }
  } else if (arg.startsWith('--browser=')) {
    // handled above (engine selection); not a file
  } else if (arg.startsWith('--timeout=')) {
    VERDICT_TIMEOUT_SECONDS = parseInt(arg.split('=')[1], 10);
    if (isNaN(VERDICT_TIMEOUT_SECONDS) || VERDICT_TIMEOUT_SECONDS < 1) {
      console.error('Error: --timeout must be a positive number of seconds');
      process.exit(1);
    }
  } else if (arg === '--expect-boot-errors') {
    EXPECT_BOOT_ERRORS = true;
  } else if (arg === '--expect-page-errors') {
    EXPECT_PAGE_ERRORS = true;
  } else if (arg === '--dom-only') {
    DOM_ONLY = true;
  } else if (arg.startsWith('--cache-mode=')) {
    CACHE_MODE = arg.split('=')[1];
    if (!['none', 'data', 'html'].includes(CACHE_MODE)) {
      console.error('Error: --cache-mode must be one of: none, data, html');
      process.exit(1);
    }
  } else {
    files.push(arg);
  }
}

const inputFile = files[0];
const dependencyFiles = files.slice(1);

if (!inputFile) {
  console.error('Usage: node test-runner.js <main.jqhtml> [dep1.jqhtml|dep1.js] [dep2.jqhtml|dep2.js] ... [options]');
  console.error('');
  console.error('Options:');
  console.error('  --delay=N          Observe the page for at least N seconds before capturing output');
  console.error('  --timeout=N        Fail if the page has not reported a verdict after N seconds (default: 15)');
  console.error('  --port=N           Use port N for HTTP server (default: 8989)');
  console.error('  --cache-mode=MODE  Set cache mode: none, data, html (default: none)');
  console.error('  --browser=ENGINE   chromium (default), firefox or webkit; or set JQHTML_BROWSER');
  console.error('  --expect-boot-errors  This test deliberately provokes component boot errors');
  console.error('  --expect-page-errors  This test deliberately raises uncaught page errors');
  console.error('  --dom-only         This test asserts by inspecting the printed DOM, not by logging a verdict');
  console.error('');
  console.error('  Dependencies can be .jqhtml files (compiled) or standalone .js files (loaded as-is)');
  process.exit(1);
}

if (!fs.existsSync(inputFile)) {
  console.error(`Error: File not found: ${inputFile}`);
  process.exit(1);
}

// Validate dependency files exist
for (const depFile of dependencyFiles) {
  if (!fs.existsSync(depFile)) {
    console.error(`Error: Dependency file not found: ${depFile}`);
    process.exit(1);
  }
}

const INPUT_FILE = path.resolve(inputFile);
const FILE_NAME = path.basename(INPUT_FILE, '.jqhtml');
// mkdtemp, not a timestamp: the parallel runner starts 8 of these at once, and two runs
// that started in the same millisecond used to share one directory - compiling over each
// other's entry.js/bundle.js, caching one test's bundle under another test's key, and
// deleting the directory out from under each other at cleanup.
const OUTPUT_DIR = fs.mkdtempSync(path.join('/tmp', 'jqhtml_test_'));
const ENTRY_JS = path.join(OUTPUT_DIR, 'entry.js');
const BUNDLE_JS = path.join(OUTPUT_DIR, 'bundle.js');
const HTML_FILE = path.join(OUTPUT_DIR, 'test.html');
const JQUERY_FILE = path.join(__dirname, '..', 'node_modules', 'jquery', 'dist', 'jquery.min.js');

const REPO_DIR = path.join(__dirname, '..');
// Templates are compiled by the real loader (packages/webpack-loader), not pre-compiled,
// so every browser test exercises it.
const LOADER_DIR = path.join(REPO_DIR, 'packages', 'webpack-loader');

/**
 * Name of the first <Define:> in a template (the component the loader compiles); a
 * paired .js class is registered under it. Comments are dropped first, as the lexer does.
 */
function templateName(file) {
  const source = fs.readFileSync(file, 'utf-8')
    .replace(/<%--[\s\S]*?--%>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '');
  const match = source.match(/<Define:([A-Za-z_$][\w$]*)/);
  return match ? match[1] : null;
}

/** The test's sources in registration order: dependencies first, the main template last. */
function collectSources() {
  const sources = dependencyFiles.map((depFile) => {
    const depPath = path.resolve(depFile);
    // Standalone .js dependency (no template)
    if (path.extname(depPath) === '.js') {
      return { templatePath: null, jsPath: depPath, name: path.basename(depPath, '.js') };
    }
    const depJsPath = depPath.replace(/\.jqhtml$/, '.js');
    return {
      templatePath: depPath,
      jsPath: fs.existsSync(depJsPath) ? depJsPath : null,
      name: path.basename(depPath, '.jqhtml')
    };
  });
  const mainJsPath = INPUT_FILE.replace(/\.jqhtml$/, '.js');
  const main = { templatePath: INPUT_FILE, jsPath: fs.existsSync(mainJsPath) ? mainJsPath : null, name: FILE_NAME };
  return { compiledDeps: sources, main };
}

function createEntryFile({ compiledDeps, main }) {
  console.log('📝 Creating webpack entry file...');
  for (const dep of compiledDeps) {
    console.log(dep.templatePath
      ? `✓ Dependency template: ${dep.name}${dep.jsPath ? ' (with JS class)' : ''}`
      : `✓ Loaded standalone JS: ${dep.name}`);
  }
  console.log(`✓ Main template: ${FILE_NAME}${main.jsPath ? ' (with JS class)' : ''}`);

  // Each template is imported, so webpack compiles it with the loader. Imports are
  // hoisted; a compiled template module only defines its template object, and is
  // registered below in the same order as before.
  const imports = [...compiledDeps.map((dep, i) => dep.templatePath && `import __template_dep_${i} from ${JSON.stringify(dep.templatePath)};`),
    `import __template_main from ${JSON.stringify(main.templatePath)};`].filter(Boolean).join('\n');

  // Create entry file that imports jqhtml core and the templates
  const entry = `
// Import jqhtml core (like RSpade does)
import jqhtml from '@jqhtml/core';
import { Jqhtml_Component } from '@jqhtml/core';
${imports}

// Set window.jqhtml before the JS classes below run; they extend Jqhtml_Component
window.jqhtml = jqhtml;
window.Jqhtml_Component = Jqhtml_Component;

console.log('✓ JQHTML Core loaded from bundle');

// Cache mode configuration.
// The mode is read from the PAGE (window.__JQHTML_TEST_CACHE_MODE__, set by an inline
// <script> in test.html) rather than baked in here, so one bundle serves all three
// modes and the bundle cache can be shared between them.
const __test_cache_mode = window.__JQHTML_TEST_CACHE_MODE__ || 'none';
if (__test_cache_mode === 'none') {
  console.log('✓ Cache mode: none (caching disabled)');
} else {
  jqhtml.set_cache_key('test_fixed_key', __test_cache_mode);
  console.log('✓ Cache mode: ' + __test_cache_mode);
}

// Enable verbose logging to see cache operations
if (typeof window !== 'undefined') {
  window.jqhtml = window.jqhtml || {};
  window.jqhtml.debug = window.jqhtml.debug || {};
  window.jqhtml.debug.verbose = true;
}

// Inline dependency JS classes and templates
${compiledDeps.map((dep, i) => {
  // Handle standalone .js files (no template)
  if (!dep.templatePath) {
    const jsCode = fs.readFileSync(dep.jsPath, 'utf-8');
    // Try to extract class name from the JS file
    const classMatch = jsCode.match(/class\s+(\w+)\s+extends/);
    const className = classMatch ? classMatch[1] : null;

    return `
// Dependency ${i + 1}: ${dep.name} (standalone JS)
try {
  ${jsCode}
  ${className ? `window.jqhtml.register_component('${className}', ${className});
  console.log('✓ Registered class: ${className}');` : ''}
  console.log('✓ Dependency ${i + 1} (${dep.name}) loaded');
} catch (error) {
  console.error('Dependency ${i + 1} (${dep.name}) error:', error.message);
  console.error('Stack:', error.stack);
}
`;
  }

  // Handle .jqhtml files with optional paired .js
  const jsCode = dep.jsPath ? fs.readFileSync(dep.jsPath, 'utf-8') : null;
  const componentName = templateName(dep.templatePath);

  return `
// Dependency ${i + 1}: ${dep.name}
try {
  ${jsCode && componentName ? `// Inline and register JS class
  ${jsCode}
  window.jqhtml.register_component('${componentName}', ${componentName});
  console.log('✓ Registered class: ${componentName}');
  ` : ''}
  // Register the template imported above
  window.jqhtml.register_template(__template_dep_${i});
  console.log('✓ Dependency ${i + 1} (${dep.name}) registered');
} catch (error) {
  console.error('Dependency ${i + 1} (${dep.name}) error:', error.message);
  console.error('Stack:', error.stack);
}
`;
}).join('\n')}

// Inline main template JS class and template
${(() => {
  const mainComponentName = templateName(main.templatePath);
  return `
try {
  ${main.jsPath && mainComponentName ? `// Inline and register main JS class
  ${fs.readFileSync(main.jsPath, 'utf-8')}
  window.jqhtml.register_component('${mainComponentName}', ${mainComponentName});
  console.log('✓ Registered main class: ${mainComponentName}');
  ` : ''}
  // Register the main template imported above
  window.jqhtml.register_template(__template_main);
  console.log('✓ Main template registered: ${mainComponentName}');
} catch (error) {
  console.error('Template registration error:', error.message);
  console.error('Stack:', error.stack);
}
`;
})()}

// Check registered templates (not components - components have JS classes)
const templates = window.jqhtml.get_registered_templates();
console.log('Registered templates count:', templates.length);
if (templates.length > 0) {
  // Render the LAST registered template (the main template)
  // Dependencies are registered first, main template is registered last
  const templateName = templates[templates.length - 1];
  console.log('Main template name:', templateName);
  console.log('All registered templates:', templates);

  const templateObj = window.jqhtml.get_template(templateName);
  console.log('Template object:', templateObj);
  console.log('Template name from obj:', templateObj?.name);

  if (templateName) {
    // Wait for DOM ready
    $(document).ready(function() {
      $('#app').component(templateName, {});
      console.log('Component rendered:', templateName);
    });
  } else {
    console.warn('No template name found!');
  }
} else {
  console.warn('No templates registered!');
}
`;

  fs.writeFileSync(ENTRY_JS, entry);
  console.log(`✓ Created entry file`);
}

/** Every regular file under `dir` (recursive), sorted, that `keep` accepts. */
function filesUnder(dir, keep) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...filesUnder(full, keep));
    else if (entry.isFile() && keep(full)) out.push(full);
  }
  return out.sort();
}

const IS_JS = (f) => /\.(c|m)?js$/.test(f);

/**
 * Identity of the bundle we are about to build: a hash of the CONTENTS of everything
 * that can change its bytes. Never mtimes - a git checkout or a hand edit can leave an
 * mtime/size pair unchanged while the code differs.
 *
 *   - the test's sources, in order and with their role: each template, its paired .js
 *     class, and standalone .js dependencies
 *   - this runner (it generates the webpack entry and holds the webpack config)
 *   - the @jqhtml/core build that is bundled (every .js under packages/core/dist)
 *   - the loader that turns templates into JS (packages/webpack-loader: package.json and
 *     every .js under src) and the compiler it calls (every .js under packages/parser/dist)
 *   - the lockfiles that pin webpack and the compiler's own dependencies
 *
 * The cache mode deliberately is NOT included - it reaches the page at runtime, so all
 * three modes share one bundle.
 */
function bundleCacheKey() {
  const h = crypto.createHash('sha256');
  h.update('jqhtml-bundle-v3');

  // Length-prefixed so that no two different input lists can hash the same stream.
  const add = (label, file) => {
    const data = fs.existsSync(file) ? fs.readFileSync(file) : null;
    h.update(`${label}\0${data ? data.length : -1}\0`);
    if (data) h.update(data);
  };

  const sources = [
    ...dependencyFiles.map((f) => ['dep', path.resolve(f)]),
    ['main', INPUT_FILE],
  ];
  for (const [role, file] of sources) {
    add(`${role}:${path.basename(file)}`, file);
    // A .jqhtml file may have a paired .js class that gets inlined with it.
    const paired = file.replace(/\.jqhtml$/, '.js');
    if (paired !== file) add(`${role}-class:${path.basename(paired)}`, paired);
  }

  add('runner', __filename);

  const core_dist = path.join(REPO_DIR, 'packages', 'core', 'dist');
  const parser_dir = path.join(REPO_DIR, 'packages', 'parser');
  const tool_inputs = [
    ...filesUnder(core_dist, IS_JS),
    path.join(LOADER_DIR, 'package.json'),
    ...filesUnder(path.join(LOADER_DIR, 'src'), IS_JS),
    ...filesUnder(path.join(parser_dir, 'dist'), IS_JS),
    path.join(__dirname, 'package-lock.json'),
    path.join(REPO_DIR, 'package-lock.json'),
  ];
  for (const file of tool_inputs) add(`tool:${path.relative(REPO_DIR, file)}`, file);

  return h.digest('hex');
}

/** Keep the cache bounded: drop anything untouched for a day. */
function pruneBundleCache() {
  if (!fs.existsSync(BUNDLE_CACHE_DIR)) return;
  const cutoff = Date.now() - BUNDLE_CACHE_TTL_MS;
  for (const name of fs.readdirSync(BUNDLE_CACHE_DIR)) {
    const file = path.join(BUNDLE_CACHE_DIR, name);
    try {
      if (fs.statSync(file).mtimeMs < cutoff) fs.unlinkSync(file);
    } catch { /* another runner pruned it first */ }
  }
}

/** Publish a freshly built bundle. Rename is atomic, so parallel runs cannot tear it. */
function saveBundleToCache(cacheFile) {
  try {
    fs.mkdirSync(BUNDLE_CACHE_DIR, { recursive: true });
    // The temp file sits in the cache directory (same filesystem, so the rename is
    // atomic) under a name no other run can pick.
    const tmp = `${cacheFile}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
    try {
      fs.copyFileSync(BUNDLE_JS, tmp);
      fs.renameSync(tmp, cacheFile);
    } finally {
      fs.rmSync(tmp, { force: true });
    }
  } catch (e) {
    console.log(`(bundle cache write skipped: ${e.message})`);
  }
}

async function bundleWithWebpack() {
  console.log('📦 Bundling with Webpack...');

  const compiler = webpack({
    mode: 'development',
    entry: ENTRY_JS,
    output: {
      path: OUTPUT_DIR,
      filename: 'bundle.js'
    },
    resolve: {
      alias: {
        '@jqhtml/core': path.join(__dirname, '..', 'packages', 'core', 'dist', 'index.js')
      }
    },
    module: {
      rules: [{ test: /\.jqhtml$/, loader: LOADER_DIR }]
    },
    externals: {
      'jquery': 'jQuery'
    }
  });

  return new Promise((resolve, reject) => {
    compiler.run((err, stats) => {
      if (err) {
        reject(err);
        return;
      }

      if (stats.hasErrors()) {
        reject(new Error(stats.toString('errors-only')));
        return;
      }

      console.log(`✓ Bundle created at ${BUNDLE_JS}`);
      resolve();
    });
  });
}

function createHTML() {
  console.log('📄 Creating test HTML...');

  // jQuery is served by our own server when the repo has it (same 3.7.1 build as the
  // CDN), so a test run makes no network request at all.
  const jquerySrc = fs.existsSync(JQUERY_FILE) ? 'jquery.js' : 'https://code.jquery.com/jquery-3.7.1.min.js';

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>JQHTML Test</title>
</head>
<body>
  <div id="app"></div>

  <!-- Cache mode for this run - read by the bundle and by test scripts -->
  <script>window.__JQHTML_TEST_CACHE_MODE__ = ${JSON.stringify(CACHE_MODE)};</script>

  <!-- Load jQuery first (external dependency) -->
  <script src="${jquerySrc}"></script>

  <!-- Load webpack bundle (contains jqhtml core + template) -->
  <script src="bundle.js"></script>
</body>
</html>`;

  fs.writeFileSync(HTML_FILE, html);
  console.log(`✓ Created ${HTML_FILE}`);
}

const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json', '.map': 'application/json', '.css': 'text/css' };

/**
 * Serve OUTPUT_DIR from this process. This used to spawn `python3 -m http.server` and
 * then poll with ss/curl until it answered - three processes and up to a second of
 * sleeping per test run, times 300 runs.
 */
async function startServer() {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(req.url.split('?')[0]);
    // jquery.js is virtual: it lives in the repo's node_modules, not in OUTPUT_DIR.
    const file = urlPath === '/jquery.js'
      ? JQUERY_FILE
      : path.join(OUTPUT_DIR, path.normalize(urlPath).replace(/^(\.\.[/\\])+/, ''));

    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); res.end('not found'); return; }
      // no-store: the same URL (localhost:PORT/bundle.js) serves different bytes on the
      // next test, and the browser is now shared between runs.
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      res.end(data);
    });
  });

  const listen = (port) => new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => { server.removeListener('error', reject); resolve(); });
  });

  // A port can still be held briefly by a previous run's socket; retry first.
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      await listen(TEST_PORT);
      console.log(`✓ Server running on http://127.0.0.1:${TEST_PORT}`);
      return server;
    } catch (e) {
      if (e.code !== 'EADDRINUSE') throw e;
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  // Still taken - typically a second suite running at the same time with the same port
  // numbers. Any free port will do: the page URL is built from TEST_PORT below.
  const wanted = TEST_PORT;
  await listen(0);
  TEST_PORT = server.address().port;
  console.log(`✓ Server running on http://127.0.0.1:${TEST_PORT} (port ${wanted} was in use)`);
  return server;
}

async function runTest() {
  console.log('🎭 Running Playwright test...');

  console.log(`🌐 Engine: ${BROWSER_NAME}`);
  require_browsers([BROWSER_NAME]);   // fatal, with install instructions, if the build is missing

  // The parallel runner launches ONE browser per engine and passes its websocket
  // endpoint; connecting to it saves a full browser start-up per test run. Each run
  // still gets its own browser context, so cookies/localStorage/etc. stay isolated
  // exactly as a freshly launched browser would be.
  const shared_ws = process.env.JQHTML_BROWSER_WS;
  const browser = shared_ws
    ? await ENGINES[BROWSER_NAME].connect(shared_ws)
    : await ENGINES[BROWSER_NAME].launch({ headless: true });
  console.log(shared_ws ? '✓ Connected to shared browser' : '✓ Launched browser');
  const context = await browser.newContext();
  const page = await context.newPage();

  const logs = [];
  const errors = [];

  page.on('console', msg => {
    logs.push(`[${msg.type()}] ${msg.text()}`);
  });

  page.on('pageerror', error => {
    errors.push(error.message);
  });

  // 127.0.0.1, the address the server is bound to: "localhost" may resolve to ::1, where
  // a different process could be listening on the same port number.
  await page.goto(`http://127.0.0.1:${TEST_PORT}/test.html`, { waitUntil: 'networkidle' });

  // Wait for the test's verdict: window.testPassed set (true or false) or a SUMMARY:
  // line logged. A page that reports neither within the timeout fails the run (rule d).
  // --delay is a MINIMUM observation window, not the wait itself: capture happens at the
  // verdict or at the end of the delay, whichever is later, so a test that keeps checking
  // after its SUMMARY line (e.g. "nothing else fired") is still observed exactly as long
  // as before.
  const started = Date.now();
  const dom_only_flag = DOM_ONLY || await page.evaluate(() => window.__dom_only === true);
  let verdict_reported = dom_only_flag;
  const deadline = started + VERDICT_TIMEOUT_SECONDS * 1000;
  while (!verdict_reported && Date.now() < deadline) {
    verdict_reported = logs.some((l) => SUMMARY_LINE.test(l))
      || await page.evaluate(() => window.testPassed !== undefined);
    if (!verdict_reported) await new Promise((resolve) => setTimeout(resolve, 50));
  }
  if (!verdict_reported) {
    console.log(`⏱️  No verdict after ${VERDICT_TIMEOUT_SECONDS}s`);
  }
  const remaining_delay = started + delaySeconds * 1000 - Date.now();
  if (remaining_delay > 0) {
    console.log(`⏱️  Observing ${(remaining_delay / 1000).toFixed(1)} more seconds (--delay=${delaySeconds}) before capturing output...`);
    await new Promise(resolve => setTimeout(resolve, remaining_delay));
  }

  // Get final DOM (outerHTML to include the component's root element)
  const dom = await page.evaluate(() => document.getElementById('app').outerHTML);

  // The verdict gate reads these; a test may declare its opt-ins from inside the page
  // instead of on the command line.
  const declared = await page.evaluate(() => ({
    testPassed: window.testPassed,
    expect_boot_errors: window.__expect_boot_errors === true,
    expect_page_errors: window.__expect_page_errors === true,
    dom_only: window.__dom_only === true,
  }));
  declared.verdict_reported = verdict_reported
    || declared.testPassed !== undefined || logs.some((l) => SUMMARY_LINE.test(l));

  await context.close();
  await browser.close();   // on a connected browser this just drops the connection

  return { logs, errors, dom, declared };
}

// ---------------------------------------------------------------------------
// The verdict gate
//
// Every test is judged HERE, identically, whatever its run-test.sh does. The process
// exits non-zero on a FAIL verdict, every run-test.sh propagates that exit code, and
// tests/parallel-test-runner.js additionally requires a "VERDICT: PASS" line.
//
// The run waits for the test's verdict (window.testPassed set, or a SUMMARY: line) for
// up to --timeout seconds; --delay is a minimum observation window on top of that.
//
// A run FAILS when any of these hold:
//   (a) the page set window.testPassed === false
//   (b) a console line matched "FAIL:" or "❌ FAIL"
//   (c) the page logged a component boot error ("[JQHTML Error]", "Error booting
//       component", "failed in boot") and the test did not opt in
//   (d) the page reported no verdict - neither window.testPassed nor a SUMMARY: line -
//       within the timeout, and the test did not declare --dom-only
//   (e) the page raised an uncaught error (Playwright "pageerror") and the test did
//       not opt in
//
// Opt-ins, each available as a CLI flag on test-runner.js or as a global the test sets
// before mounting:
//   --expect-boot-errors / window.__expect_boot_errors = true
//       the test deliberately provokes boot errors (child_boot_failure_releases_parent,
//       slot_inheritance_errors_surface, coordinator_error_and_cleanup, ...)
//   --expect-page-errors / window.__expect_page_errors = true
//       the test deliberately lets an error escape uncaught
//   --dom-only / window.__dom_only = true
//       the test asserts by inspecting the rendered DOM that is printed, not by logging
//       a verdict. Only legitimate when something else still checks the result.
// ---------------------------------------------------------------------------

const FAIL_LINE = /(^|\s)FAIL:|❌ FAIL/;
const SUMMARY_LINE = /(^|\s)SUMMARY:/;
const BOOT_ERROR_LINE = /\[JQHTML Error\]|Error booting component|failed in boot/;

function verdict(logs, errors, declared) {
  const expect_boot_errors = EXPECT_BOOT_ERRORS || declared.expect_boot_errors;
  const expect_page_errors = EXPECT_PAGE_ERRORS || declared.expect_page_errors;
  const dom_only = DOM_ONLY || declared.dom_only;

  if (declared.testPassed === false) return 'window.testPassed === false';

  const failed = logs.find((l) => FAIL_LINE.test(l));
  if (failed) return `assertion failed: ${failed.trim()}`;

  if (!expect_boot_errors) {
    const boot_error = logs.find((l) => BOOT_ERROR_LINE.test(l));
    if (boot_error) {
      return `component boot error: ${boot_error.trim()}`
        + ' (declare --expect-boot-errors if deliberate)';
    }
  }

  if (errors.length > 0 && !expect_page_errors) {
    return `uncaught page error: ${errors[0].split('\n')[0]}`
      + ' (declare --expect-page-errors if deliberate)';
  }

  if (!declared.verdict_reported && !dom_only) {
    return `test reported no verdict within ${VERDICT_TIMEOUT_SECONDS}s (no window.testPassed,`
      + ' no SUMMARY: line; declare --dom-only if it asserts by DOM inspection)';
  }

  return null;
}

/** Copy a cached bundle into OUTPUT_DIR; false when there is none (or it just vanished). */
function loadBundleFromCache(cacheFile) {
  try {
    fs.copyFileSync(cacheFile, BUNDLE_JS);
  } catch {
    return false;   // not cached, or another runner pruned it between our check and copy
  }
  try { fs.utimesSync(cacheFile, new Date(), new Date()); } catch { /* keep-alive only */ }
  return true;
}

async function main() {
  let server = null;
  let failed = false;

  try {
    pruneBundleCache();

    const cacheFile = path.join(BUNDLE_CACHE_DIR, `${bundleCacheKey()}.js`);
    if (loadBundleFromCache(cacheFile)) {   // the copy also keeps hot entries from expiring
      console.log(`📦 bundle: cached (cache mode: ${CACHE_MODE})`);
    } else {
      createEntryFile(collectSources());
      await bundleWithWebpack();
      saveBundleToCache(cacheFile);
      console.log(`📦 bundle: built (cache mode: ${CACHE_MODE})`);
    }

    createHTML();
    server = await startServer();

    const { logs, errors, dom, declared } = await runTest();

    console.log('\n' + '='.repeat(60));
    console.log('CONSOLE OUTPUT:');
    console.log('='.repeat(60));
    logs.forEach(log => console.log(log));

    if (errors.length > 0) {
      console.log('\n' + '='.repeat(60));
      console.log('ERRORS:');
      console.log('='.repeat(60));
      errors.forEach(err => console.error(err));
    }

    console.log('\n' + '='.repeat(60));
    console.log('RENDERED DOM:');
    console.log('='.repeat(60));
    console.log(dom);

    const reason = verdict(logs, errors, declared);
    if (reason) {
      console.log(`\nVERDICT: FAIL (${reason})`);
      process.exitCode = 1;
    } else {
      console.log('\nVERDICT: PASS');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.stack) console.error(error.stack);
    console.log(`\nVERDICT: FAIL (harness error: ${error.message.split('\n')[0]})`);
    failed = true;
  } finally {
    if (server) {
      server.closeAllConnections?.();   // playwright keeps the socket alive otherwise
      server.close();
    }

    // Cleanup temp directory
    if (OUTPUT_DIR.startsWith('/tmp/')) {
      await execAsync(`rm -rf "${OUTPUT_DIR}"`).catch(() => {});
    }
  }
  // Exit only after cleanup: a process.exit() inside catch skipped the finally block and
  // leaked the temp directory on every failed run.
  if (failed) process.exit(1);
}

main();
