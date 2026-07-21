#!/usr/bin/env node

/**
 * Unified Test Runner for JQHTML and JavaScript Files
 * =====================================================
 *
 * PURPOSE:
 * Tests JavaScript files with sourcemaps in a real browser environment using Playwright.
 * Can handle both .jqhtml files (compiles them first) and .js files.
 *
 * USAGE:
 * node jqhtml-test-runner.js <path/to/file.jqhtml|file.js>
 *
 * EXAMPLES:
 * node jqhtml-test-runner.js ../webpack-sourcemap-test/dist/bundle.js
 * node jqhtml-test-runner.js ../demo/components/ComplexError.jqhtml
 */

import fs from 'fs';
import path from 'path';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Check command line arguments
const inputFile = process.argv[2];
const keepAlive = process.argv.includes('--keep-alive');

if (!inputFile) {
  console.error('Usage: node jqhtml-test-runner.js <file.jqhtml|file.js> [options]');
  console.error('Options:');
  console.error('  --keep-alive    Keep the server running after tests complete');
  console.error('  chromium|firefox|webkit  Choose browser (default: chromium)');
  process.exit(1);
}

if (!fs.existsSync(inputFile)) {
  console.error(`Error: File not found: ${inputFile}`);
  process.exit(1);
}

// Configuration
const TEST_PORT = 8989;
const INPUT_FILE = path.resolve(inputFile);
const INPUT_DIR = path.dirname(INPUT_FILE);
const INPUT_EXT = path.extname(INPUT_FILE);
const FILE_NAME = path.basename(INPUT_FILE, INPUT_EXT);

// Determine output locations
let JS_FILE, OUTPUT_DIR, HTML_FILE;

if (INPUT_EXT === '.jqhtml') {
  // For JQHTML files, compile to temp directory
  OUTPUT_DIR = path.join('/tmp', `jqhtml_test_${Date.now()}`);
  JS_FILE = path.join(OUTPUT_DIR, `${FILE_NAME}.js`);
  HTML_FILE = path.join(OUTPUT_DIR, `${FILE_NAME}_test.html`);
} else if (INPUT_EXT === '.js') {
  // For JS files, use same directory as the JS file
  OUTPUT_DIR = INPUT_DIR;
  JS_FILE = INPUT_FILE;
  HTML_FILE = path.join(OUTPUT_DIR, `${FILE_NAME}_test.html`);
} else {
  console.error('Error: File must be .jqhtml or .js');
  process.exit(1);
}

console.log('🔧 Unified JQHTML/JS Test Runner');
console.log('=================================');
console.log(`Input:    ${INPUT_FILE}`);
console.log(`Type:     ${INPUT_EXT === '.jqhtml' ? 'JQHTML (will compile)' : 'JavaScript'}`);
console.log(`Output:   ${OUTPUT_DIR}`);
console.log(`JS File:  ${JS_FILE}`);
console.log(`HTML:     ${HTML_FILE}`);
console.log('');

// Write debug file to show where test runner is operating
async function writePwdDebugFile() {
  const pwdFile = path.join(OUTPUT_DIR, '.testerpwd');
  const pwdContent = `Test runner working directories:
Script location: ${__dirname}
Script CWD: ${process.cwd()}
Output directory: ${OUTPUT_DIR}
Server will run from: ${OUTPUT_DIR}
Timestamp: ${new Date().toISOString()}
`;
  fs.writeFileSync(pwdFile, pwdContent);
  console.log(`📍 Wrote PWD debug file to ${pwdFile}`);
}

