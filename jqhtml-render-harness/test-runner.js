#!/usr/bin/env node

/**
 * JQHTML CLI Test Runner
 *
 * Compiles a .jqhtml file, bundles it with JQHTML core using Webpack (like RSpade does),
 * loads it in a browser via Playwright, and outputs the rendered DOM and console logs.
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
// Verdict gate opt-ins (see "The verdict gate" below). Either may also be declared from
// inside the page as window.__expect_boot_errors / window.__dom_only.
let EXPECT_BOOT_ERRORS = false;
let DOM_ONLY = false;
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
  } else if (arg === '--expect-boot-errors') {
    EXPECT_BOOT_ERRORS = true;
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
  console.error('  --delay=N          Wait N seconds before capturing output');
  console.error('  --port=N           Use port N for HTTP server (default: 8989)');
  console.error('  --cache-mode=MODE  Set cache mode: none, data, html (default: none)');
  console.error('  --browser=ENGINE   chromium (default), firefox or webkit; or set JQHTML_BROWSER');
  console.error('  --expect-boot-errors  This test deliberately provokes component boot errors');
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
const OUTPUT_DIR = path.join('/tmp', `jqhtml_test_${Date.now()}`);
const COMPILED_TEMPLATE = path.join(OUTPUT_DIR, `${FILE_NAME}.js`);
const ENTRY_JS = path.join(OUTPUT_DIR, 'entry.js');
const BUNDLE_JS = path.join(OUTPUT_DIR, 'bundle.js');
const HTML_FILE = path.join(OUTPUT_DIR, 'test.html');
const JQUERY_FILE = path.join(__dirname, '..', 'node_modules', 'jquery', 'dist', 'jquery.min.js');

async function compileTemplate() {
  console.log('🔨 Compiling JQHTML templates...');

  const compilerPath = path.join(__dirname, '..', 'packages', 'parser', 'bin', 'jqhtml-compile');
  const compiledDeps = [];

  // Compile dependency templates first
  for (const depFile of dependencyFiles) {
    const depPath = path.resolve(depFile);
    const depExt = path.extname(depPath);

    // Handle standalone .js files
    if (depExt === '.js') {
      const depName = path.basename(depPath, '.js');
      compiledDeps.push({
        templatePath: null,
        jsPath: depPath,
        name: depName
      });
      console.log(`✓ Loaded standalone JS: ${depName}`);
      continue;
    }

    // Handle .jqhtml files
    const depName = path.basename(depPath, '.jqhtml');
    const depOutput = path.join(OUTPUT_DIR, `dep_${depName}.js`);

    const cmd = `node "${compilerPath}" --sourcemap "${depPath}" > "${depOutput}"`;
    await execAsync(cmd);

    // Check for paired .js file
    const depJsPath = depPath.replace(/\.jqhtml$/, '.js');
    const hasJsFile = fs.existsSync(depJsPath);

    compiledDeps.push({
      templatePath: depOutput,
      jsPath: hasJsFile ? depJsPath : null,
      name: depName
    });
    console.log(`✓ Compiled dependency: ${depName}${hasJsFile ? ' (with JS class)' : ''}`);
  }

  // Compile main template to JS
  const cmd = `node "${compilerPath}" --sourcemap "${INPUT_FILE}" > "${COMPILED_TEMPLATE}"`;
  await execAsync(cmd);

  // Check for paired .js file for main template
  const mainJsPath = INPUT_FILE.replace(/\.jqhtml$/, '.js');
  const hasMainJsFile = fs.existsSync(mainJsPath);

  console.log(`✓ Compiled main template: ${FILE_NAME}${hasMainJsFile ? ' (with JS class)' : ''}`);

  return { compiledDeps, mainJsPath: hasMainJsFile ? mainJsPath : null };
}

function createEntryFile({ compiledDeps = [], mainJsPath = null }) {
  console.log('📝 Creating webpack entry file...');

  // Read main compiled template
  const templateCode = fs.readFileSync(COMPILED_TEMPLATE, 'utf-8');

  // Helper function to extract component name from compiled template code
  function extractTemplateName(compiledCode) {
    // Look for: name: 'ComponentName',
    const match = compiledCode.match(/name:\s*['"]([^'"]+)['"]/);
    if (match) {
      return match[1];
    }
    return null;
  }

  // Create entry file that imports jqhtml core and inlines all templates
  // This replicates how RSpade bundles everything together
  const entry = `
// Import jqhtml core (like RSpade does)
import jqhtml from '@jqhtml/core';
import { Jqhtml_Component } from '@jqhtml/core';

// CRITICAL: Set window.jqhtml BEFORE template code runs
// Template IIFEs execute immediately and expect window.jqhtml to exist
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
  const depTemplateCode = fs.readFileSync(dep.templatePath, 'utf-8');
  const jsCode = dep.jsPath ? fs.readFileSync(dep.jsPath, 'utf-8') : null;
  const componentName = extractTemplateName(depTemplateCode);

  return `
// Dependency ${i + 1}: ${dep.name}
try {
  ${jsCode && componentName ? `// Inline and register JS class
  ${jsCode}
  window.jqhtml.register_component('${componentName}', ${componentName});
  console.log('✓ Registered class: ${componentName}');
  ` : ''}
  // Inline compiled template and register explicitly
  ${depTemplateCode}
  window.jqhtml.register_template(template_${componentName});
  console.log('✓ Dependency ${i + 1} (${dep.name}) registered');
} catch (error) {
  console.error('Dependency ${i + 1} (${dep.name}) error:', error.message);
  console.error('Stack:', error.stack);
}
`;
}).join('\n')}

// Inline main template JS class and template
${(() => {
  const mainComponentName = extractTemplateName(templateCode);
  return `
try {
  ${mainJsPath && mainComponentName ? `// Inline and register main JS class
  ${fs.readFileSync(mainJsPath, 'utf-8')}
  window.jqhtml.register_component('${mainComponentName}', ${mainComponentName});
  console.log('✓ Registered main class: ${mainComponentName}');
  ` : ''}
  // Inline compiled template and register explicitly
  ${templateCode}
  window.jqhtml.register_template(template_${mainComponentName});
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
      window.testReady = true;
    });
  } else {
    console.warn('No template name found!');
    window.testReady = true;
  }
} else {
  console.warn('No templates registered!');
  window.testReady = true;
}
`;

  fs.writeFileSync(ENTRY_JS, entry);
  console.log(`✓ Created entry file`);
}

/**
 * Identity of the bundle we are about to build. Anything that can change the bundle's
 * bytes has to be in here: the template/JS sources, the compiler that turns them into
 * JS, and the @jqhtml/core build they are bundled against. The cache mode deliberately
 * is NOT - it reaches the page at runtime, so all three modes share one bundle.
 */
