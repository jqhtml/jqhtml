#!/usr/bin/env node

/**
 * Regression Testing Comparator for JQHTML Parser
 *
 * Compares current compiler output against baseline to ensure
 * no unintended changes during refactoring.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { Lexer, Parser, CodeGenerator } from '../dist/index.js';
// Simple colored output without external dependencies
const colors = {
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  gray: (text) => `\x1b[90m${text}\x1b[0m`,
  bold: (text) => `\x1b[1m${text}\x1b[0m`
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CORPUS_DIR = path.join(__dirname, '../test-corpus');
const BASELINE_DIR = path.join(__dirname, '../baseline-outputs');

// Function to compile template with current compiler
function compileTemplate(source, filename) {
  try {
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens, source, filename);
    const ast = parser.parse();

    const generator = new CodeGenerator();
    const result = generator.generate(ast);

    return {
      success: true,
      code: result.code,
      components: Array.from(result.components.entries()).map(([name, comp]) => ({
        name,
        render_function: comp.render_function,
        dependencies: comp.dependencies,
        tagName: comp.tagName,
        defaultAttributes: comp.defaultAttributes
      }))
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Function to normalize code for comparison (ignore whitespace differences)
// The compiler stamps the package version into every component it emits. That is a
// build-time constant, not codegen behaviour, so comparing it would fail all 48
// fixtures on every version bump and push us back toward regenerating baselines
// wholesale - the habit that let the corpus drift a release behind in the first place.
// Normalise it away on both sides so the baselines assert what codegen DOES.
function normalizeVersionStamp(code) {
  return code.replace(/_jqhtml_version: '[^']*'/g, "_jqhtml_version: '<version>'");
}

function normalizeCode(code) {
  return normalizeVersionStamp(code)
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n');
}

// Function to generate MD5 hash
function generateHash(content) {
  return crypto.createHash('md5').update(content).digest('hex');
}

// Function to show diff
function showDiff(baseline, current, showFullDiff = false) {
  const baselineLines = baseline.split('\n');
  const currentLines = current.split('\n');

  if (showFullDiff) {
    // Show full line-by-line diff (simplified without diff library)
    for (let i = 0; i < Math.max(baselineLines.length, currentLines.length); i++) {
      const baseLine = baselineLines[i];
      const currLine = currentLines[i];

      if (baseLine === undefined && currLine !== undefined) {
        console.log(colors.green('+ ' + currLine));
      } else if (baseLine !== undefined && currLine === undefined) {
        console.log(colors.red('- ' + baseLine));
      } else if (baseLine !== currLine) {
        console.log(colors.red('- ' + baseLine));
        console.log(colors.green('+ ' + currLine));
      }
    }
  } else {
    // Show compact diff - first difference only
    for (let i = 0; i < Math.max(baselineLines.length, currentLines.length); i++) {
      const baseLine = baselineLines[i] || '';
      const currLine = currentLines[i] || '';

      if (baseLine !== currLine) {
        console.log(colors.yellow(`  First difference at line ${i + 1}:`));
        console.log(colors.red(`  - ${baseLine}`));
        console.log(colors.green(`  + ${currLine}`));
        console.log(colors.gray(`  (Use --verbose for full diff)`));
        break;
      }
    }
  }
}

// Fixtures that are deliberately uncompilable, and why. Anything not listed here must
// compile and carry a baseline.
const EXPECTED_UNCOMPILABLE = (() => {
  const p = path.join(__dirname, 'uncompilable-fixtures.json');
  if (!fs.existsSync(p)) { return {}; }
  return JSON.parse(fs.readFileSync(p, 'utf-8')).fixtures || {};
})();

// Parse arguments
const args = process.argv.slice(2);
const verbose = args.includes('--verbose');
const failFast = args.includes('--fail-fast');
const specificFile = args.find(arg => arg.endsWith('.jqhtml'));

// Main comparison
console.log('🔍 Running regression tests against baseline...\n');

const files = specificFile
  ? [specificFile]
  : fs.readdirSync(CORPUS_DIR).filter(f => f.endsWith('.jqhtml'));

const results = {
  totalFiles: 0,
  passed: 0,
  failed: 0,
  skipped: 0,
  failures: []
};

for (const file of files) {
  const baselineFile = path.join(BASELINE_DIR, file.replace('.jqhtml', '.baseline.json'));

  // A fixture with no baseline is a FAILURE, not a skip.
  //
  // generate-baseline.js only writes a baseline for a file that compiles, so "no
  // baseline" means "this fixture does not compile" - the single most important thing
  // a regression suite should report. Treating it as a skip let broken fixtures drop
  // silently out of the run while the summary still said all tests passed.
  //
  // Fixtures that are uncompilable ON PURPOSE are listed in
  // test-regression/uncompilable-fixtures.json, with a reason.
  if (!fs.existsSync(baselineFile)) {
    const expected = EXPECTED_UNCOMPILABLE[file];
    if (expected) {
      // An allowlist entry is an ASSERTION, not an exemption: these fixtures exist to
      // exercise the parser's error reporting, so the error itself is the thing under
      // test. Skipping them outright would let one start compiling - or start failing
      // for an entirely different reason - without the suite noticing.
      results.totalFiles++;
      console.log(`Testing: ${file}`);

      const attempt = compileTemplate(fs.readFileSync(path.join(CORPUS_DIR, file), 'utf-8'), file);

      if (attempt.success) {
        results.failed++;
        console.log(colors.red('  ❌ Expected this fixture to fail, but it compiled!'));
        console.log(colors.gray(`     ${expected.reason}`));
        console.log(colors.gray('     Either the fixture changed, or the parser stopped reporting this error.'));
        results.failures.push({ file, reason: 'expected to fail, but compiled' });
        if (failFast) { break; }
        continue;
      }

      const actual_error = String(attempt.error).split('\n')[0].trim();
      if (!actual_error.startsWith(expected.error)) {
        results.failed++;
        console.log(colors.red('  ❌ Failed with the wrong error!'));
        console.log(colors.red(`     expected: ${expected.error}`));
        console.log(colors.green(`     actual:   ${actual_error}`));
        results.failures.push({ file, reason: `wrong error: ${actual_error}` });
        if (failFast) { break; }
        continue;
      }

      results.passed++;
      console.log(colors.green(`  ✅ Failed as expected (${actual_error})`));
      continue;
    }

    results.totalFiles++;
    results.failed++;
    console.log(`Testing: ${file}`);
    console.log(colors.red('  ❌ No baseline!'));

    // compileTemplate reports failure in its return value rather than throwing
    const attempt = compileTemplate(fs.readFileSync(path.join(CORPUS_DIR, file), 'utf-8'), file);
    let reason;
    if (attempt.success) {
      console.log(colors.gray(`     The fixture compiles - run: node test-regression/regenerate-one.js ${file}`));
      reason = 'compiles but has no baseline';
    } else {
      const first_line = String(attempt.error).split('\n')[0];
      console.log(colors.gray(`     Fixture does not compile: ${first_line}`));
      reason = `does not compile: ${first_line}`;
    }

    results.failures.push({ file, reason });
    if (failFast) { break; }
    continue;
  }

  results.totalFiles++;

  const filepath = path.join(CORPUS_DIR, file);
  const source = fs.readFileSync(filepath, 'utf-8');
  const baseline = JSON.parse(fs.readFileSync(baselineFile, 'utf-8'));

  // Only test files that compiled successfully in baseline
  if (!baseline.success) {
    if (verbose) {
      console.log(colors.gray(`⏭️  Skipping ${file} (baseline compilation failed)`));
    }
    results.skipped++;
    continue;
  }

  console.log(`Testing: ${file}`);

  const current = compileTemplate(source, file);

  // Check if compilation status matches
  if (current.success !== baseline.success) {
    console.log(colors.red(`  ❌ Compilation status changed!`));
    console.log(`     Baseline: ${baseline.success ? 'success' : 'failed'}`);
    console.log(`     Current:  ${current.success ? 'success' : 'failed'}`);
    if (!current.success) {
      console.log(`     Error: ${current.error}`);
    }
    results.failed++;
    results.failures.push({ file, reason: 'compilation status changed' });

    if (failFast) {
      break;
    }
    continue;
  }

  // For successful compilations, compare the output
  if (current.success) {
    const currentHash = generateHash(current.code);

    // Quick hash comparison first. A version bump changes the hash, so a miss here
    // falls through to the normalised comparison below rather than being a failure.
    if (currentHash === baseline.codeHash ||
        normalizeVersionStamp(current.code) === normalizeVersionStamp(baseline.code)) {
      // Identical once the build-time version stamp is set aside. Reported as identical
      // rather than as a whitespace difference, because it is neither a difference in
      // codegen nor in formatting.
      console.log(colors.green(`  ✅ Identical output (${currentHash.substring(0, 8)}...)`));
      results.passed++;
    } else {
      // Normalize and compare
      const normalizedBaseline = normalizeCode(baseline.code);
      const normalizedCurrent = normalizeCode(current.code);

      if (normalizedBaseline === normalizedCurrent) {
        console.log(colors.yellow(`  ⚠️  Whitespace differences only`));
        results.passed++;
      } else {
        console.log(colors.red(`  ❌ Output differs!`));
        console.log(`     Baseline hash: ${baseline.codeHash.substring(0, 8)}...`);
        console.log(`     Current hash:  ${currentHash.substring(0, 8)}...`);

        showDiff(baseline.code, current.code, verbose);

        results.failed++;
        results.failures.push({ file, reason: 'output differs' });

        if (failFast) {
          break;
        }
      }
    }

    // Compare component metadata if verbose
    if (verbose && current.components.length > 0) {
      const baselineComps = baseline.components || [];
      const currentComps = current.components;

      if (JSON.stringify(baselineComps) !== JSON.stringify(currentComps)) {
        console.log(colors.yellow(`  ⚠️  Component metadata differs`));
      }
    }
  }
}

// Report results
console.log('\n' + '='.repeat(60));
console.log(colors.bold('📊 Regression Test Results:\n'));

console.log(`  Total files tested: ${results.totalFiles}`);
console.log(colors.green(`  ✅ Passed: ${results.passed}`));
if (results.failed > 0) {
  console.log(colors.red(`  ❌ Failed: ${results.failed}`));
}
if (results.skipped > 0) {
  console.log(colors.gray(`  ⏭️  Skipped: ${results.skipped}`));
}

if (results.failures.length > 0) {
  console.log(colors.red('\n❌ Failed files:'));
  results.failures.forEach(failure => {
    console.log(`  - ${failure.file}: ${failure.reason}`);
  });
}

// Exit code
if (results.failed > 0) {
  console.log(colors.red('\n❌ Regression tests failed!'));
  console.log('Fix the issues or update baselines if changes are intentional.');
  process.exit(1);
} else {
  console.log(colors.green('\n✅ All regression tests passed!'));
  process.exit(0);
}