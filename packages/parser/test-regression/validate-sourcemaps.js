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
import { Lexer, Parser, CodeGenerator } from '../dist/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Colors for output
const colors = {
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  gray: (text) => `\x1b[90m${text}\x1b[0m`,
  bold: (text) => `\x1b[1m${text}\x1b[0m`
};

// Function to compile with sourcemap
function compileWithSourcemap(source, filename) {
  try {
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens, source, filename);
    const ast = parser.parse();

    const generator = new CodeGenerator();
    const result = generator.generateWithSourceMap(ast, filename, source);

    // Extract inline sourcemap if present
    let sourcemapData = null;
    const code = result.code;

    // Check for inline sourcemap in component render functions
    const components = Array.from(result.components.values());
    for (const comp of components) {
      const match = comp.render_function.match(/\/\/# sourceMappingURL=data:application\/json;base64,(.+)/);
      if (match) {
        try {
          const json = Buffer.from(match[1], 'base64').toString('utf8');
          sourcemapData = JSON.parse(json);
          break;
        } catch (e) {
          console.error('Failed to parse inline sourcemap:', e);
        }
      }
    }

    return {
      success: true,
      code,
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

  // Check for overly simple mappings (our current problem)
  const uniqueMappings = new Set(segments.filter(s => s !== ''));
  if (uniqueMappings.size < 3 && totalCount > 10) {
    issues.push(`Suspiciously simple mappings: only ${uniqueMappings.size} unique patterns for ${totalCount} lines`);
    issues.push(`Patterns: ${Array.from(uniqueMappings).join(', ')}`);
  }

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
    const lines = result.source.split('\n');

    // Test a few key positions
    for (let line = 1; line <= Math.min(lines.length, 10); line++) {
      const column = 0;

      // Try to map a generated position back to source
      const position = consumer.originalPositionFor({
        line: line + 10, // Assume ~10 lines of boilerplate
        column: column
      });

      tests.push({
        generated: { line: line + 10, column },
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
      source: `<Define:ComplexTest as="section">
  <h1><%= this.data.title %></h1>
  <% for (let i = 0; i < 3; i++): %>
    <p>Item <%= i %></p>
  <% endfor; %>
  <% if (this.data.show): %>
    <span>Conditional</span>
  <% endif; %>
</Define:ComplexTest>`
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

  // Summary
  console.log('='.repeat(60));
  if (allPassed) {
    console.log(colors.green('\n✅ Sourcemap validation passed!'));
  } else {
    console.log(colors.red('\n❌ Sourcemap validation failed!'));
    console.log('\nCurrent sourcemaps have known issues:');
    console.log('- Overly simplistic mappings (AAAA repeated)');
    console.log('- Not compatible with Firefox');
    console.log('- Need to use proper source-map library');
  }
}

main().catch(console.error);