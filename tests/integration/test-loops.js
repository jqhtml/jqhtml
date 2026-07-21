#!/usr/bin/env node

import { parse, generate } from './packages/parser/dist/index.js';

console.log('Testing JQHTML Loop Syntax\n');
console.log('=' .repeat(60));

// Test 1: for...of with colon syntax
console.log('\n1. Testing for...of with colon syntax:');
const test1 = `<Define:ListColon>
  <ul>
    <% for (let item of this.data.items): %>
      <li><%= item.name %></li>
    <% endfor; %>
  </ul>
</Define:ListColon>`;

try {
  const ast1 = parse(test1);
  const result1 = generate(ast1);
  console.log('✓ Success - Colon syntax parsed');

  // Check if the generated code contains a proper for loop
  if (result1.code.includes('for (let item of this.data.items)')) {
    console.log('✓ Generated correct for...of loop');
  }
} catch (e) {
  console.log('✗ Error:', e.message);
}

// Test 2: for...of with brace syntax
console.log('\n2. Testing for...of with brace syntax:');
const test2 = `<Define:ListBraces>
  <ul>
    <% for (let item of this.data.items) { %>
      <li><%= item.name %></li>
    <% } %>
  </ul>
</Define:ListBraces>`;

try {
  const ast2 = parse(test2);
  const result2 = generate(ast2);
  console.log('✓ Success - Brace syntax parsed');

  if (result2.code.includes('for (let item of this.data.items)')) {
    console.log('✓ Generated correct for...of loop');
  }
} catch (e) {
  console.log('✗ Error:', e.message);
}

// Test 3: Classic for loop with index
console.log('\n3. Testing classic for loop with index:');
const test3 = `<Define:IndexLoop>
  <div>
    <% for (let i = 0; i < 10; i++): %>
      <span>Item <%= i %></span>
    <% endfor; %>
  </div>
</Define:IndexLoop>`;

try {
  const ast3 = parse(test3);
  const result3 = generate(ast3);
  console.log('✓ Success - Classic for loop parsed');

  if (result3.code.includes('for (let i = 0; i < 10; i++)')) {
    console.log('✓ Generated correct indexed loop');
  }
} catch (e) {
  console.log('✗ Error:', e.message);
}

// Test 4: Nested loops
console.log('\n4. Testing nested loops:');
const test4 = `<Define:NestedLoops>
  <table>
    <% for (let row of this.data.rows): %>
      <tr>
        <% for (let cell of row.cells) { %>
          <td><%= cell %></td>
        <% } %>
      </tr>
    <% endfor; %>
  </table>
</Define:NestedLoops>`;

try {
  const ast4 = parse(test4);
  const result4 = generate(ast4);
  console.log('✓ Success - Nested loops parsed');

  const code = result4.code;
  if (code.includes('for (let row of this.data.rows)') &&
      code.includes('for (let cell of row.cells)')) {
    console.log('✓ Generated correct nested loops');
  }
} catch (e) {
  console.log('✗ Error:', e.message);
}

// Test 5: for...in loop
console.log('\n5. Testing for...in loop:');
const test5 = `<Define:ForInLoop>
  <dl>
    <% for (let key in this.data.object): %>
      <dt><%= key %></dt>
      <dd><%= this.data.object[key] %></dd>
    <% endfor; %>
  </dl>
</Define:ForInLoop>`;

try {
  const ast5 = parse(test5);
  const result5 = generate(ast5);
  console.log('✓ Success - for...in loop parsed');

  if (result5.code.includes('for (let key in this.data.object)')) {
    console.log('✓ Generated correct for...in loop');
  }
} catch (e) {
  console.log('✗ Error:', e.message);
}

// Test 6: Complex loop with conditionals inside
console.log('\n6. Testing loop with conditionals inside:');
const test6 = `<Define:ComplexLoop>
  <div class="items">
    <% for (const item of this.data.items): %>
      <% if (item.visible): %>
        <div class="item">
          <h3><%= item.title %></h3>
          <% if (item.description) { %>
            <p><%= item.description %></p>
          <% } %>
        </div>
      <% endif; %>
    <% endfor; %>
  </div>
</Define:ComplexLoop>`;

try {
  const ast6 = parse(test6);
  const result6 = generate(ast6);
  console.log('✓ Success - Complex loop with conditionals parsed');
} catch (e) {
  console.log('✗ Error:', e.message);
}

console.log('\n' + '=' .repeat(60));
console.log('Loop testing complete!');