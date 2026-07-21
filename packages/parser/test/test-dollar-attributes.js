#!/usr/bin/env node

// Test $ attribute system - both data attributes and scoped IDs
import fs from 'fs';
import { Lexer } from './dist/lexer.js';
import { Parser } from './dist/parser.js';
import { generate } from './dist/codegen.js';

const test_template = `
<Define:TestComponent>
  <!-- Test $id for scoped IDs -->
  <div $id="container">
    <input $id="username" type="text" />
    <button $id="submit">Submit</button>
    
    <!-- Test interpolated $id -->
    <div $id="item_<%= index %>">Dynamic ID</div>
  </div>
  
  <!-- Test other $ attributes (data-*) -->
  <div $user=currentUser $theme="dark" $count=42>
    Data attributes test
  </div>
  
  <!-- Test mixed $ attributes -->
  <div $id="mixed" $data=userData $active=isActive>
    Mixed attributes
  </div>
  
  <!-- Nested component with slot to test _cid scoping -->
  <ChildComponent $config=childConfig>
    <div $id="parent-slot">This should use parent's _cid</div>
  </ChildComponent>
</Define:TestComponent>

<Define:ChildComponent>
  <div $id="child-container">
    <%= content() %>
  </div>
</Define:ChildComponent>
`;

console.log('Testing $ attribute system...\n');

// Step 1: Tokenize
const lexer = new Lexer(test_template);
const tokens = lexer.tokenize();

console.log('--- TOKENIZATION ---');
console.log(`Total tokens: ${tokens.length}`);

// Look for $ attributes in tokens
let inTag = false;
tokens.forEach((token, i) => {
  if (token.type === 'TAG_OPEN') {
    inTag = true;
  }
  if (token.type === 'GT' || token.type === 'SELF_CLOSING') {
    inTag = false;
  }
  if (inTag && token.type === 'ATTR_NAME' && token.value.startsWith('$')) {
    const nextToken = tokens[i + 1];
    const valueToken = tokens[i + 2];
    console.log(`  $ attribute: ${token.value} = ${valueToken?.value || 'true'}`);
  }
});

// Step 2: Parse
const parser = new Parser(tokens);
const ast = parser.parse();

console.log('\n--- AST PARSING ---');
console.log('Successfully parsed AST');

// Step 3: Generate code
const generated = generate(ast);

console.log('\n--- CODE GENERATION ---');

// Extract key parts of the generated code
const testComponent = generated.components.get('TestComponent');
if (testComponent) {
  const lines = testComponent.render_function.split('\n');
  
  console.log('\n1. Function signature (should have _cid parameter):');
  console.log('  ' + lines[0]);
  
  console.log('\n2. Scoped ID examples (should append _cid):');
  lines.forEach((line, i) => {
    if (line.includes('"id":')) {
      console.log(`  Line ${i + 1}: ${line.trim()}`);
    }
  });
  
  console.log('\n3. Data attribute examples (should be data-*):');
  lines.forEach((line, i) => {
    if (line.includes('"data-')) {
      console.log(`  Line ${i + 1}: ${line.trim()}`);
    }
  });
  
  console.log('\n4. Component invocation with slot (captures parent _cid):');
  const compStart = lines.findIndex(line => line.includes('{comp: ["ChildComponent"'));
  if (compStart >= 0) {
    for (let i = compStart; i < Math.min(compStart + 10, lines.length); i++) {
      console.log(`  Line ${i + 1}: ${lines[i]}`);
    }
  }
}

// Save to file
const output_file = 'example-dollar-attributes.js';
fs.writeFileSync(output_file, generated.code, 'utf8');

console.log('\n✅ $ attribute test complete!');
console.log(`Generated code saved to ${output_file}`);