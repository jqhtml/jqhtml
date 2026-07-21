#!/usr/bin/env node

import { parse, generate } from './packages/parser/dist/index.js';

function compile(source, debug = false) {
  const ast = parse(source);
  if (debug) {
    // Find the button element in the AST
    const findButton = (node) => {
      if (node.type === 'Element' && node.name === 'button') {
        return node;
      }
      if (node.body) {
        for (const child of node.body) {
          const found = findButton(child);
          if (found) return found;
        }
      }
      if (node.children) {
        for (const child of node.children) {
          const found = findButton(child);
          if (found) return found;
        }
      }
      return null;
    };

    const button = findButton(ast);
    if (button) {
      console.log('  Button attrs:', JSON.stringify(button.attributes, null, 2));
    }
  }
  const result = generate(ast);
  // The generate function returns an object with code and components
  return result.code; // Return just the JavaScript code string
}
import fs from 'fs';

console.log('Testing JQHTML Parser Changes\n');
console.log('=' .repeat(60));

// Test 1: Correct usage - unquoted values
console.log('\n1. Testing unquoted values (should work):');
const test1 = `<Define:Component>
  <button @click=this.handleClick>Click</button>
  <div $data=userData>Data</div>
</Define:Component>`;

try {
  const result1 = compile(test1, true);  // Enable debug
  console.log('✓ Success - Compiled correctly');

  // Debug: show what's actually in the output
  const clickMatch = result1.match(/"data-on-click":\s*([^,}]+)/);
  if (clickMatch) {
    console.log('  Found @click output:', clickMatch[1].trim());
  }

  // Check if the output contains unquoted JavaScript
  if (result1.includes('"data-on-click": this.handleClick')) {
    console.log('✓ Correct: @click=this.handleClick outputs JavaScript reference');
  } else if (result1.includes('"data-on-click": "this.handleClick"')) {
    console.log('✗ Wrong: @click=this.handleClick was stringified');
  } else {
    console.log('✗ Could not find expected pattern in output');
  }
} catch (e) {
  console.log('✗ Error:', e.message);
}

// Test 2: Quoted values
console.log('\n2. Testing quoted values (should be strings):');
const test2 = `<Define:Component>
  <button @click="handleClick">Click</button>
  <div $data="static-string">Data</div>
</Define:Component>`;

try {
  const result2 = compile(test2);
  console.log('✓ Success - Compiled correctly');

  // Check if the output contains quoted strings
  if (result2.includes('"data-on-click": "handleClick"')) {
    console.log('✓ Correct: @click="handleClick" outputs string literal');
  } else if (result2.includes('"data-on-click": handleClick')) {
    console.log('✗ Wrong: @click="handleClick" was treated as JavaScript');
  }
} catch (e) {
  console.log('✗ Error:', e.message);
}

// Test 3: Function calls (should throw error)
console.log('\n3. Testing function calls (should throw error):');
const test3 = `<Define:Component>
  <button @click=this.handleClick()>Click</button>
</Define:Component>`;

try {
  const result3 = compile(test3);
  console.log('✗ Wrong: Should have thrown an error for function call');
} catch (e) {
  if (e.message.includes('Function calls are not allowed')) {
    console.log('✓ Correct: Threw error for function call');
    console.log('  Error message preview:', e.message.split('\n')[0]);
  } else {
    console.log('✗ Wrong error:', e.message);
  }
}

// Test 4: Complex example
console.log('\n4. Testing complex example:');
const test4 = `<Define:UserCard>
  <div class="user-card" $active=this.isActive>
    <h3><%= this.data.name %></h3>
    <button @click=this.editUser $disabled=!this.canEdit title="Edit user">Edit</button>
  </div>
</Define:UserCard>`;

try {
  const result4 = compile(test4);
  console.log('✓ Success - Complex example compiled');

  // Show a snippet of the compiled output
  console.log('\nCompiled attributes (sample):');
  const attrMatch = result4.match(/"data-on-click": [^,}]+/);
  if (attrMatch) {
    console.log('  ' + attrMatch[0]);
  }
  const activeMatch = result4.match(/"data-active": [^,}]+/);
  if (activeMatch) {
    console.log('  ' + activeMatch[0]);
  }
  const disabledMatch = result4.match(/"data-disabled": [^,}]+/);
  if (disabledMatch) {
    console.log('  ' + disabledMatch[0]);
  }
} catch (e) {
  console.log('✗ Error:', e.message);
}

console.log('\n' + '=' .repeat(60));
console.log('Testing complete!');