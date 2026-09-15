#!/usr/bin/env node

/**
 * JQHTML Parallel Test Runner
 *
 * Runs tests 8 at a time using worker processes.
 * Each test runs in THREE cache modes: none, data, html
 * Outputs ✓ or ✗ as each test completes (no newlines).
 * Shows summary at the end with failed test names.
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONCURRENCY = 8;
const TIMEOUT_MS = 45000;
const BASE_PORT = 9000;  // Each test gets BASE_PORT + index

// Cache modes to test
const CACHE_MODES = ['none', 'data', 'html'];

// Colors
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const NC = '\x1b[0m';

// ---------------------------------------------------------------------------
// Shared browser
//
// Every test run used to start (and tear down) its own browser process. That is
// seconds per run on Firefox/WebKit and 300 runs per engine. Instead we start ONE
// browser server here and hand its websocket endpoint to every run-test.sh via
// JQHTML_BROWSER_WS; test-runner.js connects to it and opens its own browser
// context, which keeps each test as isolated as its own browser was.
// ---------------------------------------------------------------------------

const HARNESS_DIR = path.join(__dirname, '..', 'jqhtml-render-harness');

function selectedEngine() {
  for (const arg of process.argv) if (arg.startsWith('--browser=')) return arg.split('=')[1];
  return process.env.JQHTML_BROWSER || 'chromium';
}

async function startSharedBrowser(engineName) {
  // playwright is installed in the harness, not in tests/.
  const mod = await import(pathToFileURL(path.join(HARNESS_DIR, 'node_modules', 'playwright', 'index.js')).href);
  const playwright = mod.default || mod;
  const engine = playwright[engineName];
  if (!engine) throw new Error(`unknown engine "${engineName}"`);
  return engine.launchServer({ headless: true });
}

async function discoverTests(testsDir) {
  const entries = fs.readdirSync(testsDir, { withFileTypes: true });
  const tests = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const testDir = path.join(testsDir, entry.name);
    const runScript = path.join(testDir, 'run-test.sh');

    if (fs.existsSync(runScript)) {
      tests.push({
        name: entry.name,
        dir: testDir,
        script: runScript
      });
    }
  }

  return tests.sort((a, b) => a.name.localeCompare(b.name));
}

function runTest(test, portOffset) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const port = BASE_PORT + portOffset;
    const cacheMode = test.cacheMode || 'none';

    const proc = spawn('./run-test.sh', [], {
      cwd: test.dir,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
      env: {
        ...process.env,
        JQHTML_TEST_PORT: port.toString(),
        JQHTML_TEST_CACHE_MODE: cacheMode
      }
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => { stdout += data; });
    proc.stderr.on('data', (data) => { stderr += data; });

    const timeout = setTimeout(() => {
      proc.kill('SIGKILL');
      resolve({
        ...test,
        passed: false,
        duration: Date.now() - startTime,
        error: 'Timeout exceeded'
      });
    }, TIMEOUT_MS);

    proc.on('close', (code) => {
      clearTimeout(timeout);
      resolve({
        ...test,
        passed: code === 0,
        duration: Date.now() - startTime,
        stdout,
        stderr
      });
    });

    proc.on('error', (err) => {
      clearTimeout(timeout);
      resolve({
        ...test,
        passed: false,
        duration: Date.now() - startTime,
        error: err.message
      });
    });
  });
}

async function runTestsInParallel(tests, concurrency) {
  const results = [];
  const pending = [...tests];
  const running = new Map();  // Map of portOffset -> testName
  const availablePorts = Array.from({ length: concurrency }, (_, i) => i);  // [0, 1, 2, ...]
  let outputBuffer = '';
  let symbolCount = 0;
  const BUFFER_SIZE = 8;

  // Track completed modes per test for grouped output
  const completedModes = {};  // testName -> { modes: Set, anyFailed: boolean }
  const displayedTests = new Set();  // Tests that have already shown their symbol

  function flushBuffer(force = false) {
    if (symbolCount >= BUFFER_SIZE || (force && symbolCount > 0)) {
      console.log(outputBuffer);
      outputBuffer = '';
      symbolCount = 0;
    }
  }

  return new Promise((resolve) => {
    function checkComplete() {
      if (results.length === tests.length) {
        flushBuffer(true); // Flush remaining
        resolve(results);
      }
    }

    function startNext() {
      while (running.size < concurrency && pending.length > 0 && availablePorts.length > 0) {
        const test = pending.shift();
        const portOffset = availablePorts.shift();
        running.set(portOffset, test.name);

        runTest(test, portOffset).then((result) => {
          running.delete(portOffset);
          availablePorts.push(portOffset);  // Return port to pool
          results.push(result);

          // Track completion per test group
          if (!completedModes[result.name]) {
            completedModes[result.name] = { modes: new Set(), anyFailed: false };
          }
          completedModes[result.name].modes.add(result.cacheMode);
          if (!result.passed) {
            completedModes[result.name].anyFailed = true;
          }

          // Show symbol when all 3 modes for this test complete
          if (completedModes[result.name].modes.size === CACHE_MODES.length && !displayedTests.has(result.name)) {
            displayedTests.add(result.name);
            if (completedModes[result.name].anyFailed) {
              outputBuffer += `${RED}✗${NC}`;
            } else {
              outputBuffer += `${GREEN}✓${NC}`;
            }
            symbolCount++;
            flushBuffer();
          }

          checkComplete();
          startNext();
        });
      }
    }

    startNext();
  });
}

async function main() {
  const testsDir = __dirname;
  const baseTests = await discoverTests(testsDir);

  if (baseTests.length === 0) {
    console.log('No tests found.');
    process.exit(0);
  }

  // Create test entries for each cache mode (triples the test count)
  const allTests = [];
  for (const mode of CACHE_MODES) {
    for (const test of baseTests) {
      allTests.push({
        ...test,
        cacheMode: mode,
        displayName: `${test.name} [${mode}]`
      });
    }
  }

  console.log(`Running ${baseTests.length} tests × ${CACHE_MODES.length} cache modes = ${allTests.length} total test runs\n`);

  // One browser for the whole run; every spawned test connects to it.
  const engineName = selectedEngine();
  let browserServer = null;
  try {
    browserServer = await startSharedBrowser(engineName);
    process.env.JQHTML_BROWSER_WS = browserServer.wsEndpoint();
  } catch (e) {
    // Not fatal: without the endpoint each test launches its own browser as before.
    console.log(`${YELLOW}Shared browser unavailable (${e.message}); each test will launch its own.${NC}`);
  }

  const stopBrowser = () => {
    if (!browserServer) return Promise.resolve();
    const server = browserServer;
    browserServer = null;
    return server.close().catch(() => {});
  };
  process.on('SIGINT', () => { stopBrowser().finally(() => process.exit(130)); });
  process.on('SIGTERM', () => { stopBrowser().finally(() => process.exit(143)); });
  process.on('exit', () => { browserServer?.kill?.(); });

  // Run all tests in parallel
  let results;
  try {
    results = await runTestsInParallel(allTests, CONCURRENCY);
  } finally {
    await stopBrowser();
  }

  // Two newlines after test indicators
  console.log('\n');

  // Group results by test name
  const groupedResults = {};
  for (const result of results) {
    if (!groupedResults[result.name]) {
      groupedResults[result.name] = { name: result.name, dir: result.dir, modes: {} };
    }
    groupedResults[result.name].modes[result.cacheMode] = result;
  }

  // Analyze each test group
  const testSummaries = [];
  for (const testName of Object.keys(groupedResults).sort()) {
    const group = groupedResults[testName];
    const modeResults = CACHE_MODES.map(mode => ({
      mode,
      result: group.modes[mode]
    }));

    const passedModes = modeResults.filter(m => m.result?.passed).map(m => m.mode);
    const failedModes = modeResults.filter(m => !m.result?.passed).map(m => m.mode);
    const firstFailure = modeResults.find(m => !m.result?.passed)?.result;

    testSummaries.push({
      name: testName,
      dir: group.dir,
      allPassed: failedModes.length === 0,
      allFailed: passedModes.length === 0,
      passedModes,
      failedModes,
      firstFailure
    });
  }

  // Calculate stats
  const totalTests = testSummaries.length;
  const passedTests = testSummaries.filter(t => t.allPassed).length;
  const failedTests = testSummaries.filter(t => !t.allPassed).length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  // Overall summary
  if (failedTests === 0) {
    console.log(`${GREEN}All ${totalTests} tests passed${NC} (${(totalDuration / 1000).toFixed(1)}s)`);
  } else {
    console.log(`${passedTests} of ${totalTests} tests passed (${(totalDuration / 1000).toFixed(1)}s)`);
    console.log(`\n${RED}Failed tests:${NC}\n`);

    // Show failed tests with smart error display
    for (const summary of testSummaries.filter(t => !t.allPassed)) {
      if (summary.allFailed) {
        // All modes failed - show error once, no mode info
        console.log(`${RED}✗${NC} ${summary.name}`);
      } else {
        // Some modes passed, some failed
        const passedStr = summary.passedModes.map(m => `${GREEN}${m}${NC}`).join(', ');
        const failedStr = summary.failedModes.map(m => `${RED}${m}${NC}`).join(', ');
        console.log(`${RED}✗${NC} ${summary.name}`);
        console.log(`    ${YELLOW}Passed:${NC} ${passedStr}  ${YELLOW}Failed:${NC} ${failedStr}`);
        console.log(`    ${CYAN}Run individually:${NC} cd tests/${summary.name} && JQHTML_TEST_CACHE_MODE=${summary.failedModes[0]} ./run-test.sh`);
      }
    }
  }

  process.exit(failedTests > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Test runner error:', err);
  process.exit(1);
});
