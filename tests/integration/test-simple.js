#!/usr/bin/env node

import { parse, generate } from './packages/parser/dist/index.js';

const test = `<Define:Test>
  <button @click=this.handleClick>Test</button>
</Define:Test>`;

console.log('Parsing...');
const ast = parse(test);

console.log('\nAST (full):');
console.log(JSON.stringify(ast, null, 2));

console.log('\nGenerating...');
const result = generate(ast);

console.log('\nGenerated code (first 1000 chars):');
console.log(result.code.substring(0, 1000));

// Look for the specific attribute output
const match = result.code.match(/"data-on-click":\s*([^,}]+)/);
if (match) {
  console.log('\nFound @click output:', match[1]);
  if (match[1].includes('"')) {
    console.log('✗ ERROR: Value is stringified when it should not be');
  } else {
    console.log('✓ SUCCESS: Value is a JavaScript expression');
  }
}