function bundleCacheKey() {
  const h = crypto.createHash('sha256');
  h.update('jqhtml-bundle-v1');

  const sources = [INPUT_FILE, ...dependencyFiles.map((f) => path.resolve(f))];
  for (const file of sources) {
    h.update(path.basename(file));
    h.update(fs.readFileSync(file));
    // A .jqhtml file may have a paired .js class that gets inlined with it.
    const paired = file.replace(/\.jqhtml$/, '.js');
    if (paired !== file && fs.existsSync(paired)) h.update(fs.readFileSync(paired));
  }

  // Built artefacts are large; their mtime+size is enough to notice a rebuild.
  for (const build of [
    path.join(__dirname, '..', 'packages', 'core', 'dist', 'index.js'),
    path.join(__dirname, '..', 'packages', 'parser', 'dist', 'compiler.js'),
  ]) {
    const st = fs.existsSync(build) ? fs.statSync(build) : null;
    h.update(st ? `${build}:${st.mtimeMs}:${st.size}` : `${build}:missing`);
  }
  h.update(String(fs.statSync(__filename).mtimeMs));   // this runner generates the entry file

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
    const tmp = `${cacheFile}.${process.pid}.tmp`;
    fs.copyFileSync(BUNDLE_JS, tmp);
    fs.renameSync(tmp, cacheFile);
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

  // A port can still be held briefly by a previous run's socket; retry rather than fail.
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(TEST_PORT, '127.0.0.1', () => { server.removeListener('error', reject); resolve(); });
      });
      console.log(`✓ Server running on http://localhost:${TEST_PORT}`);
      return server;
    } catch (e) {
      if (e.code !== 'EADDRINUSE') throw e;
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  throw new Error(`Port ${TEST_PORT} is still in use`);
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

  await page.goto(`http://localhost:${TEST_PORT}/test.html`, { waitUntil: 'networkidle' });

  // Wait for test to be ready
  await page.waitForFunction(() => window.testReady, { timeout: 5000 });

  // Additional delay if specified (allows async operations to complete)
  if (delaySeconds > 0) {
    console.log(`⏱️  Waiting ${delaySeconds} additional seconds before capturing output...`);
    await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));
  }

  // Get final DOM (outerHTML to include the component's root element)
  const dom = await page.evaluate(() => document.getElementById('app').outerHTML);

  // The verdict gate reads these; a test may declare its opt-ins from inside the page
  // instead of on the command line.
  const declared = await page.evaluate(() => ({
    testPassed: window.testPassed,
    expect_boot_errors: window.__expect_boot_errors === true,
    dom_only: window.__dom_only === true,
  }));

  await context.close();
  await browser.close();   // on a connected browser this just drops the connection

  return { logs, errors, dom, declared };
}

