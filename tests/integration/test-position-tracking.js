#!/usr/bin/env node

/**
 * Test position tracking in JQHTML CodeGenerator
 */

import { Lexer, Parser, CodeGenerator } from './packages/parser/dist/index.js';

// Simple test template
const template = `<Define:TestComponent>
  <div class="test">
    <h1>Hello World</h1>
    <p>The answer is <%= 42 %></p>
    <span>More text here</span>
  </div>
</Define:TestComponent>`;

console.log('Testing JQHTML position tracking...\n');
console.log('Input template:');
console.log('---------------');
console.log(template);
console.log('\n');

try {
  // Parse the template
  const lexer = new Lexer(template);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens, template, 'test.jqhtml');
  const ast = parser.parse();

  // Create code generator with position tracking enabled
  const generator = new CodeGenerator();
  generator.setPositionTracking(true);

  // Generate code
  const result = generator.generate(ast);

  console.log('Generated code:');
  console.log('---------------');
  console.log(result.code);
  console.log('\n');

  // Get position log
  const positionLog = generator.getPositionLog();

  console.log('Position tracking log:');
  console.log('----------------------');
  console.log(`Total tracked emissions: ${positionLog.length}`);
  console.log('\nFirst 10 position entries:');

  positionLog.slice(0, 10).forEach((entry, i) => {
    console.log(`  ${i + 1}. Line ${entry.line}, Col ${entry.column}: "${entry.text}" ${entry.node ? `[${entry.node}]` : ''}`);
  });

  // Check that text nodes were tracked
  const textNodes = positionLog.filter(entry => entry.node && entry.node.startsWith('Text:'));
  console.log(`\nText nodes tracked: ${textNodes.length}`);

  // Check that expressions were tracked
  const expressionNodes = positionLog.filter(entry => entry.node && entry.node.startsWith('Expression:'));
  console.log(`Expression nodes tracked: ${expressionNodes.length}`);

  console.log('\n✅ Position tracking test completed successfully!');

} catch (error) {
  console.error('❌ Error during position tracking test:', error.message);
  console.error(error.stack);
  process.exit(1);
}