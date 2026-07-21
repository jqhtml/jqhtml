#!/usr/bin/env node

/**
 * Decode and Analyze Inline Base64 Sourcemaps
 * ============================================
 *
 * PURPOSE:
 * Extracts and decodes base64-encoded inline sourcemaps from JavaScript files,
 * displaying the decoded JSON in a readable format with analysis.
 *
 * USAGE:
 * node _decode-inline-sourcemap.js <file.js>
 *
 * EXAMPLE:
 * node _decode-inline-sourcemap.js test-components/counter-widget-baseline.js
 *
 * OUTPUT:
 * - Decoded sourcemap JSON (pretty-printed)
 * - Analysis of mappings
 * - Line count information
 * - Source file references
 */

import fs from 'fs';
import path from 'path';

// Check command line arguments
const inputFile = process.argv[2];
if (!inputFile) {
  console.error('Usage: node _decode-inline-sourcemap.js <file.js>');
  console.error('');
  console.error('Extracts and decodes inline base64 sourcemaps from JavaScript files');
  process.exit(1);
}

if (!fs.existsSync(inputFile)) {
  console.error(`Error: File not found: ${inputFile}`);
  process.exit(1);
}

console.log('📍 Inline Sourcemap Decoder');
console.log('============================');
console.log(`Input file: ${inputFile}`);
console.log('');

// Read the file
const content = fs.readFileSync(inputFile, 'utf8');
const lines = content.split('\n');

// Search for sourceMappingURL comment (from bottom up, like browsers do)
let sourcemapLine = null;
let lineNumber = 0;

for (let i = lines.length - 1; i >= 0; i--) {
  const line = lines[i];
  // Match both //# and //@ formats, with inline base64 data
  const match = line.match(/\/\/[#@]\s*sourceMappingURL\s*=\s*data:application\/json;(?:charset=utf-8;)?base64,(.+)/);
  if (match) {
    sourcemapLine = match[1];
    lineNumber = i + 1;
    break;
  }
}

if (!sourcemapLine) {
  console.error('❌ No inline base64 sourcemap found in file');
  console.error('');
  console.error('Searched for patterns:');
  console.error('  //# sourceMappingURL=data:application/json;base64,...');
  console.error('  //@ sourceMappingURL=data:application/json;base64,...');
  console.error('  //# sourceMappingURL=data:application/json;charset=utf-8;base64,...');
  process.exit(1);
}

console.log(`✅ Found sourcemap on line ${lineNumber} of ${lines.length}`);
console.log('');

// Decode base64
let decoded;
try {
  const json = Buffer.from(sourcemapLine, 'base64').toString('utf8');
  decoded = JSON.parse(json);
} catch (error) {
  console.error('❌ Failed to decode sourcemap:', error.message);
  console.error('');
  console.error('Base64 string length:', sourcemapLine.length);
  console.error('First 100 chars:', sourcemapLine.substring(0, 100));
  process.exit(1);
}

// Display the decoded sourcemap
console.log('📄 Decoded Sourcemap:');
console.log('---------------------');
console.log(JSON.stringify(decoded, null, 2));
console.log('');

// Analyze the mappings
console.log('🔍 Sourcemap Analysis:');
console.log('----------------------');
console.log(`Version: ${decoded.version}`);
console.log(`Output file: ${decoded.file || '(not specified)'}`);
console.log(`Source files: ${decoded.sources ? decoded.sources.join(', ') : '(none)'}`);
console.log(`Source root: ${decoded.sourceRoot || '(none)'}`);
console.log('');

if (decoded.mappings) {
  // Analyze mappings string
  const mappings = decoded.mappings;
  const segments = mappings.split(';');

  console.log('📊 Mappings Analysis:');
  console.log(`  Total output lines mapped: ${segments.length}`);

  // Count empty vs non-empty segments
  let emptySegments = 0;
  let nonEmptySegments = 0;

  segments.forEach((segment, idx) => {
    if (segment === '') {
      emptySegments++;
    } else {
      nonEmptySegments++;
    }
  });

  console.log(`  Empty segments (unmapped lines): ${emptySegments}`);
  console.log(`  Non-empty segments (mapped lines): ${nonEmptySegments}`);
  console.log('');

  // Show first few mapping segments
  console.log('  First 10 mapping segments:');
  for (let i = 0; i < Math.min(10, segments.length); i++) {
    const segment = segments[i];
    if (segment === '') {
      console.log(`    Line ${i + 1}: (no mapping)`);
    } else {
      console.log(`    Line ${i + 1}: ${segment}`);
    }
  }

  if (segments.length > 10) {
    console.log(`    ... and ${segments.length - 10} more lines`);
  }
}

// Check for sourcesContent
if (decoded.sourcesContent) {
  console.log('');
  console.log('📝 Sources Content:');
  console.log(`  Embedded source files: ${decoded.sourcesContent.length}`);
  decoded.sourcesContent.forEach((content, idx) => {
    if (content) {
      const lineCount = content.split('\n').length;
      console.log(`  Source ${idx}: ${lineCount} lines`);
    }
  });
}

// Validate format
console.log('');
console.log('✔️ Validation:');
if (lineNumber === lines.length || (lineNumber === lines.length - 1 && lines[lines.length - 1] === '')) {
  console.log('  ✅ Sourcemap is at the end of file (correct placement)');
} else {
  console.log(`  ⚠️  Sourcemap is NOT at the end (line ${lineNumber} of ${lines.length})`);
}

if (decoded.version === 3) {
  console.log('  ✅ Using sourcemap version 3 (correct)');
} else {
  console.log(`  ⚠️  Using sourcemap version ${decoded.version} (expected 3)`);
}

if (decoded.sources && decoded.sources.length > 0) {
  console.log('  ✅ Source files are specified');
} else {
  console.log('  ⚠️  No source files specified');
}

console.log('');
console.log('✨ Analysis complete');