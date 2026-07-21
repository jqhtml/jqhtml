#!/usr/bin/env node

import { parse, JQHTMLParseError } from './dist/index.js';

console.log('JQHTML Parser Error Handling Test');
console.log('=================================\n');

// Test cases with various errors
const testCases = [
  {
    name: 'Unclosed component definition',
    template: `<Define:UserCard>
  <div class="card">
    <h2><%= this.data.name %></h2>
    <p>This component is not closed properly`
  },
  
  {
    name: 'Mismatched component tags',
    template: `<Define:UserCard>
  <div>Content</div>
</Define:AdminCard>`
  },
  
  {
    name: 'Unclosed if statement',
    template: `<Define:Test>
  <% if (condition): %>
    <p>True branch</p>
  <% else: %>
    <p>False branch</p>
    <!-- Missing endif -->`
  },
  
  {
    name: 'Unclosed for loop',
    template: `<Define:List>
  <% for (const item of items): %>
    <li><%= item %></li>
    <!-- Missing endfor -->
</Define:List>`
  },
  
  {
    name: 'Unclosed slot',
    template: `<Define:Card>
  <#header>
    <h1>Title</h1>
    <!-- Missing closing tag -->
</Define:Card>`
  },
  
  {
    name: 'Mismatched slot tags',
    template: `<Define:Card>
  <#header>
    <h1>Title</h1>
  </#footer>
</Define:Card>`
  },
  
  {
    name: 'Unclosed HTML tag',
    template: `<Define:Page>
  <div class="container">
    <h1>Welcome</h1>
    <p>This div is never closed
</Define:Page>`
  },
  
  {
    name: 'Missing closing %>',
    template: `<Define:Test>
  <%= this.data.value
  <p>Next content</p>
</Define:Test>`
  }
];

// Run tests
for (const testCase of testCases) {
  console.log(`\nTest: ${testCase.name}`);
  console.log('-'.repeat(50));
  
  try {
    parse(testCase.template, 'test-file.jqhtml');
    console.log('❌ Expected error but parsing succeeded!');
  } catch (error) {
    if (error instanceof JQHTMLParseError) {
      console.log('✅ Caught expected error:');
      console.log(error.message);
    } else {
      console.log('❌ Unexpected error type:', error);
    }
  }
}

// Test successful parsing
console.log('\n\nTest: Valid template should parse without errors');
console.log('-'.repeat(50));

const validTemplate = `<Define:UserCard>
  <div class="card">
    <% if (this.data.active): %>
      <span class="badge">Active</span>
    <% endif; %>
    
    <h2><%= this.data.name %></h2>
    
    <% for (const tag of this.data.tags): %>
      <span class="tag"><%= tag %></span>
    <% endfor; %>
  </div>
</Define:UserCard>`;

try {
  const ast = parse(validTemplate, 'valid-template.jqhtml');
  console.log('✅ Successfully parsed valid template');
  console.log('Component name:', ast.body[0].name);
} catch (error) {
  console.log('❌ Unexpected error:', error.message);
}

console.log('\n✅ Error handling test complete!');