#!/usr/bin/env node

// Test attribute interpolation
import fs from 'fs';
import { Lexer } from './dist/lexer.js';
import { Parser } from './dist/parser.js';
import { generate } from './dist/codegen.js';

const test_template = `
<Define:InterpolationTest>
  <div>
    <!-- Simple interpolation -->
    <p class="message <%= type %>">Simple interpolation</p>
    
    <!-- Multiple interpolations -->
    <div class="card <%= theme %> <%= active ? 'active' : '' %>" 
         title="User: <%= userName %> (ID: <%= userId %>)">
      Multiple interpolations
    </div>
    
    <!-- Mixed text and interpolation -->
    <span data-info="Version <%= version %> - Build <%= buildNumber %>">
      Mixed content
    </span>
    
    <!-- Expression binding vs interpolation -->
    <button $onclick=this.handleClick 
            class="btn <%= btnClass %>"
            title="Tooltip: <%= tooltip %>">
      Click me
    </button>
    
    <!-- Raw vs escaped (both same in attributes) -->
    <div title="<%= htmlContent %>" 
         data-raw="<%!= htmlContent %>">
      Both work the same in attributes
    </div>
  </div>
</Define:InterpolationTest>
`;

console.log('Testing attribute interpolation...\n');

// Step 1: Tokenize
const lexer = new Lexer(test_template);
const tokens = lexer.tokenize();

// Step 2: Parse
const parser = new Parser(tokens);
const ast = parser.parse();

// Step 3: Generate code
const generated = generate(ast);

// Save to file
const output_file = 'example-interpolation.js';
fs.writeFileSync(output_file, generated.code, 'utf8');

// Show the generated attributes
console.log('--- GENERATED ATTRIBUTES ---\n');

const component = generated.components.get('InterpolationTest');
if (component) {
  const lines = component.render_function.split('\n');
  
  // Find lines with interpolated attributes
  lines.forEach((line, i) => {
    if (line.includes('_output.push({tag:') && line.includes(' + ')) {
      console.log(`Line ${i + 1}: ${line.trim()}`);
      console.log('');
    }
  });
}

console.log('\n✅ Attribute interpolation test complete!');
console.log(`Check ${output_file} for full output.`);