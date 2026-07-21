#!/usr/bin/env node

/**
 * Baseline Generator for JQHTML Parser Regression Testing
 *
 * This script compiles all test corpus files with the current compiler
 * and saves the outputs as baseline for regression testing during refactoring.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { Lexer, Parser, CodeGenerator } from '../dist/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CORPUS_DIR = path.join(__dirname, '../test-corpus');
const BASELINE_DIR = path.join(__dirname, '../baseline-outputs');

// Ensure baseline directory exists
if (!fs.existsSync(BASELINE_DIR)) {
  fs.mkdirSync(BASELINE_DIR, { recursive: true });
}

// Function to compile a single template
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
      })),
      ast: JSON.stringify(ast, null, 2),
      tokens: tokens.map(t => ({
        type: t.type,
        value: t.value,
        line: t.line,
        column: t.column
      }))
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      stack: error.stack
    };
  }
}

// Function to generate MD5 hash
function generateHash(content) {
  return crypto.createHash('md5').update(content).digest('hex');
}

// Main processing
console.log('🔄 Generating baseline outputs for regression testing...\n');

const files = fs.readdirSync(CORPUS_DIR).filter(f => f.endsWith('.jqhtml'));
const results = {
  timestamp: new Date().toISOString(),
  version: process.env.npm_package_version || '2.2.63',
  totalFiles: files.length,
  successful: 0,
  failed: 0,
  files: {}
};

for (const file of files) {
  const filepath = path.join(CORPUS_DIR, file);
  const source = fs.readFileSync(filepath, 'utf-8');

  console.log(`Processing: ${file}`);

  const result = compileTemplate(source, file);
  const outputName = file.replace('.jqhtml', '.baseline.json');

  if (result.success) {
    // Generate hash of the code for quick comparison
    result.codeHash = generateHash(result.code);
    result.sourceHash = generateHash(source);

    // Save individual baseline
    fs.writeFileSync(
      path.join(BASELINE_DIR, outputName),
      JSON.stringify(result, null, 2)
    );

    results.files[file] = {
      success: true,
      codeHash: result.codeHash,
      sourceHash: result.sourceHash,
      components: result.components.map(c => c.name)
    };
    results.successful++;

    console.log(`  ✅ Generated baseline (${result.codeHash.substring(0, 8)}...)`);
  } else {
    results.files[file] = {
      success: false,
      error: result.error
    };
    results.failed++;

    console.log(`  ❌ Failed: ${result.error}`);
  }
}

// Save summary
fs.writeFileSync(
  path.join(BASELINE_DIR, 'baseline-summary.json'),
  JSON.stringify(results, null, 2)
);

// Generate statistics
console.log('\n📊 Baseline Generation Complete:');
console.log(`  Total files: ${results.totalFiles}`);
console.log(`  Successful: ${results.successful}`);
console.log(`  Failed: ${results.failed}`);
console.log(`  Output directory: ${BASELINE_DIR}`);

if (results.failed > 0) {
  console.log('\n⚠️  Some files failed to compile. Check baseline-summary.json for details.');
  process.exit(1);
}

console.log('\n✅ All baselines generated successfully!');