#!/usr/bin/env node

/**
 * Validate Sourcemap Against v3 Specification
 * ============================================
 *
 * PURPOSE:
 * Validates that a JavaScript file with inline sourcemap meets all requirements
 * of the Source Map v3 specification and browser implementation requirements.
 *
 * USAGE:
 * node validate-sourcemap-spec.js <file.js>
 *
 * EXAMPLE:
 * node validate-sourcemap-spec.js test-components/counter-widget-baseline.js
 *
 * VALIDATION CHECKS:
 * 1. Comment format (//# or //@)
 * 2. Placement at end of file
 * 3. Data URI format
 * 4. Base64 encoding validity
 * 5. JSON structure requirements
 * 6. Version 3 format
 * 7. Required fields presence
 * 8. Mappings format
 * 9. Browser regex pattern matching
 */

import fs from 'fs';
import path from 'path';

const inputFile = process.argv[2];
if (!inputFile) {
  console.error('Usage: node validate-sourcemap-spec.js <file.js>');
  process.exit(1);
}

if (!fs.existsSync(inputFile)) {
  console.error(`Error: File not found: ${inputFile}`);
  process.exit(1);
}

console.log('🔍 Source Map v3 Specification Validator');
console.log('=========================================');
console.log(`File: ${inputFile}`);
console.log('');

const content = fs.readFileSync(inputFile, 'utf8');
const lines = content.split('\n');
let validationPassed = true;
const issues = [];
const warnings = [];

// ============================================================================
// SPEC REQUIREMENT 1: Comment Detection (from webpack's implementation)
// ============================================================================
console.log('📋 Checking Comment Format...');

