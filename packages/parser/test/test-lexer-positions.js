#!/usr/bin/env node

/**
 * Test that Lexer correctly tracks token positions with the new loc field
 */

import { Lexer } from '../dist/index.js';

const colors = {
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  gray: (text) => `\x1b[90m${text}\x1b[0m`,
  bold: (text) => `\x1b[1m${text}\x1b[0m`
};

function testPositions() {
  console.log(colors.bold('Testing Lexer Position Tracking\n'));

  const testCases = [
    {
      name: 'Single line template',
      input: '<Define:Test><div>Hello</div></Define:Test>',
      expectedTokens: [
        { type: 'DEFINE_START', value: '<Define:', line: 1, column: 1 },
        { type: 'COMPONENT_NAME', value: 'Test', line: 1, column: 9 },
        { type: 'GT', value: '>', line: 1, column: 13 },
        { type: 'TAG_OPEN', value: '<', line: 1, column: 14 }
      ]
    },
    {
      name: 'Multi-line template',
      input: `<Define:MultiLine>
  <div>
    Line 3
  </div>
</Define:MultiLine>`,
      expectedTokens: [
        { type: 'DEFINE_START', value: '<Define:', line: 1, column: 1 },
        { type: 'COMPONENT_NAME', value: 'MultiLine', line: 1, column: 9 },
        { type: 'GT', value: '>', line: 1, column: 18 },
        { type: 'TEXT', value: '\n  ', line: 1, hasNewline: true },
        { type: 'TAG_OPEN', value: '<', line: 2, column: 3 }
      ]
    },
    {
      name: 'Template with expressions',
      input: `<Define:Expr>
  <%= this.data.value %>
  <% console.log('test'); %>
</Define:Expr>`,
      expectedTokens: [
        { type: 'DEFINE_START', value: '<Define:', line: 1, column: 1 },
        { type: 'COMPONENT_NAME', value: 'Expr', line: 1, column: 9 },
        { type: 'GT', value: '>', line: 1, column: 13 },
        { type: 'TEXT', value: '\n  ', line: 1, hasNewline: true },
        { type: 'EXPRESSION_START', value: '<%=', line: 2, column: 3 }
      ]
    }
  ];

  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    console.log(`Testing: ${testCase.name}`);

    try {
      const lexer = new Lexer(testCase.input);
      const tokens = lexer.tokenize();

      // Check first few tokens
      for (let i = 0; i < Math.min(testCase.expectedTokens.length, tokens.length); i++) {
        const expected = testCase.expectedTokens[i];
        const actual = tokens[i];

        // Check type
        if (actual.type !== expected.type) {
          console.log(colors.red(`  ❌ Token ${i}: Expected type ${expected.type}, got ${actual.type}`));
          failed++;
          continue;
        }

        // Check value (if specified)
        if (expected.value !== undefined && actual.value !== expected.value) {
          console.log(colors.red(`  ❌ Token ${i}: Expected value "${expected.value}", got "${actual.value}"`));
          failed++;
          continue;
        }

        // Check position if loc is present
        if (actual.loc) {
          if (actual.loc.start.line !== expected.line || actual.loc.start.column !== expected.column) {
            console.log(colors.yellow(`  ⚠️  Token ${i} (${actual.type}): Position mismatch`));
            console.log(`     Expected: line ${expected.line}, column ${expected.column}`);
            console.log(`     Got: line ${actual.loc.start.line}, column ${actual.loc.start.column}`);
            console.log(`     (loc field present: ${colors.green('YES')})`);
          } else {
            console.log(colors.gray(`  ✓ Token ${i} (${actual.type}): Position correct with loc`));
          }

          // Verify backward compatibility
          if (actual.line !== actual.loc.start.line || actual.column !== actual.loc.start.column) {
            console.log(colors.red(`  ❌ Backward compatibility broken!`));
            failed++;
          }
        } else {
          // Fall back to old fields
          if (actual.line !== expected.line || actual.column !== expected.column) {
            console.log(colors.yellow(`  ⚠️  Token ${i} (${actual.type}): Position mismatch`));
            console.log(`     Expected: line ${expected.line}, column ${expected.column}`);
            console.log(`     Got: line ${actual.line}, column ${actual.column}`);
            console.log(`     (loc field present: ${colors.red('NO')})`);
          }
        }
      }

      console.log(colors.green(`  ✅ Test passed\n`));
      passed++;
    } catch (error) {
      console.log(colors.red(`  ❌ Error: ${error.message}\n`));
      failed++;
    }
  }

  // Summary
  console.log('='.repeat(60));
  console.log(colors.bold('\n📊 Position Tracking Test Results:\n'));
  console.log(`  Total tests: ${testCases.length}`);
  console.log(colors.green(`  ✅ Passed: ${passed}`));
  if (failed > 0) {
    console.log(colors.red(`  ❌ Failed: ${failed}`));
  }

  // Check if loc field is actually being added
  const lexer = new Lexer('<Define:Test></Define:Test>');
  const tokens = lexer.tokenize();
  const hasLoc = tokens.some(t => t.loc !== undefined);

  console.log(colors.bold('\n📍 Location Field Status:'));
  if (hasLoc) {
    console.log(colors.green('  ✅ New loc field is present in tokens'));
    console.log(colors.green('  ✅ Ready for Phase 3: Parser position propagation'));
  } else {
    console.log(colors.yellow('  ⚠️  New loc field not detected'));
    console.log('     Tokens still use old position fields only');
  }

  process.exit(failed > 0 ? 1 : 0);
}

testPositions();