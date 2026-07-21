#!/usr/bin/env node

/**
 * Check Specific Line Mapping in Sourcemap
 * =========================================
 *
 * PURPOSE:
 * Checks what a specific line in a JavaScript file maps to in the sourcemap.
 *
 * USAGE:
 * node _check-line-mapping.js <file.js> <line-number>
 *
 * EXAMPLE:
 * node _check-line-mapping.js test-components/counter-widget-baseline.js 35
 */

import fs from 'fs';
import { SourceMapConsumer } from 'source-map';

const inputFile = process.argv[2];
const targetLine = parseInt(process.argv[3]);

if (!inputFile || !targetLine) {
  console.error('Usage: node _check-line-mapping.js <file.js> <line-number>');
  process.exit(1);
}

const content = fs.readFileSync(inputFile, 'utf8');
const lines = content.split('\n');

// Find sourcemap
let sourcemapBase64 = null;
for (let i = lines.length - 1; i >= 0; i--) {
  const match = lines[i].match(/\/\/[#@]\s*sourceMappingURL\s*=\s*data:application\/json;(?:charset=utf-8;)?base64,(.+)/);
  if (match) {
    sourcemapBase64 = match[1];
    break;
  }
}

if (!sourcemapBase64) {
  console.error('No inline sourcemap found');
  process.exit(1);
}

const sourcemap = JSON.parse(Buffer.from(sourcemapBase64, 'base64').toString('utf8'));

console.log(`\n📍 Line ${targetLine} in ${inputFile}:`);
console.log(`Content: ${lines[targetLine - 1]?.substring(0, 80)}${lines[targetLine - 1]?.length > 80 ? '...' : ''}`);

// Parse mappings manually
const mappings = sourcemap.mappings.split(';');
const segment = mappings[targetLine - 1];

if (!segment || segment === '') {
  console.log(`❌ Line ${targetLine} has NO source mapping`);
} else {
  console.log(`✅ Line ${targetLine} has mapping: ${segment}`);

  // Use source-map library to get exact position
  SourceMapConsumer.with(sourcemap, null, consumer => {
    const pos = consumer.originalPositionFor({
      line: targetLine,
      column: 0
    });

    if (pos.source) {
      console.log(`\n📄 Maps to:`);
      console.log(`  Source: ${pos.source}`);
      console.log(`  Line: ${pos.line}`);
      console.log(`  Column: ${pos.column}`);

      if (sourcemap.sourcesContent && sourcemap.sourcesContent[0]) {
        const sourceLines = sourcemap.sourcesContent[0].split('\n');
        if (pos.line && sourceLines[pos.line - 1]) {
          console.log(`  Source content: ${sourceLines[pos.line - 1].substring(0, 80)}`);
        }
      }
    } else {
      console.log(`❌ No source position found`);
    }
  });
}