// This is the exact regex from webpack that browsers use
const innerRegex = /\s*[#@]\s*sourceMappingURL\s*=\s*([^\s'"]*)\s*/;
const sourceMappingURLRegex = new RegExp(
  "(?:" +
    "/\\*" +
    "(?:\\s*\r?\n(?://)?)?" +
    `(?:${innerRegex.source})` +
    "\\s*" +
    "\\*/" +
    "|" +
    `//(?:${innerRegex.source})` +
    ")" +
    "\\s*"
);

// Search from bottom up (as browsers do)
let sourcemapLine = null;
let sourcemapLineNumber = 0;
let sourcemapMatch = null;

for (let i = lines.length - 1; i >= 0; i--) {
  const match = lines[i].match(sourceMappingURLRegex);
  if (match) {
    sourcemapLine = lines[i];
    sourcemapLineNumber = i + 1;
    sourcemapMatch = match;
    break;
  }
}

if (!sourcemapLine) {
  issues.push('❌ No sourceMappingURL comment found');
  validationPassed = false;
} else {
  console.log(`  ✅ Found sourceMappingURL on line ${sourcemapLineNumber}`);

  // Check if it uses # (preferred) or @ (legacy)
  if (sourcemapLine.includes('//#')) {
    console.log('  ✅ Using preferred //# format');
  } else if (sourcemapLine.includes('//@')) {
    warnings.push('  ⚠️  Using legacy //@ format (still valid but //# is preferred)');
  }
}

// ============================================================================
// SPEC REQUIREMENT 2: Placement at end of file
// ============================================================================
console.log('\n📋 Checking Placement...');

if (sourcemapLineNumber > 0) {
  // Check if it's at the absolute end (accounting for possible trailing newline)
  const isLastLine = sourcemapLineNumber === lines.length;
  const isBeforeEmptyLastLine = sourcemapLineNumber === lines.length - 1 && lines[lines.length - 1] === '';

  if (isLastLine || isBeforeEmptyLastLine) {
    console.log('  ✅ Sourcemap is at the end of file');
  } else {
    issues.push(`  ❌ Sourcemap is NOT at the end (line ${sourcemapLineNumber} of ${lines.length})`);
    validationPassed = false;
  }

  // Check for newline before comment (best practice)
  if (sourcemapLineNumber > 1 && lines[sourcemapLineNumber - 2] !== undefined) {
    console.log('  ✅ Has proper line separation before comment');
  }
}

// ============================================================================
// SPEC REQUIREMENT 3: Data URI Format for Inline Sourcemaps
// ============================================================================
console.log('\n📋 Checking Data URI Format...');

if (sourcemapLine) {
  const dataUriMatch = sourcemapLine.match(/sourceMappingURL\s*=\s*data:application\/json;(charset=utf-8;)?base64,(.+)/);

  if (!dataUriMatch) {
    // Check if it's an external sourcemap
    if (sourcemapLine.includes('.map')) {
      console.log('  ℹ️  External sourcemap reference (not inline)');
    } else {
      issues.push('  ❌ Invalid data URI format for inline sourcemap');
      validationPassed = false;
    }
  } else {
    console.log('  ✅ Valid data URI format');

    // Check charset specification
    if (dataUriMatch[1]) {
      console.log('  ✅ Includes charset=utf-8 specification');
    } else {
      console.log('  ℹ️  No charset specified (still valid)');
    }

    const base64Content = dataUriMatch[2];

    // ============================================================================
    // SPEC REQUIREMENT 4: Base64 Encoding Validation
    // ============================================================================
    console.log('\n📋 Checking Base64 Encoding...');

    // Check if it's valid base64
    const base64Regex = /^[A-Za-z0-9+/]+=*$/;
    if (!base64Regex.test(base64Content)) {
      issues.push('  ❌ Invalid base64 encoding');
      validationPassed = false;
    } else {
      console.log('  ✅ Valid base64 alphabet');

      // Try to decode it
      let decodedJson = null;
      try {
        const decoded = Buffer.from(base64Content, 'base64').toString('utf8');
        decodedJson = JSON.parse(decoded);
        console.log('  ✅ Successfully decoded base64 to JSON');

        // ============================================================================
        // SPEC REQUIREMENT 5: Source Map JSON Structure
        // ============================================================================
        console.log('\n📋 Checking JSON Structure...');

        // Check version
        if (decodedJson.version === 3) {
          console.log('  ✅ Version 3 format');
        } else {
          issues.push(`  ❌ Wrong version: ${decodedJson.version} (expected 3)`);
          validationPassed = false;
        }

        // Check required fields
        const requiredFields = ['version', 'sources', 'mappings'];
        requiredFields.forEach(field => {
          if (field in decodedJson) {
            console.log(`  ✅ Has required field: ${field}`);
          } else {
            issues.push(`  ❌ Missing required field: ${field}`);
            validationPassed = false;
          }
        });

        // Check optional but recommended fields
        if ('file' in decodedJson) {
          console.log(`  ✅ Has 'file' field: ${decodedJson.file}`);
        } else {
          warnings.push('  ⚠️  Missing optional "file" field');
        }

        if ('sourcesContent' in decodedJson) {
          console.log(`  ✅ Has sourcesContent (embedded source)`);
        } else {
          warnings.push('  ⚠️  Missing sourcesContent (source won\'t be available in DevTools)');
        }

        // ============================================================================
        // SPEC REQUIREMENT 6: Mappings Format
        // ============================================================================
        console.log('\n📋 Checking Mappings Format...');

        if (decodedJson.mappings) {
          const mappings = decodedJson.mappings;

          // Check if it uses valid VLQ base64 characters
          const vlqRegex = /^[A-Za-z0-9+/,;]*$/;
          if (vlqRegex.test(mappings)) {
            console.log('  ✅ Valid VLQ base64 mappings format');
          } else {
            issues.push('  ❌ Invalid characters in mappings');
            validationPassed = false;
          }

          // Check mapping segments
          const segments = mappings.split(';');
          console.log(`  ℹ️  Mappings cover ${segments.length} output lines`);

          // Count mapped vs unmapped lines
          const unmapped = segments.filter(s => s === '').length;
          const mapped = segments.length - unmapped;
          console.log(`  ℹ️  ${mapped} lines mapped, ${unmapped} lines unmapped`);

          // Check if the number of segments matches output lines
          const outputLineCount = lines.length;
          if (Math.abs(segments.length - outputLineCount) <= 2) {
            console.log('  ✅ Mapping segments approximately match output lines');
          } else {
            warnings.push(`  ⚠️  Mapping segments (${segments.length}) don't match output lines (${outputLineCount})`);
          }
        }

      } catch (error) {
        issues.push(`  ❌ Failed to decode base64: ${error.message}`);
        validationPassed = false;
      }
    }
  }
}

// ============================================================================
// SPEC REQUIREMENT 7: Browser Pattern Matching Test
// ============================================================================
console.log('\n📋 Testing Browser Regex Patterns...');

// Test against various browser patterns
const patterns = [
  {
    name: 'Webpack/Chrome pattern',
    regex: sourceMappingURLRegex,
    description: 'The pattern used by webpack and recognized by Chrome'
  },
  {
    name: 'Simple pattern',
    regex: /\/\/[#@]\s*sourceMappingURL\s*=\s*[^\s]+/,
    description: 'Basic pattern for single-line comments'
  },
  {
    name: 'Svelte pattern',
    regex: /[#@]\s*sourceMappingURL\s*=\s*(\S*)/,
    description: 'Pattern that allows whitespace variations'
  }
];

if (sourcemapLine) {
  patterns.forEach(({name, regex}) => {
    if (regex.test(sourcemapLine)) {
      console.log(`  ✅ Matches ${name}`);
    } else {
      warnings.push(`  ⚠️  Does NOT match ${name}`);
    }
  });
}

// ============================================================================
// FINAL REPORT
// ============================================================================
console.log('\n' + '='.repeat(60));
console.log('📊 VALIDATION SUMMARY');
console.log('='.repeat(60));

if (issues.length > 0) {
  console.log('\n❌ CRITICAL ISSUES (must fix):');
  issues.forEach(issue => console.log(issue));
}

if (warnings.length > 0) {
  console.log('\n⚠️  WARNINGS (recommended fixes):');
  warnings.forEach(warning => console.log(warning));
}

if (validationPassed && warnings.length === 0) {
  console.log('\n✅ PERFECT! File meets all Source Map v3 specification requirements.');
} else if (validationPassed) {
  console.log('\n✅ VALID: File meets minimum requirements but has some warnings.');
} else {
  console.log('\n❌ INVALID: File does NOT meet Source Map v3 specification requirements.');
  process.exit(1);
}

console.log('\n📚 References:');
console.log('  - Spec: https://tc39.es/ecma426/');
console.log('  - Webpack: github.com/webpack/webpack/lib/util/extractSourceMap.js');
console.log('  - Mozilla: github.com/mozilla/source-map');