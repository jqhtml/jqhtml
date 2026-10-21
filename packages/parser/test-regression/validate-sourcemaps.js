#!/usr/bin/env node

/**
 * Sourcemap Validation Tool for JQHTML Parser
 *
 * Validates that generated sourcemaps are spec-compliant and work correctly.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { SourceMapConsumer } from 'source-map';
import { compileTemplate } from '../dist/compiler.js';
import { SOURCEMAP_CASES, check_case } from './sourcemap-cases.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Colors for output
const colors = {
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  gray: (text) => `\x1b[90m${text}\x1b[0m`,
  bold: (text) => `\x1b[1m${text}\x1b[0m`
};

// Compile through the SAME entry point the build tooling uses.
//
// This tool previously drove CodeGenerator directly and looked for an inline map on
// each component's render_function. Nothing puts one there: compileTemplate() is what
// generates the sourcemap, and it appends it to the WRAPPED module output. So every
// run reported "No sourcemap generated" - the tool could not reach the code it was
// meant to validate, and never once exercised it.
function compileWithSourcemap(source, filename) {
  try {
    const { code } = compileTemplate(source, filename, { format: 'iife', sourcemap: true });

    // charset is part of the data URI compileTemplate emits; the old pattern omitted it
    const match = code.match(/\/\/# sourceMappingURL=data:application\/json;(?:charset=[^;,]+;)?base64,([A-Za-z0-9+/=]+)/);
    let sourcemapData = null;
    if (match) {
      try {
        sourcemapData = JSON.parse(Buffer.from(match[1], 'base64').toString('utf8'));
      } catch (e) {
        console.error('Failed to parse inline sourcemap:', e);
      }
    }

    // The code the map describes, without the trailing sourceMappingURL comment
    const generated = code.replace(/\n?\/\/# sourceMappingURL=.*$/, '');

    return {
      success: true,
      code: generated,
      sourcemap: sourcemapData,
      source,
      filename
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Function to validate sourcemap structure
function validateStructure(sourcemap) {
  const issues = [];

  // Check required fields
  if (sourcemap.version !== 3) {
    issues.push(`Invalid version: ${sourcemap.version} (expected 3)`);
  }

  if (!sourcemap.sources || !Array.isArray(sourcemap.sources)) {
    issues.push('Missing or invalid sources array');
  }

  if (!sourcemap.mappings || typeof sourcemap.mappings !== 'string') {
    issues.push('Missing or invalid mappings string');
  }

  // Check for empty mappings problem
  const segments = sourcemap.mappings.split(';');
  const emptyCount = segments.filter(s => s === '').length;
  const totalCount = segments.length;

  if (emptyCount > totalCount * 0.5) {
    issues.push(`Too many empty mappings: ${emptyCount}/${totalCount} (${Math.round(emptyCount/totalCount*100)}%)`);
  }

  // NOTE: render line N is source line N (codegen places every node on the line it is
  // written on), and each emitted node adds a segment for its own column. Exact
  // positions are asserted per construct in the "Exact positions" section below.

  return issues;
}

// Function to test mapping resolution
async function testMappingResolution(result) {
  if (!result.sourcemap) {
    return { success: false, error: 'No sourcemap found' };
  }

  try {
    // Use source-map library to parse and validate
    const consumer = await new SourceMapConsumer(result.sourcemap);

    const tests = [];

    // Probe every GENERATED line. The previous version probed `line + 10`, guessing at
    // a fixed amount of wrapper boilerplate, which walked off the end of any short
    // output and reported zero mappings for code that maps fine.
    const generated_lines = result.code.split('\n').length;
    for (let line = 1; line <= generated_lines; line++) {
      const position = consumer.originalPositionFor({ line, column: 0 });
      tests.push({
        generated: { line, column: 0 },
        original: position,
        hasMapping: position.source !== null
      });
    }

    consumer.destroy();

    return { success: true, tests };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Main validation
async function main() {
  console.log('🔍 Validating sourcemap generation...\n');

  // Test files
  const testCases = [
    {
      name: 'Simple component',
      source: `<Define:TestComponent>
  <div>Hello World</div>
  <%= console.log('Line 3') %>
</Define:TestComponent>`
    },
    {
      name: 'Component with error',
      source: `<Define:ErrorTest>
  <div>Test</div>
  <% console.log('Line 3'); %>
  <%= undefinedFunction() %> <!-- Line 4 -->
</Define:ErrorTest>`
    },
    {
      name: 'Complex component',
      source: `<Define:ComplexTest tag="section">
  <h1><%= this.data.title %></h1>
  <% for (let i = 0; i < 3; i++) { %>
    <p>Item <%= i %></p>
  <% } %>
  <% if (this.data.show) { %>
    <span>Conditional</span>
  <% } %>
</Define:ComplexTest>`
    },
    {
      // A body that renders nothing compiles to a one-line render function, so the
      // source is far longer than the code. This is the shape that used to emit one
      // mapping segment per SOURCE line - naming generated lines that do not exist,
      // which bundlers materialise as bare `undefined` identifiers.
      name: 'Comment header, empty body',
      source: `<%--
Two lines of comment
is enough
--%>
<Define:EmptyBody tag="div"></Define:EmptyBody>`
    }
  ];

  let allPassed = true;

  for (const testCase of testCases) {
    console.log(colors.bold(`Testing: ${testCase.name}`));

    const result = compileWithSourcemap(testCase.source, `${testCase.name}.jqhtml`);

    if (!result.success) {
      console.log(colors.red(`  ❌ Compilation failed: ${result.error}`));
      allPassed = false;
      continue;
    }

    if (!result.sourcemap) {
      console.log(colors.red(`  ❌ No sourcemap generated`));
      allPassed = false;
      continue;
    }

    // The map must name exactly as many generated lines as the code has. A segment for
    // a line that does not exist is a phantom line: consumers that rebuild output from
    // the map (SourceNode.fromStringWithSourceMap, used by bundlers to concatenate)
    // materialise each one as a bare `undefined` identifier, which throws at top level
    // when the bundle runs.
    const output_lines = result.code.split('\n').length;
    const segments = result.sourcemap.mappings.split(';').length;
    if (segments !== output_lines) {
      console.log(colors.red(`  ❌ Sourcemap describes ${segments} lines, output has ${output_lines}`));
      allPassed = false;
    } else {
      console.log(colors.green(`  ✅ Segment count matches output (${segments} lines)`));
    }

    // Validate structure
    const structureIssues = validateStructure(result.sourcemap);
    if (structureIssues.length > 0) {
      console.log(colors.yellow('  ⚠️  Structure issues:'));
      structureIssues.forEach(issue => {
        console.log(colors.yellow(`     - ${issue}`));
      });
      allPassed = false;
    } else {
      console.log(colors.green('  ✅ Structure valid'));
    }

    // Test mapping resolution
    const mappingTest = await testMappingResolution(result);
    if (!mappingTest.success) {
      console.log(colors.red(`  ❌ Mapping test failed: ${mappingTest.error}`));
      allPassed = false;
    } else {
      const validMappings = mappingTest.tests.filter(t => t.hasMapping).length;
      const totalTests = mappingTest.tests.length;

      if (validMappings === 0) {
        console.log(colors.red(`  ❌ No valid mappings found (0/${totalTests})`));
        allPassed = false;
      } else if (validMappings < totalTests / 2) {
        console.log(colors.yellow(`  ⚠️  Few valid mappings: ${validMappings}/${totalTests}`));
      } else {
        console.log(colors.green(`  ✅ Mappings work: ${validMappings}/${totalTests} valid`));
      }
    }

    console.log('');
  }

  // Exact positions: every probe of every shared case must map to its template line
  // and column (expected positions come from the template text, not from codegen)
  console.log(colors.bold('Exact positions (line and column)'));
  for (const c of SOURCEMAP_CASES) {
    let results;
    try {
      results = await check_case(c);
    } catch (error) {
      console.log(colors.red(`  ❌ ${c.name}: ${error.message}`));
      allPassed = false;
      continue;
    }
    const failures = results.filter((r) =>
      r.actual.line !== r.expected.line || r.actual.column !== r.expected.column ||
      !r.name_ok || !r.generated_line_ok);
    if (failures.length === 0) {
      console.log(colors.green(`  ✅ ${c.name}: ${results.length} probes exact`));
      continue;
    }
    allPassed = false;
    console.log(colors.red(`  ❌ ${c.name}`));
    for (const r of failures) {
      console.log(colors.red(
        `     ${JSON.stringify(r.probe.gen)}: expected ${r.expected.line}:${r.expected.column}, ` +
        `got ${r.actual.line}:${r.actual.column}` +
        (r.name_ok ? '' : ', wrong names entry') +
        (r.generated_line_ok ? '' : `, generated on render line ${r.generated_line}`)
      ));
    }
  }
  console.log('');

  // Summary
  console.log('='.repeat(60));
  if (allPassed) {
    console.log(colors.green('\n✅ Sourcemap validation passed!'));
  } else {
    console.log(colors.red('\n❌ Sourcemap validation failed!'));
    console.log('\nA failure here means generated code and its map disagree, so DevTools');
    console.log('and bundlers will resolve positions to the wrong place - or, when the map');
    console.log('overruns the file, inject bare `undefined` into the bundle.');
    process.exitCode = 1;
  }
}

main().catch(console.error);