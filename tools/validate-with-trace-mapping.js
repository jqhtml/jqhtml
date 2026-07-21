#!/usr/bin/env node

/**
 * Sourcemap Validation using @jridgewell/trace-mapping
 * =====================================================
 *
 * This tool validates inline sourcemaps using the same library that Chrome DevTools
 * uses internally to parse source maps.
 *
 * Usage:
 *   node validate-with-trace-mapping.js <file.js>
 *
 * Features:
 * - Extracts inline base64 sourcemaps
 * - Validates sourcemap structure
 * - Maps sample positions from compiled back to original
 * - Reports any issues found
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { TraceMap, originalPositionFor, generatedPositionFor, eachMapping } from '@jridgewell/trace-mapping';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ANSI colors for output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function extractInlineSourceMap(content) {
  // Look for inline sourcemap comment (supports both //# and //@ formats)
  const match = content.match(/\/\/[#@]\s*sourceMappingURL\s*=\s*data:application\/json;(?:charset=utf-?8;)?base64,(.+)$/m);

  if (!match) {
    return null;
  }

  try {
    const base64Data = match[1].trim();
    const jsonStr = Buffer.from(base64Data, 'base64').toString('utf-8');
    return JSON.parse(jsonStr);
  } catch (e) {
    throw new Error(`Failed to decode inline sourcemap: ${e.message}`);
  }
}

function analyzeSourceMap(sourceMap, jsFilePath) {
  log('\n📊 SOURCEMAP ANALYSIS', 'bright');
  log('=' .repeat(50), 'gray');

  // Basic structure validation
  log('\n📋 Basic Structure:', 'cyan');
  log(`  Version: ${sourceMap.version}`, sourceMap.version === 3 ? 'green' : 'red');
  log(`  Sources: ${sourceMap.sources?.length || 0} file(s)`);
  log(`  Sources Content: ${sourceMap.sourcesContent ? '✓ Embedded' : '✗ Missing'}`,
      sourceMap.sourcesContent ? 'green' : 'yellow');
  log(`  Source Root: ${sourceMap.sourceRoot || '(none)'}`);
  log(`  Mappings length: ${sourceMap.mappings?.length || 0} chars`);

  if (sourceMap.sources?.length > 0) {
    log('\n📁 Source Files:', 'cyan');
    sourceMap.sources.forEach((source, i) => {
      const hasContent = sourceMap.sourcesContent?.[i];
      const icon = hasContent ? '✓' : '✗';
      const color = hasContent ? 'green' : 'yellow';
      log(`  ${icon} ${source}`, color);
      if (hasContent) {
        const lines = sourceMap.sourcesContent[i].split('\n').length;
        log(`    → ${lines} lines, ${sourceMap.sourcesContent[i].length} chars`, 'gray');
      }
    });
  }

  // Create TraceMap instance
  let traceMap;
  try {
    // TraceMap expects the sourcemap and the URL of the generated file
    traceMap = new TraceMap(sourceMap, jsFilePath);
    log('\n✅ TraceMap created successfully!', 'green');
  } catch (e) {
    log(`\n❌ Failed to create TraceMap: ${e.message}`, 'red');
    return;
  }

  // Analyze mappings
  log('\n🔍 Mapping Analysis:', 'cyan');

  let mappingCount = 0;
  let minGenLine = Infinity, maxGenLine = -1;
  let minOrigLine = Infinity, maxOrigLine = -1;
  const sourcesUsed = new Set();

  eachMapping(traceMap, (mapping) => {
    mappingCount++;

    // Track generated line range
    if (mapping.generatedLine < minGenLine) minGenLine = mapping.generatedLine;
    if (mapping.generatedLine > maxGenLine) maxGenLine = mapping.generatedLine;

    // Track original line range
    if (mapping.originalLine !== null) {
      if (mapping.originalLine < minOrigLine) minOrigLine = mapping.originalLine;
      if (mapping.originalLine > maxOrigLine) maxOrigLine = mapping.originalLine;
      if (mapping.source) sourcesUsed.add(mapping.source);
    }
  });

  log(`  Total mappings: ${mappingCount}`);
  log(`  Generated lines: ${minGenLine}-${maxGenLine}`);
  log(`  Original lines: ${minOrigLine === Infinity ? 'none' : `${minOrigLine}-${maxOrigLine}`}`);
  log(`  Sources referenced: ${sourcesUsed.size}/${sourceMap.sources?.length || 0}`);

  // Test some sample mappings
  log('\n🎯 Sample Position Mappings:', 'cyan');

  // Test mapping from generated positions
  const testPositions = [
    { line: 1, column: 0 },
    { line: 10, column: 0 },
    { line: Math.floor(maxGenLine / 2), column: 0 },
    { line: maxGenLine - 1, column: 0 }
  ];

  testPositions.forEach(pos => {
    if (pos.line <= maxGenLine) {
      const original = originalPositionFor(traceMap, pos);
      if (original.source) {
        log(`  Generated ${pos.line}:${pos.column} → ${original.source}:${original.line}:${original.column}`, 'green');
        if (original.name) {
          log(`    Name: ${original.name}`, 'gray');
        }
      } else {
        log(`  Generated ${pos.line}:${pos.column} → (no mapping)`, 'yellow');
      }
    }
  });

  // Find errors in the generated code and map them back
  const jsContent = fs.readFileSync(jsFilePath, 'utf-8');
  const lines = jsContent.split('\n');

  log('\n🔎 Searching for error patterns:', 'cyan');
  lines.forEach((line, index) => {
    // Look for common error patterns
    if (line.includes('throw') || line.includes('Error') || line.includes('testfail')) {
      const lineNum = index + 1;
      const col = line.search(/throw|Error|testfail/);
      const original = originalPositionFor(traceMap, { line: lineNum, column: col });

      log(`  Found "${line.trim().substring(0, 50)}..." at line ${lineNum}`, 'yellow');
      if (original.source) {
        log(`    → Maps to ${original.source}:${original.line}:${original.column}`, 'green');
      } else {
        log(`    → No source mapping found`, 'red');
      }
    }
  });

  return traceMap;
}

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: node validate-with-trace-mapping.js <file.js>');
    process.exit(1);
  }

  const inputFile = path.resolve(args[0]);

  if (!fs.existsSync(inputFile)) {
    console.error(`Error: File not found: ${inputFile}`);
    process.exit(1);
  }

  log(`\n🔧 @jridgewell/trace-mapping Sourcemap Validator`, 'bright');
  log(`${'=' .repeat(50)}`, 'gray');
  log(`File: ${inputFile}`, 'cyan');

  // Read the file
  const content = fs.readFileSync(inputFile, 'utf-8');
  log(`Size: ${content.length} bytes, ${content.split('\n').length} lines`);

  // Extract inline sourcemap
  log('\n📦 Extracting inline sourcemap...', 'cyan');
  let sourceMap;
  try {
    sourceMap = extractInlineSourceMap(content);
    if (!sourceMap) {
      log('❌ No inline sourcemap found!', 'red');
      log('   Expected: //# sourceMappingURL=data:application/json;base64,...', 'gray');
      process.exit(1);
    }
    log('✅ Inline sourcemap extracted successfully!', 'green');
  } catch (e) {
    log(`❌ ${e.message}`, 'red');
    process.exit(1);
  }

  // Analyze the sourcemap
  const traceMap = analyzeSourceMap(sourceMap, inputFile);

  if (traceMap) {
    log('\n✨ Validation Complete!', 'green');
    log('   Your sourcemap is parseable by the same library Chrome uses internally.', 'gray');
    log('   If mappings are showing above, your sourcemap should work in DevTools.', 'gray');
  } else {
    log('\n❌ Validation Failed!', 'red');
    log('   The sourcemap could not be parsed by trace-mapping.', 'gray');
    log('   This means Chrome DevTools would also fail to use it.', 'gray');
  }

  log('');
}

main();