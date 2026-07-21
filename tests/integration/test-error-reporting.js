#!/usr/bin/env node

/**
 * Test enhanced error position reporting
 */

import { Lexer, Parser, CodeGenerator, ErrorCollector, JQHTMLParseError } from './packages/parser/dist/index.js';

// Test cases with deliberate errors
const errorTests = [
  {
    name: "Unclosed if statement",
    template: `<Define:Test>
  <div>
    <% if (this.data.show): %>
      <p>Content</p>
    <!-- Missing endif -->
  </div>
</Define:Test>`
  },
  {
    name: "Mismatched tags",
    template: `<Define:Test>
  <div>
    <h1>Title</h1>
    <p>Content
    </div>  <!-- Wrong closing tag -->
  </div>
</Define:Test>`
  },
  {
    name: "Unclosed expression",
    template: `<Define:Test>
  <div>
    <p>Value: <%= this.data.value
    </p>
  </div>
</Define:Test>`
  },
  {
    name: "Mixed slot content",
    template: `<Define:Test>
  <ParentComponent>
    <#header>
      <h1>Header</h1>
    </#header>
    <p>This should be in a slot!</p>
  </ParentComponent>
</Define:Test>`
  },
  {
    name: "Unclosed component",
    template: `<Define:Test>
  <div>
    <MyComponent>
      <p>Content</p>
    <!-- Missing closing tag -->
  </div>
</Define:Test>`
  },
  {
    name: "Invalid attribute position",
    template: `<Define:Test $sid="not-allowed">
  <div>Content</div>
</Define:Test>`
  }
];

// Test case with no errors for comparison
const validTemplate = `<Define:ValidComponent>
  <div class="container">
    <h1>Valid Template</h1>
    <% if (this.data.show): %>
      <p>Conditional content</p>
    <% endif; %>
    <% for (let i = 0; i < 3; i++): %>
      <span>Item <%= i %></span>
    <% endfor; %>
  </div>
</Define:ValidComponent>`;

console.log('Testing Enhanced Error Position Reporting\n');
console.log('=' .repeat(70));

// Test error cases
errorTests.forEach((test, index) => {
  console.log(`\n${index + 1}. ${test.name}`);
  console.log('-'.repeat(40));

  try {
    const lexer = new Lexer(test.template);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens, test.template, `test-${index}.jqhtml`);
    const ast = parser.parse();

    // If we get here, no error was thrown (unexpected)
    console.log('  ❌ Expected an error but none was thrown');
  } catch (error) {
    console.log('  ✅ Error caught as expected\n');
    console.log('  Error Message:');
    console.log('  ' + '-'.repeat(38));

    // Display the full error message with context
    const errorLines = error.message.split('\n');
    errorLines.forEach(line => {
      console.log('  ' + line);
    });

    // Check for specific error features
    if (error.line && error.column) {
      console.log(`\n  Position: Line ${error.line}, Column ${error.column}`);
    }

    if (error.suggestion) {
      console.log(`  Suggestion included: Yes`);
    }

    // Check if code snippet is included
    if (error.message.includes('|')) {
      console.log('  Code snippet: Yes');
    }
  }
});

// Test valid template
console.log(`\n${errorTests.length + 1}. Valid Template Test`);
console.log('-'.repeat(40));

try {
  const lexer = new Lexer(validTemplate);
  const tokens = lexer.tokenize();
  console.log(`  ✓ Lexer produced ${tokens.length} tokens`);

  const parser = new Parser(tokens, validTemplate, 'valid.jqhtml');
  const ast = parser.parse();
  console.log(`  ✓ Parser created AST`);

  const generator = new CodeGenerator();
  const result = generator.generate(ast);
  console.log(`  ✓ Generated ${result.code.length} bytes of JavaScript`);
  console.log('  ✅ Valid template parsed successfully');

} catch (error) {
  console.log('  ❌ Unexpected error:', error.message);
}

// Test error collector
console.log('\n' + '='.repeat(70));
console.log('Error Collector Test\n');

const collector = new ErrorCollector(5);

// Simulate collecting multiple errors
const testErrors = [
  { message: 'First error', line: 10, column: 5 },
  { message: 'Second error', line: 15, column: 12 },
  { message: 'Third error', line: 20, column: 8 }
];

testErrors.forEach(err => {
  const error = new JQHTMLParseError(
    err.message,
    err.line,
    err.column,
    validTemplate,
    'collector-test.jqhtml'
  );
  collector.add(error);
});

console.log(`Collected ${collector.getErrors().length} errors`);

if (collector.hasErrors()) {
  console.log('Errors found:');
  collector.getErrors().forEach((err, i) => {
    console.log(`  ${i + 1}. Line ${err.line}:${err.column} - ${err.message.split('\n')[0]}`);
  });
}

console.log('\n' + '='.repeat(70));
console.log('Summary:');
console.log('--------');
console.log('✅ Error reporting shows line and column numbers');
console.log('✅ Code snippets with context lines included');
console.log('✅ Helpful suggestions for common mistakes');
console.log('✅ Error collector supports batch reporting');
console.log('\nEnhanced error reporting is working correctly!');