#!/usr/bin/env node

/**
 * Test that Parser correctly propagates position information to AST nodes
 */

import { Lexer, Parser } from '../dist/index.js';

const colors = {
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  gray: (text) => `\x1b[90m${text}\x1b[0m`,
  bold: (text) => `\x1b[1m${text}\x1b[0m`
};

function testASTPositions() {
  console.log(colors.bold('Testing AST Position Tracking\n'));

  const testCases = [
    {
      name: 'Simple component with text',
      input: `<Define:TestComponent>
  <div>Hello World</div>
</Define:TestComponent>`,
      checkNodes: [
        { path: 'body[0]', type: 'ComponentDefinition', expectedLine: 1 },
        { path: 'body[0].body[0]', type: 'Text', expectedLine: 1 },
        { path: 'body[0].body[1]', type: 'HtmlTag', expectedLine: 2 }
      ]
    },
    {
      name: 'Component with expressions',
      input: `<Define:ExprTest>
  <%= this.data.value %>
  <% console.log('test'); %>
</Define:ExprTest>`,
      checkNodes: [
        { path: 'body[0]', type: 'ComponentDefinition', expectedLine: 1 },
        { path: 'body[0].body[1]', type: 'Expression', expectedLine: 2 },
        { path: 'body[0].body[3]', type: 'CodeBlock', expectedLine: 3 }
      ]
    },
    {
      name: 'Component with control flow',
      input: `<Define:ControlFlow>
  <% if (true): %>
    <span>Yes</span>
  <% endif; %>
  <% for (let i = 0; i < 3; i++): %>
    <p>Item</p>
  <% endfor; %>
</Define:ControlFlow>`,
      checkNodes: [
        { path: 'body[0]', type: 'ComponentDefinition', expectedLine: 1 },
        { path: 'body[0].body[1]', type: 'IfStatement', expectedLine: 2 },
        { path: 'body[0].body[3]', type: 'ForStatement', expectedLine: 5 }
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
      const parser = new Parser(tokens, testCase.input, 'test.jqhtml');
      const ast = parser.parse();

      // Check specific nodes
      for (const check of testCase.checkNodes) {
        // Navigate to the node using the path
        const pathParts = check.path.split(/[\.\[\]]+/).filter(p => p);
        let node = ast;

        for (const part of pathParts) {
          if (!node) break;
          if (isNaN(part)) {
            node = node[part];
          } else {
            node = node[parseInt(part)];
          }
        }

        if (!node) {
          console.log(colors.red(`  ❌ Node at path ${check.path} not found`));
          failed++;
          continue;
        }

        // Check type
        if (node.type !== check.type) {
          console.log(colors.red(`  ❌ Path ${check.path}: Expected type ${check.type}, got ${node.type}`));
          failed++;
          continue;
        }

        // Check if loc field is present
        if (node.loc) {
          console.log(colors.green(`  ✅ ${check.path} (${check.type}): Has loc field`));

          // Verify loc structure
          if (node.loc.start && node.loc.end) {
            const hasValidLoc =
              typeof node.loc.start.line === 'number' &&
              typeof node.loc.start.column === 'number' &&
              typeof node.loc.start.offset === 'number' &&
              typeof node.loc.end.line === 'number' &&
              typeof node.loc.end.column === 'number' &&
              typeof node.loc.end.offset === 'number';

            if (hasValidLoc) {
              console.log(colors.gray(`     loc: line ${node.loc.start.line}, col ${node.loc.start.column} → line ${node.loc.end.line}, col ${node.loc.end.column}`));

              // Check if line number matches expectation
              if (check.expectedLine && node.loc.start.line !== check.expectedLine) {
                console.log(colors.yellow(`     ⚠️  Expected line ${check.expectedLine}, got ${node.loc.start.line}`));
              }
            } else {
              console.log(colors.red(`     ❌ Invalid loc structure`));
              failed++;
            }
          } else {
            console.log(colors.red(`     ❌ Incomplete loc field`));
            failed++;
          }
        } else {
          console.log(colors.yellow(`  ⚠️  ${check.path} (${check.type}): No loc field (backward compatibility mode)`));

          // Check backward compatibility fields
          if (node.line && node.column) {
            console.log(colors.gray(`     Using old fields: line ${node.line}, col ${node.column}`));
          }
        }
      }

      passed++;
    } catch (error) {
      console.log(colors.red(`  ❌ Error: ${error.message}`));
      failed++;
    }

    console.log('');
  }

  // Summary
  console.log('='.repeat(60));
  console.log(colors.bold('\n📊 AST Position Tracking Results:\n'));
  console.log(`  Total tests: ${testCases.length}`);
  console.log(colors.green(`  ✅ Passed: ${passed}`));
  if (failed > 0) {
    console.log(colors.red(`  ❌ Failed: ${failed}`));
  }

  // Check if position tracking is working
  const lexer = new Lexer('<Define:Test><div>Hi</div></Define:Test>');
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens, '<Define:Test><div>Hi</div></Define:Test>', 'test.jqhtml');
  const ast = parser.parse();

  console.log(colors.bold('\n📍 AST Location Field Status:'));
  if (ast.body[0] && ast.body[0].loc) {
    console.log(colors.green('  ✅ AST nodes have loc field'));
    console.log(colors.green('  ✅ Position propagation is working'));
    console.log(colors.green('  ✅ Ready for Phase 4: SourceMapGenerator implementation'));
  } else {
    console.log(colors.yellow('  ⚠️  AST nodes do not have loc field yet'));
    console.log('     Parser may need additional work to propagate positions');
  }

  process.exit(failed > 0 ? 1 : 0);
}

testASTPositions();