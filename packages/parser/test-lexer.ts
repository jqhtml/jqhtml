// Simple test script for the JQHTML lexer

import { Lexer, TokenType } from './src/lexer.js';

// Test cases
const test_cases = [
  {
    name: "Simple text",
    input: "Hello World",
    expected_types: [TokenType.TEXT, TokenType.EOF]
  },
  {
    name: "Expression tag",
    input: "Hello <%= user.name %>!",
    expected_types: [TokenType.TEXT, TokenType.EXPRESSION_START, TokenType.JAVASCRIPT, TokenType.TAG_END, TokenType.TEXT, TokenType.EOF]
  },
  {
    name: "If statement",
    input: "<% if (user.active): %>Active<% endif; %>",
    expected_types: [TokenType.CODE_START, TokenType.IF, TokenType.JAVASCRIPT, TokenType.TAG_END, TokenType.TEXT, TokenType.CODE_START, TokenType.ENDIF, TokenType.JAVASCRIPT, TokenType.TAG_END, TokenType.EOF]
  },
  {
    name: "Component definition",
    input: "<Define:UserCard>\n  <h1>User</h1>\n</Define:UserCard>",
    expected_types: [TokenType.DEFINE_START, TokenType.COMPONENT_NAME, TokenType.GT, TokenType.NEWLINE, TokenType.TEXT, TokenType.NEWLINE, TokenType.DEFINE_END, TokenType.COMPONENT_NAME, TokenType.GT, TokenType.EOF]
  },
  {
    name: "Complex template",
    input: `<Define:UserList>
  <ul>
    <% for (let user of users): %>
      <li><%= user.name %> - <%= user.email %></li>
    <% endfor; %>
  </ul>
</Define:UserList>`,
    expected_contains: ["Define:", "UserList", "for", "users", "user.name", "user.email", "endfor"]
  }
];

// Run tests
console.log("🧪 Testing JQHTML Lexer\n");

for (const test of test_cases) {
  console.log(`Test: ${test.name}`);
  console.log(`Input: ${JSON.stringify(test.input)}`);
  
  const lexer = new Lexer(test.input);
  const tokens = lexer.tokenize();
  
  console.log(`\nTokens (${tokens.length}):`);
  for (const token of tokens) {
    console.log(`  ${token.type.padEnd(20)} | ${JSON.stringify(token.value).padEnd(20)} | Line ${token.line}:${token.column}`);
  }
  
  // Check expected types if provided
  if (test.expected_types) {
    const actual_types = tokens.map(t => t.type);
    const types_match = JSON.stringify(actual_types) === JSON.stringify(test.expected_types);
    console.log(`\nTypes match expected: ${types_match ? '✅' : '❌'}`);
    
    if (!types_match) {
      console.log('Expected:', test.expected_types);
      console.log('Actual:  ', actual_types);
    }
  }
  
  // Check expected contains if provided
  if (test.expected_contains) {
    const all_values = tokens.map(t => t.value).join(' ');
    const missing = test.expected_contains.filter(exp => !all_values.includes(exp));
    console.log(`\nContains expected values: ${missing.length === 0 ? '✅' : '❌'}`);
    
    if (missing.length > 0) {
      console.log('Missing:', missing);
    }
  }
  
  console.log('\n' + '='.repeat(60) + '\n');
}

// Detailed example with source positions
console.log("📍 Detailed Token Positions Example\n");

const position_example = "Hello <%= name %> world!";
const lexer = new Lexer(position_example);
const tokens = lexer.tokenize();

console.log(`Input: "${position_example}"`);
console.log('       ' + ''.padStart(position_example.length).split('').map((_, i) => i % 10).join(''));
console.log('\nTokens with positions:');

for (const token of tokens) {
  if (token.type !== TokenType.EOF) {
    const highlight = ' '.repeat(token.start) + '^'.repeat(token.end - token.start);
    console.log(`${highlight} ${token.type}: "${token.value}" [${token.start}-${token.end}]`);
  }
}