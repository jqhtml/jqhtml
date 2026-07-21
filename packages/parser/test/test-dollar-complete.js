#!/usr/bin/env node

// Complete test of $ attribute system showing all variations
import fs from 'fs';
import { Lexer } from './dist/lexer.js';
import { Parser } from './dist/parser.js';
import { generate } from './dist/codegen.js';

const test_template = `
<Define:DollarTest>
  <!-- 1. $id variations -->
  <div $id="static">Static ID</div>
  <div $id="user_<%= userId %>">Interpolated ID</div>
  
  <!-- 2. $property with expressions (unquoted) -->
  <div $user=currentUser 
       $config=this.config 
       $items=data.items
       $count=42
       $active=true>
    Expression values
  </div>
  
  <!-- 3. $property with strings (quoted) -->
  <div $theme="dark"
       $mode='production'
       $label="User Profile">
    String values  
  </div>
  
  <!-- 4. Mixed in one element -->
  <button $id="save"
          $handler=this.handleSave
          $tooltip="Save changes"
          $disabled=isDisabled>
    Save
  </button>
  
  <!-- 5. Component example -->
  <Modal $id="confirm-dialog"
         $options=modalConfig
         $title="Confirm Action">
    <#content>
      <p $id="message">Are you sure?</p>
    </#content>
  </Modal>
</Define:DollarTest>
`;

console.log('Complete $ Attribute System Test\n');
console.log('================================\n');

// Tokenize
const lexer = new Lexer(test_template);
const tokens = lexer.tokenize();

// Parse
const parser = new Parser(tokens);
const ast = parser.parse();

// Generate
const generated = generate(ast);

// Display the full generated component
const component = generated.components.get('DollarTest');
if (component) {
  console.log('GENERATED RENDER FUNCTION:');
  console.log('-------------------------\n');
  console.log(component.render_function);
  console.log('\n');
  
  // Extract and analyze specific patterns
  const lines = component.render_function.split('\n');
  
  console.log('KEY OBSERVATIONS:');
  console.log('-----------------\n');
  
  console.log('1. Scoped IDs (should have + ":" + _cid):');
  lines.forEach((line, i) => {
    if (line.includes('"id":') && line.includes('_cid')) {
      const match = line.match(/"id":\s*([^,}]+)/);
      if (match) {
        console.log(`   ${match[1]}`);
      }
    }
  });
  
  console.log('\n2. Expression data attributes (no quotes):');
  lines.forEach(line => {
    const match = line.match(/"data-(\w+)":\s*([^,"}][^,}]*)/);
    if (match && !match[2].startsWith('"')) {
      console.log(`   data-${match[1]}: ${match[2]}`);
    }
  });
  
  console.log('\n3. String data attributes (with quotes):');
  lines.forEach(line => {
    const match = line.match(/"data-(\w+)":\s*("[^"]*")/);
    if (match) {
      console.log(`   data-${match[1]}: ${match[2]}`);
    }
  });
}

// Save output
const output_file = 'example-dollar-complete.js';
fs.writeFileSync(output_file, generated.code, 'utf8');

console.log('\n✅ Test complete! See ' + output_file);