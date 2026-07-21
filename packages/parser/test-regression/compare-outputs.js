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
function normalizeCode(code) {
  return code
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

  // Check if baseline exists
  if (!fs.existsSync(baselineFile)) {
    if (verbose) {
      console.log(colors.gray(`⏭️  Skipping ${file} (no baseline)`));
    }
    results.skipped++;
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

    // Quick hash comparison first
    if (currentHash === baseline.codeHash) {
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