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
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import webpack from 'webpack';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration defaults
const DEFAULT_PORT = 8989;

// Parse command line args
let delaySeconds = 0;
// Check environment variable first (for parallel test runner), then fall back to default
let TEST_PORT = process.env.JQHTML_TEST_PORT ? parseInt(process.env.JQHTML_TEST_PORT, 10) : DEFAULT_PORT;
// Cache mode: 'none' (no caching), 'data' (data cache mode), 'html' (html cache mode)
// Check environment variable first (for parallel test runner), then fall back to 'none'
let CACHE_MODE = process.env.JQHTML_TEST_CACHE_MODE || 'none';
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

async function compileTemplate() {
  console.log(`🔨 Compiling JQHTML templates... (cache mode: ${CACHE_MODE})`);

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

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

// Cache mode configuration (injected by test runner)
// Mode: '${CACHE_MODE}' (none = no caching, data = data mode, html = html mode)
window.__JQHTML_TEST_CACHE_MODE__ = '${CACHE_MODE}';
${CACHE_MODE === 'none' ? `
// No cache mode - don't call set_cache_key()
console.log('✓ Cache mode: none (caching disabled)');
` : CACHE_MODE === 'data' ? `
// Data cache mode
jqhtml.set_cache_key('test_fixed_key', 'data');
console.log('✓ Cache mode: data');
` : `
// HTML cache mode
jqhtml.set_cache_key('test_fixed_key', 'html');
console.log('✓ Cache mode: html');
`}

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

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>JQHTML Test</title>
</head>
<body>
  <div id="app"></div>

  <!-- Load jQuery first (external dependency) -->
  <script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>

  <!-- Load webpack bundle (contains jqhtml core + template) -->
  <script src="bundle.js"></script>
</body>
</html>`;

  fs.writeFileSync(HTML_FILE, html);
  console.log(`✓ Created ${HTML_FILE}`);
}

async function startServer() {
  console.log('🌐 Starting server...');

  // Kill any existing server on port
  await execAsync(`ps ax | grep "python.*${TEST_PORT}" | grep -v grep | awk '{print $1}' | xargs -r kill -9 2>/dev/null || true`);

  // Wait for port to be free
  let attempts = 0;
  while (attempts < 50) {
    const { stdout } = await execAsync(`ss -tlnp 2>/dev/null | grep :${TEST_PORT} || echo "PORT_FREE"`);
    if (stdout.trim() === "PORT_FREE") break;
    await new Promise(resolve => setTimeout(resolve, 100));
    attempts++;
  }

  // Start simple python server
  const server = spawn('python3', ['-m', 'http.server', TEST_PORT.toString()], {
    cwd: OUTPUT_DIR,
    detached: false,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  // Wait for server to start
  attempts = 0;
  while (attempts < 50) {
    try {
      await execAsync(`curl -s --connect-timeout 0.1 --max-time 0.1 -o /dev/null -w "%{http_code}" http://localhost:${TEST_PORT}/ | grep -E "^[23]"`);
      break;
    } catch (e) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
  }

  console.log(`✓ Server running on http://localhost:${TEST_PORT}`);
  return server;
}

async function runTest() {
  console.log('🎭 Running Playwright test...');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

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

  await browser.close();

  return { logs, errors, dom };
}

async function main() {
  let server = null;

  try {
    const compilationResult = await compileTemplate();
    createEntryFile(compilationResult);
    await bundleWithWebpack();
    createHTML();
    server = await startServer();

    const { logs, errors, dom } = await runTest();

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

    console.log('\n✅ Test complete!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.stack) console.error(error.stack);
    process.exit(1);
  } finally {
    if (server) {
      server.kill();
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Cleanup temp directory
    if (OUTPUT_DIR.startsWith('/tmp/')) {
      await execAsync(`rm -rf "${OUTPUT_DIR}"`).catch(() => {});
    }
  }
}

main();
