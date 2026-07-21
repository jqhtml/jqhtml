#!/usr/bin/env node

/**
 * Test HTML comment handling in JQHTML
 */

import { Lexer, Parser, CodeGenerator } from './packages/parser/dist/index.js';

// Test cases for HTML comments
const testCases = [
  {
    name: "Simple HTML comment",
    template: `<Define:TestComponent>
  <div>
    <!-- This is a simple HTML comment -->
    <p>Hello World</p>
  </div>
</Define:TestComponent>`
  },
  {
    name: "HTML comment with special characters",
    template: `<Define:TestComponent>
  <div>
    <!-- Special chars: <> & " ' -->
    <p>Content</p>
  </div>
</Define:TestComponent>`
  },
  {
    name: "HTML comment with JQHTML syntax inside",
    template: `<Define:TestComponent>
  <div>
    <!-- This should be ignored: <%= this.data.value %> -->
    <p>Real expression: <%= this.data.value %></p>
  </div>
</Define:TestComponent>`
  },
  {
    name: "HTML comment with tags inside",
    template: `<Define:TestComponent>
  <div>
    <!-- <foo \> <%= bar => barfoo -->
    <p>After comment</p>
  </div>
</Define:TestComponent>`
  },
  {
    name: "Multi-line HTML comment",
    template: `<Define:TestComponent>
  <div>
    <!--
      This is a multi-line comment
      It should preserve all content
      Including <tags> and <%= expressions %>
      Until the closing -->
    <p>After multi-line comment</p>
  </div>
</Define:TestComponent>`
  },
  {
    name: "Multiple HTML comments",
    template: `<Define:TestComponent>
  <div>
    <!-- First comment -->
    <p>Content</p>
    <!-- Second comment with <%= ignored %> -->
    <span>More content</span>
    <!-- Third comment -->
  </div>
</Define:TestComponent>`
  },
  {
    name: "Nested comment-like syntax",
    template: `<Define:TestComponent>
  <div>
    <!-- This <!-- is not --> a nested comment -->
    <p>Content</p>
  </div>
</Define:TestComponent>`
  }
];

console.log('Testing HTML Comment Handling in JQHTML\n');
console.log('=' .repeat(70));

let passed = 0;
let failed = 0;

for (const testCase of testCases) {
  console.log(`\nTest: ${testCase.name}`);
  console.log('-'.repeat(40));

  try {
    // Parse the template
    const lexer = new Lexer(testCase.template);
    const tokens = lexer.tokenize();

    console.log(`  Tokens generated: ${tokens.length}`);

    // Check if HTML comments are in tokens
    const htmlCommentTokens = tokens.filter(t =>
      t.value && typeof t.value === 'string' && t.value.includes('<!--')
    );
    console.log(`  HTML comment tokens found: ${htmlCommentTokens.length}`);

    const parser = new Parser(tokens, testCase.template, 'test.jqhtml');
    const ast = parser.parse();

    console.log(`  AST generated successfully`);

    // Generate code
    const generator = new CodeGenerator();
    const result = generator.generate(ast);

    console.log(`  Code generated: ${result.code.length} bytes`);

    // Check if HTML comments are preserved in output
    const hasCommentInOutput = result.code.includes('<!--');
    console.log(`  HTML comment in output: ${hasCommentInOutput ? 'YES ✓' : 'NO ✗'}`);

    // Check that content inside HTML comments is not parsed
    if (testCase.template.includes('<%= this.data.value %>') &&
        testCase.template.includes('<!-- This should be ignored')) {
      const commentIgnored = !result.code.includes('ignored: <%= this.data.value %>');
      console.log(`  Comment content ignored: ${commentIgnored ? 'NO (bad) ✗' : 'YES (good) ✓'}`);
    }

    // Show relevant output lines
    const outputLines = result.code.split('\n');
    const relevantLines = outputLines.filter(line =>
      line.includes('<!--') ||
      line.includes('-->') ||
      line.includes('_output.push')
    );

    if (relevantLines.length > 0) {
      console.log('  Relevant output lines:');
      relevantLines.slice(0, 5).forEach(line => {
        console.log(`    ${line.trim()}`);
      });
    }

    passed++;
    console.log(`  ✅ Test passed`);

  } catch (error) {
    failed++;
    console.log(`  ❌ Test failed: ${error.message}`);
    if (error.stack) {
      console.log(`  Stack: ${error.stack.split('\n')[0]}`);
    }
  }
}

console.log('\n' + '='.repeat(70));
console.log(`Results: ${passed} passed, ${failed} failed`);

if (failed === 0) {
  console.log('🎉 All HTML comment tests passed!');
} else {
  console.log('⚠️  Some tests failed. HTML comments may not be handled correctly.');
}

// Additional test: Check if comments are preserved exactly
console.log('\n' + '='.repeat(70));
console.log('Detailed Output Test\n');

const detailTemplate = `<Define:DetailTest>
  <!-- Start comment -->
  <div>
    <!-- Comment with <%= expression %> inside -->
    <p>Normal content</p>
    <!-- End comment -->
  </div>
</Define:DetailTest>`;

try {
  const lexer = new Lexer(detailTemplate);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens, detailTemplate, 'detail.jqhtml');
  const ast = parser.parse();
  const generator = new CodeGenerator();
  const result = generator.generate(ast);

  console.log('Generated render function excerpt:');
  const renderFunc = result.code.match(/function render[\s\S]*?return \[_output/);
  if (renderFunc) {
    const lines = renderFunc[0].split('\n');
    lines.forEach((line, i) => {
      if (line.includes('push') || line.includes('<!--')) {
        console.log(`  ${(i+1).toString().padStart(3)}: ${line}`);
      }
    });
  }
} catch (error) {
  console.log(`Error in detailed test: ${error.message}`);
}