// Step 1: Check Playwright dependencies
async function checkDependencies() {
  console.log('📦 Checking dependencies...');

  try {
    await import('playwright');
    console.log('✓ Playwright is installed');

    if (INPUT_EXT === '.jqhtml') {
      // REBUILD THE PARSER FROM TYPESCRIPT SOURCE
      console.log('🔨 Rebuilding JQHTML parser from TypeScript source...');
      const parserDir = path.join(__dirname, '..', 'packages', 'parser');

      try {
        const { stdout, stderr } = await execAsync('npm run build', { cwd: parserDir });
        if (stderr && !stderr.includes('warning')) {
          console.warn('  Build warnings:', stderr);
        }
        console.log('  ✓ Parser rebuilt from source');
      } catch (buildError) {
        console.error('  ✗ Failed to rebuild parser:', buildError.message);
        throw new Error('Parser rebuild failed - cannot continue');
      }

      // Check for JQHTML compiler
      const compilerPath = path.join(__dirname, '..', 'packages', 'parser', 'bin', 'jqhtml-compile');
      if (!fs.existsSync(compilerPath)) {
        throw new Error(`JQHTML compiler not found at ${compilerPath}`);
      }
      console.log('✓ JQHTML compiler found');
    }

    return true;
  } catch (e) {
    console.error('✗ Missing dependencies:', e.message);
    console.error('');
    console.error('To install Playwright, run:');
    console.error('  npm install --save-dev playwright');
    console.error('  npx playwright install chromium');
    console.error('');
    return false;
  }
}

// Step 2: Compile JQHTML if needed
async function compileIfNeeded() {
  if (INPUT_EXT !== '.jqhtml') {
    console.log('📋 Using existing JavaScript file (no compilation needed)');
    return;
  }

  console.log('🔨 Compiling JQHTML to JavaScript...');

  // Create output directory
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Compile with inline sourcemaps
  const compilerPath = path.join(__dirname, '..', 'packages', 'parser', 'bin', 'jqhtml-compile');
  const cmd = `node "${compilerPath}" --sourcemap "${INPUT_FILE}" > "${JS_FILE}"`;

  console.log(`  Running: ${cmd}`);

  try {
    const result = await execAsync(cmd);
    if (result.stderr) {
      console.error('  Compiler warnings:', result.stderr);
    }

    // Verify output exists and has content
    if (!fs.existsSync(JS_FILE)) {
      throw new Error('Compiler produced no output');
    }

    const stats = fs.statSync(JS_FILE);
    console.log(`  ✓ Compiled to ${JS_FILE} (${stats.size} bytes)`);

    // Check for sourcemap
    const jsContent = fs.readFileSync(JS_FILE, 'utf-8');
    // Check for sourcemap with or without charset
    if (jsContent.includes('//# sourceMappingURL=data:application/json;') && jsContent.includes('base64,')) {
      console.log('  ✓ Inline sourcemap detected');
    } else {
      console.warn('  ⚠️  No inline sourcemap found in output');
    }
  } catch (error) {
    console.error('  ✗ Compilation failed:', error.message);
    throw error;
  }
}