// ---------------------------------------------------------------------------
// The verdict gate
//
// Every test is judged HERE, identically, whatever its run-test.sh does. 84 of the
// ~115 run-test.sh scripts used to exit 0 unconditionally, so a component that died
// at boot or an assertion that printed FAIL still scored green.
//
// A run FAILS when any of these hold:
//   (a) the page set window.testPassed === false
//   (b) a console line matched "FAIL:" or "❌ FAIL"
//   (c) the page logged a component boot error ("[JQHTML Error]", "Error booting
//       component", "failed in boot") and the test did not opt in
//   (d) the page produced NO verdict at all - no SUMMARY line, no window.testPassed,
//       no PASS line - and the test did not declare --dom-only
//
// Opt-ins, each available as a CLI flag on test-runner.js or as a global the test sets
// before mounting:
//   --expect-boot-errors / window.__expect_boot_errors = true
//       the test deliberately provokes boot errors (child_boot_failure_releases_parent,
//       slot_inheritance_errors_surface, coordinator_error_and_cleanup, ...)
//   --dom-only / window.__dom_only = true
//       the test asserts by inspecting the rendered DOM that is printed, not by logging
//       a verdict. Only legitimate when something else still checks the result.
// ---------------------------------------------------------------------------

const FAIL_LINE = /(^|\s)FAIL:|❌ FAIL/;
const PASS_LINE = /(^|\s)PASS:|✅ PASS/;
const SUMMARY_LINE = /(^|\s)SUMMARY:/;
const BOOT_ERROR_LINE = /\[JQHTML Error\]|Error booting component|failed in boot/;

function verdict(logs, declared) {
  const expect_boot_errors = EXPECT_BOOT_ERRORS || declared.expect_boot_errors;
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

  const reported = logs.some((l) => SUMMARY_LINE.test(l) || PASS_LINE.test(l))
    || declared.testPassed === true;
  if (!reported && !dom_only) {
    return 'test produced no verdict (no SUMMARY, no PASS line, no window.testPassed;'
      + ' declare --dom-only if it asserts by DOM inspection)';
  }

  return null;
}

async function main() {
  let server = null;

  try {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    pruneBundleCache();

    const cacheFile = path.join(BUNDLE_CACHE_DIR, `${bundleCacheKey()}.js`);
    if (fs.existsSync(cacheFile)) {
      fs.copyFileSync(cacheFile, BUNDLE_JS);
      fs.utimesSync(cacheFile, new Date(), new Date());   // keep hot entries from expiring
      console.log(`📦 bundle: cached (cache mode: ${CACHE_MODE})`);
    } else {
      const compilationResult = await compileTemplate();
      createEntryFile(compilationResult);
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

    const reason = verdict(logs, declared);
    if (reason) {
      console.log(`\nVERDICT: FAIL (${reason})`);
      process.exitCode = 1;
    } else {
      console.log('\nVERDICT: PASS');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.stack) console.error(error.stack);
    process.exit(1);
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
}

main();
