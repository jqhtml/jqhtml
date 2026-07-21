#!/usr/bin/env node

// Test edge cases for attributes
import fs from 'fs';
import { Lexer } from './dist/lexer.js';
import { Parser } from './dist/parser.js';
import { generate } from './dist/codegen.js';

const test_template = `
<Define:AttributeEdgeCases>
  <!-- 1. Single interpolation as entire value -->
  <div class="<%= tooltip %>">Single interpolation</div>
  
  <!-- 2. Unquoted attributes -->
  <span class=simpleString title=anotherString>Unquoted strings</span>
  <button disabled class=btnClass>Unquoted variable</button>
  <img src=imageUrl alt=description />
  
  <!-- 3. Expression attributes (current $syntax) -->
  <div $class=computedClass $style=styleObject>Expression binding</div>
  
  <!-- What about parentheses for complex expressions? -->
  <!-- This would be nice but doesn't work yet: -->
  <!-- <div class=(active ? 'active' : 'inactive')>Parentheses</div> -->
  
  <!-- Current workaround is $ syntax or interpolation -->
  <div $class="active ? 'active' : 'inactive'">Current expression syntax</div>
  <div class="<%= active ? 'active' : 'inactive' %>">Or interpolation</div>
</Define:AttributeEdgeCases>
`;

console.log('Testing attribute edge cases...\n');

// Step 1: Tokenize
const lexer = new Lexer(test_template);
const tokens = lexer.tokenize();

console.log('--- KEY TOKENS ---');
// Find unquoted attribute tokens
let inTag = false;
tokens.forEach((token, i) => {
  if (token.type === 'TAG_OPEN' || token.type === 'TAG_NAME') {
    inTag = true;
  }
  if (token.type === 'GT' || token.type === 'SELF_CLOSING') {
    inTag = false;
  }
  if (inTag && (token.type === 'ATTR_NAME' || token.type === 'ATTR_VALUE')) {
    const prevToken = tokens[i-1];
    const nextToken = tokens[i+1];
    console.log(`  ${token.type}: "${token.value}" (prev: ${prevToken?.type}, next: ${nextToken?.type})`);
  }
});

// Step 2: Parse
const parser = new Parser(tokens);
const ast = parser.parse();

// Step 3: Generate code
const generated = generate(ast);

// Save to file
const output_file = 'example-attribute-edge-cases.js';
fs.writeFileSync(output_file, generated.code, 'utf8');

// Show the generated attributes
console.log('\n--- GENERATED ATTRIBUTES ---\n');

const component = generated.components.get('AttributeEdgeCases');
if (component) {
  const lines = component.render_function.split('\n');
  
  // Find all tag instructions
  lines.forEach((line, i) => {
    if (line.includes('_output.push({tag:')) {
      // Extract just the attributes part
      const match = line.match(/\{tag: \["[^"]+", (\{[^}]+\})/);
      if (match) {
        console.log(`Line ${i + 1}: ${match[1]}`);
      }
    }
  });
}

console.log('\n✅ Attribute edge cases test complete!');
console.log(`Check ${output_file} for full output.`);