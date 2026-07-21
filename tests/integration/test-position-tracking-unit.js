#!/usr/bin/env node

/**
 * Unit tests for position tracking - manual runner
 */

import { Lexer, Parser, CodeGenerator } from './packages/parser/dist/index.js';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (error) {
    console.log(`❌ ${name}: ${error.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

console.log('Running position tracking unit tests...\n');

// Test 1: Track text nodes
test('should track text node positions', () => {
  const template = `<Define:Test>
    <div>Hello World</div>
  </Define:Test>`;

  const lexer = new Lexer(template);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens, template, 'test.jqhtml');
  const ast = parser.parse();

  const generator = new CodeGenerator();
  generator.setPositionTracking(true);
  generator.generate(ast);

  const log = generator.getPositionLog();
  const textNodes = log.filter(entry => entry.node && entry.node.startsWith('Text:'));

  assert(textNodes.length > 0, 'Should track at least one text node');
  assert(textNodes[0].text.includes('_output.push'), 'Should track the generated push statement');
});

// Test 2: Track expression nodes
test('should track expression node positions', () => {
  const template = `<Define:Test>
    <div><%= "test" %></div>
  </Define:Test>`;

  const lexer = new Lexer(template);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens, template, 'test.jqhtml');
  const ast = parser.parse();

  const generator = new CodeGenerator();
  generator.setPositionTracking(true);
  generator.generate(ast);

  const log = generator.getPositionLog();
  const expressionNodes = log.filter(entry => entry.node && entry.node.startsWith('Expression:'));

  assert(expressionNodes.length > 0, 'Should track at least one expression node');
});

// Test 3: Track line and column numbers
test('should track line and column numbers', () => {
  const template = `<Define:Test>
    <div>
      <p>Line 3</p>
      <p>Line 4</p>
    </div>
  </Define:Test>`;

  const lexer = new Lexer(template);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens, template, 'test.jqhtml');
  const ast = parser.parse();

  const generator = new CodeGenerator();
  generator.setPositionTracking(true);
  generator.generate(ast);

  const log = generator.getPositionLog();

  // Should have multiple tracked positions
  assert(log.length > 0, 'Should track multiple positions');

  // Each entry should have line and column
  log.forEach(entry => {
    assert(entry.line >= 1, 'Line number should be >= 1');
    assert(entry.column >= 0, 'Column number should be >= 0');
  });
});

// Test 4: Should not break code generation
test('should not break code generation', () => {
  const template = `<Define:Test>
    <div class="test">
      <h1><%= this.data.title %></h1>
      <% if (this.data.show): %>
        <p>Content</p>
      <% endif; %>
    </div>
  </Define:Test>`;

  const lexer = new Lexer(template);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens, template, 'test.jqhtml');
  const ast = parser.parse();

  const generator = new CodeGenerator();
  generator.setPositionTracking(true);
  const result = generator.generate(ast);

  // Should generate valid code
  assert(result.code.includes('function render'), 'Should generate render function');
  assert(result.code.includes('_output.push'), 'Should generate output statements');
  assert(result.components.has('Test'), 'Should have the Test component');
});

// Test 5: Work with position tracking disabled
test('should work with position tracking disabled', () => {
  const template = `<Define:Test><div>Test</div></Define:Test>`;

  const lexer = new Lexer(template);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens, template, 'test.jqhtml');
  const ast = parser.parse();

  const generator = new CodeGenerator();
  // Don't enable position tracking
  const result = generator.generate(ast);

  const log = generator.getPositionLog();

  // Log should be empty when tracking is disabled
  assert(log.length === 0, 'Position log should be empty when tracking is disabled');

  // Should still generate valid code
  assert(result.code.includes('function render'), 'Should still generate code without tracking');
});

// Test 6: Complex template tracking
test('should track complex template with multiple node types', () => {
  const template = `<Define:Complex>
    <div class="container">
      <h1>Title</h1>
      <%= this.data.greeting %>
      <% for (let i = 0; i < 3; i++): %>
        <p>Item <%= i %></p>
      <% endfor; %>
    </div>
  </Define:Complex>`;

  const lexer = new Lexer(template);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens, template, 'test.jqhtml');
  const ast = parser.parse();

  const generator = new CodeGenerator();
  generator.setPositionTracking(true);
  const result = generator.generate(ast);

  const log = generator.getPositionLog();

  // Should track various node types
  const textNodes = log.filter(e => e.node && e.node.startsWith('Text:'));
  const expressionNodes = log.filter(e => e.node && e.node.startsWith('Expression:'));

  assert(textNodes.length > 0, 'Should track text nodes in complex template');
  assert(expressionNodes.length > 0, 'Should track expression nodes in complex template');
  assert(result.code.length > 0, 'Should generate code for complex template');
});

// Summary
console.log('\n' + '='.repeat(50));
console.log(`Tests completed: ${passed} passed, ${failed} failed`);
if (failed === 0) {
  console.log('🎉 All position tracking tests passed!');
} else {
  console.log('⚠️ Some tests failed. Please review the results above.');
  process.exit(1);
}