// Step 3: Create HTML test runner
function createHTMLRunner() {
  console.log('📄 Creating HTML test runner...');

  // Ensure output directory exists
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Get relative path from HTML to JS file (they're in same directory)
  const jsRelativePath = path.basename(JS_FILE);

  // Add cache buster and server start time
  const cacheBuster = Date.now();
  const serverStartTime = new Date().toISOString();

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Test Runner - ${FILE_NAME}</title>
  <style>
    body {
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
      padding: 20px;
      background: #1e1e1e;
      color: #d4d4d4;
    }
    h1 { color: #569cd6; }
    .info { color: #9cdcfe; margin: 10px 0; }
    .success { color: #4ec9b0; }
    .error { color: #f48771; }
    pre {
      background: #2d2d30;
      padding: 10px;
      border-radius: 3px;
      overflow-x: auto;
    }
  </style>
</head>
<body>
  <h1>🧪 Test Runner</h1>
  <div class="info">Testing: ${path.basename(INPUT_FILE)}</div>
  <div class="info">Type: ${INPUT_EXT === '.jqhtml' ? 'JQHTML (compiled)' : 'JavaScript'}</div>
  <div class="info">Check console for errors and sourcemap resolution</div>
  <div class="info" style="color: #ffcc00;">Server started at: ${serverStartTime}</div>

  <div id="test-output"></div>

  <script>
    console.log('🕐 Test server generated at: ${serverStartTime}');
  </script>

  <!-- Mock jqhtml runtime (needed for JQHTML templates and some JS bundles) -->
  <script>
    window.jqhtml = {
      register_template: function(templateOrName, config) {
        // Support both old format (name, config) and new format (template object)
        if (typeof templateOrName === 'string') {
          window.templates = window.templates || {};
          window.templates[templateOrName] = config;
        } else if (templateOrName && templateOrName.name) {
          window.templates = window.templates || {};
          window.templates[templateOrName.name] = templateOrName;
        }
      },
      component: function(name) {
        return function() { return name; };
      },
      escape_html: function(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
      }
    };
  </script>

  <!-- Minimal setup - no error catching, no console overrides -->
  <script>
    // Mark when page is ready (for Playwright to know when to stop waiting)
    window.addEventListener('load', function() {
      setTimeout(function() {
        window.testsComplete = true;
      }, 2000); // Give time for all async operations
    });
  </script>

  <!-- Load jQuery (always include for potential JQHTML templates) -->
  <script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>

  <!-- Load the JavaScript file being tested with cache buster -->
  <script src="${jsRelativePath}?u=${cacheBuster}"></script>

  <script>
    // For JQHTML files OR JS files with JQHTML templates, execute the registered templates to trigger any embedded code
    // Always include this code since it won't hurt if no templates exist

    setTimeout(function() {
      if (window.templates) {
        for (const [name, template] of Object.entries(window.templates)) {
          // Create mock component context that matches JQHTML runtime
          const mockContext = {
            _cid: 'test-' + name,
            data: {},
            args: {},
            $: jQuery || function(sel) { return document.querySelector(sel); },
            $id: function(id) { return document.getElementById(id + ':' + this._cid); }
          };

          // Check if template has render_function (old format) or render (new format)
          const renderFn = template.render_function || template.render;

          if (renderFn) {
            // Just call it - no logging, no try-catch
            renderFn.call(
              mockContext,
              {}, // data
              {}, // args
              {}, // content
              window.jqhtml // jqhtml utilities
            );
          }
        }
      }
    }, 500);

  </script>
</body>
</html>`;

  fs.writeFileSync(HTML_FILE, html);
  console.log(`  ✓ Created test runner at ${HTML_FILE}`);

  return serverStartTime;
}

// Step 4: Manage test server
async function manageTestServer() {
  console.log('🌐 Managing test server...');
  console.log(`  Current process CWD: ${process.cwd()}`);
  console.log(`  Server will run in: ${OUTPUT_DIR}`);

  // Step 1: KILL EVERYTHING ON PORT 8989
  console.log(`  Killing ANY process on port ${TEST_PORT}...`);

  // Kill any python servers on this port using ps and kill -9
  await execAsync(`ps ax | grep "python.*no-cache-server.py ${TEST_PORT}" | grep -v grep | awk '{print $1}' | xargs -r kill -9 2>/dev/null || true`);

  // Step 2: Wait until port is actually free (poll every 100ms)
  console.log(`  Waiting for port ${TEST_PORT} to be free...`);
  let attempts = 0;
  const maxAttempts = 50; // 5 seconds max

  while (attempts < maxAttempts) {
    // Check if port is free using ss
    const { stdout } = await execAsync(`ss -tlnp 2>/dev/null | grep :${TEST_PORT} || echo "PORT_FREE"`);

    if (stdout.trim() === "PORT_FREE") {
      // No listeners on port = port is free
      console.log(`  ✓ Port ${TEST_PORT} is now free`);
      break;
    }

    // Port still in use, wait and retry
    await new Promise(resolve => setTimeout(resolve, 100));
    attempts++;
  }

  if (attempts >= maxAttempts) {
    throw new Error(`Port ${TEST_PORT} still in use after 5 seconds of waiting`);
  }

  // Step 4: Start new server in the output directory with no-cache headers
  console.log(`  Starting no-cache HTTP server in: ${OUTPUT_DIR}`);

  // Use our custom no-cache server script
  const serverScript = path.join(__dirname, 'no-cache-server.py');
  const server = spawn('python3', [serverScript, TEST_PORT.toString()], {
    cwd: OUTPUT_DIR,
    detached: false,
    stdio: ['ignore', 'pipe', 'pipe'] // Capture stdout/stderr to debug
  });

  // Log any server errors for debugging
  server.stderr.on('data', (data) => {
    console.error(`  Server error: ${data}`);
  });
  server.stdout.on('data', (data) => {
    console.log(`  Server: ${data.toString().trim()}`);
  });

  // Step 5: Wait until server responds (polling every 100ms)
  console.log(`  Waiting for server to start...`);
  let serverReady = false;
  let serverAttempts = 0;
  const maxServerAttempts = 50; // 5 seconds max

  while (serverAttempts < maxServerAttempts) {
    try {
      // Try to connect to the server
      await execAsync(`curl -s --connect-timeout 0.1 --max-time 0.1 -o /dev/null -w "%{http_code}" http://localhost:${TEST_PORT}/ | grep -E "^[23]"`);
      serverReady = true;
      break;
    } catch (e) {
      // Server not ready yet
      await new Promise(resolve => setTimeout(resolve, 100));
      serverAttempts++;
    }
  }

  if (!serverReady) {
    server.kill();
    throw new Error(`Server failed to start on port ${TEST_PORT} after 5 seconds`);
  }

  console.log(`  ✓ Server started successfully after ${serverAttempts * 100}ms`);

  console.log(`  ✓ Server is running on http://localhost:${TEST_PORT}`);

  // Verify files are accessible
  try {
    const htmlCheck = await execAsync(`curl -s -o /dev/null -w "%{http_code}" http://localhost:${TEST_PORT}/${path.basename(HTML_FILE)}`);
    const jsCheck = await execAsync(`curl -s -o /dev/null -w "%{http_code}" http://localhost:${TEST_PORT}/${path.basename(JS_FILE)}`);

    console.log(`  ✓ HTML file accessible: ${htmlCheck.stdout.trim() === '200' ? 'YES' : 'NO (' + htmlCheck.stdout.trim() + ')'}`);
    console.log(`  ✓ JS file accessible: ${jsCheck.stdout.trim() === '200' ? 'YES' : 'NO (' + jsCheck.stdout.trim() + ')'}`);
  } catch (e) {
    console.warn('  ⚠️  Could not verify file accessibility');
  }

  // List files in the server directory for debugging
  try {
    const files = await execAsync(`ls -la "${OUTPUT_DIR}" | head -10`);
    console.log(`  Files being served:`);
    files.stdout.split('\n').forEach(line => {
      if (line && !line.startsWith('total')) {
        console.log(`    ${line}`);
      }
    });
  } catch (e) {
    // Ignore errors listing files
  }

  return server;
}

// Step 5: Run Playwright test
async function runPlaywrightTest(serverStartTime) {
  console.log('🎭 Running Playwright test...');

  // Check for browser preference from command line or environment
  const browserType = process.env.BROWSER || process.argv[3] || 'chromium';
  console.log(`  Using browser: ${browserType}`);
  console.log('');

  const playwright = await import('playwright');

  let browser;
  if (browserType === 'firefox') {
    // Set HOME environment variable for Firefox in Docker/root environments
    process.env.HOME = '/root';
    browser = await playwright.firefox.launch({
      headless: true
    });
  } else if (browserType === 'webkit') {
    browser = await playwright.webkit.launch({
      headless: true
    });
  } else {
    // Default to Chromium with sourcemap flags
    browser = await playwright.chromium.launch({
      headless: true,
      args: ['--enable-devtools', '--enable-source-maps']
    });
  }

  const page = await browser.newPage();

  // Set aggressive timeouts
  page.setDefaultTimeout(10000); // 10 seconds max for any operation
  page.setDefaultNavigationTimeout(5000); // 5 seconds for navigation

  // Collect all console output
  const consoleMessages = [];
  let hasSourcemapReferences = false;
  let pageLoadFailed = false;

  page.on('console', async msg => {
    const type = msg.type();
    const text = msg.text();
    const location = msg.location();

    consoleMessages.push({ type, text, location });

    // For errors, try to get the actual error object to see the real stack
    if (type === 'error') {
      try {
        // Try to get the actual JavaScript error object
        const args = msg.args();
        if (args.length > 0) {
          const errorObj = await args[0].jsonValue().catch(() => null);
          if (errorObj && errorObj.stack) {
            // Check if the stack contains webpack:// references
            if (errorObj.stack.includes('webpack://')) {
              hasSourcemapReferences = true;
              console.error('❌ [WITH SOURCEMAP]', text);
              console.error('   Stack (from error object):', errorObj.stack);
            } else {
              console.error('❌ [NO SOURCEMAP]', text);
              console.error('   Stack (from error object):', errorObj.stack);
            }
          } else {
            console.error('❌', text);
          }
        } else {
          console.error('❌', text);
        }
      } catch (e) {
        console.error('❌', text);
      }

      if (location && location.url) {
        console.error('   Location (from msg.location()):', `${location.url}:${location.lineNumber}:${location.columnNumber}`);
        // Check if the location references original source files
        if (!location.url.endsWith('.js') && !location.url.includes('test.html')) {
          hasSourcemapReferences = true;
        }
      }
    } else if (type === 'warn') {
      console.warn('⚠️ ', text);
    } else {
      console.log('  ', text);
    }
  });

  page.on('pageerror', error => {
    console.error('🔥 Page error:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
      console.error('\n📍 NOTE: Sourcemaps do not resolve in Playwright test runner.');
      console.error('   To test sourcemaps, re-run with --keep-alive flag:');
      console.error(`   node tools/jqhtml-test-runner.js ${inputFile} --keep-alive`);
      console.error('   Then check in browser at http://192.168.0.3:8989/');
      // Check if stack trace contains non-.js references
      if (error.stack.includes('webpack:///') || error.stack.includes('.ts:') || error.stack.includes('.jqhtml:')) {
        hasSourcemapReferences = true;
      }
    }
  });

  page.on('requestfailed', request => {
    console.error(`🚫 Request failed: ${request.url()}`);
    if (request.url().includes(path.basename(HTML_FILE))) {
      pageLoadFailed = true;
    }
  });

  // Navigate to test page with timeout handling
  const testUrl = `http://localhost:${TEST_PORT}/${path.basename(HTML_FILE)}`;
  console.log(`📍 Navigating to: ${testUrl}`);
  console.log('');
  console.log(`🕐 Server generated at: ${serverStartTime || new Date().toISOString()}`);
  console.log('🌐 To view in your browser, visit:');
  console.log(`   http://127.0.0.1:${TEST_PORT}/${path.basename(HTML_FILE)}`);
  console.log('');
  console.log('='.repeat(60));
  console.log('CONSOLE OUTPUT:');
  console.log('='.repeat(60));

  try {
    await page.goto(testUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 5000
    });

    // Wait for tests to complete with shorter timeout
    try {
      await page.waitForFunction(() => window.testsComplete, { timeout: 3000 });
    } catch (e) {
      // Timeout is okay, continue
    }

    // Extra wait to capture any final output
    await page.waitForTimeout(500);

  } catch (error) {
    console.error('');
    console.error('💥 Navigation failed:', error.message);
    if (pageLoadFailed) {
      console.error('❌ HTML file could not be loaded (404 or other error)');
      console.error(`   Attempted URL: ${testUrl}`);
      console.error(`   Check that server is running in correct directory: ${OUTPUT_DIR}`);
    }
  }

  console.log('='.repeat(60));
  console.log('');

  // Analyze results
  const errors = consoleMessages.filter(m => m.type === 'error');
  if (errors.length > 0) {
    console.log(`\n⚠️  Found ${errors.length} error(s) in console output`);

    // Check if sourcemaps are working
    if (hasSourcemapReferences) {
      console.log('✅ SOURCEMAPS ARE WORKING! (errors reference original source files)');
    } else {
      // Look for webpack:// references which also indicate sourcemaps
      const hasWebpackRefs = errors.some(e => e.text.includes('webpack://'));
      if (hasWebpackRefs) {
        console.log('✅ SOURCEMAPS ARE WORKING! (webpack:// protocol detected)');
      } else if (INPUT_EXT === '.jqhtml') {
        // For JQHTML, check for .jqhtml references
        const hasJqhtmlRefs = errors.some(e =>
          e.location?.url?.includes('.jqhtml') ||
          e.text.includes('.jqhtml')
        );
        if (hasJqhtmlRefs) {
          console.log('✅ SOURCEMAPS ARE WORKING! (.jqhtml source references detected)');
        } else {
          console.log('❌ SOURCEMAPS NOT WORKING (errors only reference compiled .js files)');
          console.log('');
          console.log('Debug info:');
          errors.forEach(e => {
            if (e.location) {
              console.log(`  Error location: ${e.location.url}`);
            }
          });
        }
      } else {
        console.log('❌ SOURCEMAPS NOT WORKING (errors only reference compiled .js files)');
        console.log('');
        console.log('Debug info:');
        errors.forEach(e => {
          if (e.location) {
            console.log(`  Error location: ${e.location.url}`);
          }
        });
      }
    }
  } else {
    console.log('\n✅ No errors detected (add intentional errors to test sourcemaps)');
  }

  await browser.close();
}

// Main execution
async function main() {
  let server = null;

  try {
    // Check dependencies
    const depsOk = await checkDependencies();
    if (!depsOk) {
      process.exit(1);
    }

    console.log('');

    // Compile if needed
    await compileIfNeeded();

    console.log('');

    // Create HTML runner
    const serverStartTime = createHTMLRunner();

    // Write PWD debug file
    await writePwdDebugFile();

    console.log('');

    // Start server
    server = await manageTestServer();

    console.log('');

    // Run test
    await runPlaywrightTest(serverStartTime);

    console.log('✨ Test complete!');
    console.log('');
    console.log('Generated files:');
    console.log(`  - ${HTML_FILE}`);
    if (INPUT_EXT === '.jqhtml') {
      console.log(`  - ${JS_FILE}`);
    }
    console.log(`  - ${path.join(OUTPUT_DIR, '.testerpwd')}`);

  } catch (error) {
    console.error('💥 Test failed:', error);
    process.exit(1);
  } finally {
    // Check if we should keep server alive
    if (keepAlive && server) {
      console.log('\n🌐 Server is still running!');
      console.log('   Access your test page at:');
      console.log(`   http://127.0.0.1:${TEST_PORT}/${path.basename(HTML_FILE)}`);
      console.log('');
      console.log('   Press Ctrl+C to stop the server and exit.');

      // Keep the process alive
      await new Promise(() => {}); // Never resolves
    } else {
      // Clean up server
      if (server) {
        console.log('\n🧹 Cleaning up server...');
        server.kill();

        // Give server time to die
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Clean up temp directory if we created one
      if (INPUT_EXT === '.jqhtml' && OUTPUT_DIR.startsWith('/tmp/')) {
        console.log(`🧹 Cleaning up temp directory: ${OUTPUT_DIR}`);
        try {
          await execAsync(`rm -rf "${OUTPUT_DIR}"`);
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    }
  }

  // Exit cleanly
  process.exit(0);
}

// Run the test
main();