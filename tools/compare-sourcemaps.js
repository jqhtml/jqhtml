#!/usr/bin/env node

/**
 * Compare two JavaScript files with inline sourcemaps
 * Extracts, decodes, and compares their sourcemap structures
 */

import fs from 'fs';
import { SourceMapConsumer } from 'source-map';

const file1 = process.argv[2];
const file2 = process.argv[3];

if (!file1 || !file2) {
  console.error('Usage: node compare-sourcemaps.js <webpack.js> <jqhtml.js>');
  process.exit(1);
}

function extractSourcemap(jsContent) {
  const match = jsContent.match(/\/\/# sourceMappingURL=data:application\/json;(?:charset=utf-8;)?base64,([A-Za-z0-9+/=]+)/);
  if (!match) {
    throw new Error('No inline sourcemap found');
  }
  const base64 = match[1];
  const json = Buffer.from(base64, 'base64').toString('utf8');
  return JSON.parse(json);
}

function compareField(name, val1, val2) {
  if (JSON.stringify(val1) !== JSON.stringify(val2)) {
    console.log(`\n❌ DIFFERENCE in ${name}:`);
    console.log(`  Webpack: ${JSON.stringify(val1, null, 2).substring(0, 200)}`);
    console.log(`  JQHTML:  ${JSON.stringify(val2, null, 2).substring(0, 200)}`);
    return false;
  } else {
    console.log(`✓ ${name} matches`);
    return true;
  }
}

async function analyzeSourcemap(name, sourcemap) {
  console.log(`\n=== ${name} Sourcemap Analysis ===`);
  console.log(`Version: ${sourcemap.version} (type: ${typeof sourcemap.version})`);
  console.log(`File: ${sourcemap.file}`);
  console.log(`Sources: ${JSON.stringify(sourcemap.sources)}`);
  console.log(`Source Root: ${sourcemap.sourceRoot || '(not set)'}`);
  console.log(`Sources Content: ${sourcemap.sourcesContent ? sourcemap.sourcesContent.length + ' entries' : 'not present'}`);
  console.log(`Names: ${JSON.stringify(sourcemap.names)}`);

  // Analyze mappings
  const mappings = sourcemap.mappings;
  const lines = mappings.split(';');
  console.log(`Mappings: ${lines.length} lines`);

  // Check for empty lines at start
  let emptyLinesAtStart = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] === '') {
      emptyLinesAtStart++;
    } else {
      break;
    }
  }
  console.log(`Empty lines at start: ${emptyLinesAtStart}`);

  // First non-empty mapping
  const firstNonEmpty = lines.find(l => l !== '');
  console.log(`First non-empty mapping: ${firstNonEmpty ? firstNonEmpty.substring(0, 50) : 'none'}`);

  // Check mapping segments
  const nonEmptyLines = lines.filter(l => l !== '');
  console.log(`Non-empty mapping lines: ${nonEmptyLines.length}`);

  // Parse with source-map library to verify
  try {
    const consumer = await new SourceMapConsumer(sourcemap);

    // Try to find a mapping for line 1
    const pos1 = consumer.originalPositionFor({ line: 1, column: 0 });
    console.log(`Line 1 maps to: ${JSON.stringify(pos1)}`);

    // Try to find where error line maps
    const errorLine = 38; // The line where error occurs in output
    const posError = consumer.originalPositionFor({ line: errorLine, column: 0 });
    console.log(`Line ${errorLine} (error line) maps to: ${JSON.stringify(posError)}`);

    consumer.destroy();
  } catch (e) {
    console.error(`❌ Failed to parse with source-map library: ${e.message}`);
  }
}

async function main() {
  try {
    console.log('Loading files...');
    const content1 = fs.readFileSync(file1, 'utf-8');
    const content2 = fs.readFileSync(file2, 'utf-8');

    console.log(`File 1 size: ${content1.length} bytes`);
    console.log(`File 2 size: ${content2.length} bytes`);

    const sourcemap1 = extractSourcemap(content1);
    const sourcemap2 = extractSourcemap(content2);

    console.log('\n' + '='.repeat(60));
    console.log('STRUCTURAL COMPARISON');
    console.log('='.repeat(60));

    // Compare fields
    let allMatch = true;
    allMatch &= compareField('version', sourcemap1.version, sourcemap2.version);
    allMatch &= compareField('file', sourcemap1.file, sourcemap2.file);
    allMatch &= compareField('sources', sourcemap1.sources, sourcemap2.sources);
    allMatch &= compareField('sourceRoot', sourcemap1.sourceRoot || '', sourcemap2.sourceRoot || '');
    allMatch &= compareField('names', sourcemap1.names, sourcemap2.names);

    // Special handling for sourcesContent
    const hasContent1 = !!sourcemap1.sourcesContent;
    const hasContent2 = !!sourcemap2.sourcesContent;
    if (hasContent1 !== hasContent2) {
      console.log(`\n❌ DIFFERENCE in sourcesContent presence:`);
      console.log(`  Webpack: ${hasContent1 ? 'PRESENT' : 'ABSENT'}`);
      console.log(`  JQHTML:  ${hasContent2 ? 'PRESENT' : 'ABSENT'}`);
      allMatch = false;
    }

    // Compare mappings structure
    const lines1 = sourcemap1.mappings.split(';');
    const lines2 = sourcemap2.mappings.split(';');

    if (lines1.length !== lines2.length) {
      console.log(`\n❌ DIFFERENCE in mappings line count:`);
      console.log(`  Webpack: ${lines1.length} lines`);
      console.log(`  JQHTML:  ${lines2.length} lines`);
      allMatch = false;
    }

    // Detailed analysis
    await analyzeSourcemap('Webpack', sourcemap1);
    await analyzeSourcemap('JQHTML', sourcemap2);

    console.log('\n' + '='.repeat(60));
    if (allMatch) {
      console.log('✅ Sourcemaps are structurally identical');
    } else {
      console.log('❌ Sourcemaps have structural differences');
    }

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();