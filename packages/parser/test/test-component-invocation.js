#!/usr/bin/env node

// Test component invocation parsing and code generation
import fs from 'fs';
import { Lexer } from './dist/lexer.js';
import { Parser } from './dist/parser.js';
import { generate } from './dist/codegen.js';

const test_template = `
<Define:Card>
  <div class="card">
    <% if (content('header')) { %>
      <div class="card-header">
        <%= content('header') %>
      </div>
    <% } %>
    <div class="card-body">
      <%= content() %>
    </div>
  </div>
</Define:Card>

<Define:UserPage>
  <div class="page">
    <h1>User Management</h1>
    
    <Card $id="user-card" $theme="dark">
      <#header>
        <h2>Active Users</h2>
        <button @click=this.refreshUsers>Refresh</button>
      </#header>
      
      <p>Total users: <%= this.data.userCount %></p>
      
      <#footer>
        <span>Last updated: <%= this.data.lastUpdate %></span>
      </#footer>
    </Card>
  </div>
</Define:UserPage>
`;

console.log('Testing component invocation parsing...\n');

// Step 1: Tokenize
console.log('--- LEXING ---');
const lexer = new Lexer(test_template);
const tokens = lexer.tokenize();

// Show interesting tokens (not all)
const interesting_tokens = tokens.filter(t => 
  !['TEXT', 'WHITESPACE', 'NEWLINE'].includes(t.type) || 
  (t.type === 'TEXT' && t.value.trim())
);

console.log('Key tokens:');
interesting_tokens.slice(0, 50).forEach(token => {
  console.log(`  ${token.type}: "${token.value}"`);
});
if (interesting_tokens.length > 50) {
  console.log(`  ... and ${interesting_tokens.length - 50} more tokens`);
}

// Step 2: Parse
console.log('\n--- PARSING ---');
const parser = new Parser(tokens);
const ast = parser.parse();

// Show AST structure
function show_ast(node, indent = 0) {
  const prefix = '  '.repeat(indent);
  
  if (node.type === 'Program') {
    console.log(`${prefix}Program`);
    node.body.forEach(child => show_ast(child, indent + 1));
  } else if (node.type === 'ComponentDefinition') {
    console.log(`${prefix}ComponentDefinition: ${node.name}`);
    node.body.forEach(child => show_ast(child, indent + 1));
  } else if (node.type === 'ComponentInvocation') {
    console.log(`${prefix}ComponentInvocation: ${node.name}`);
    console.log(`${prefix}  Attributes:`, node.attributes);
    console.log(`${prefix}  Self-closing: ${node.selfClosing}`);
    if (node.children.length > 0) {
      console.log(`${prefix}  Children:`);
      node.children.forEach(child => show_ast(child, indent + 2));
    }
  } else if (node.type === 'HtmlTag') {
    console.log(`${prefix}HtmlTag: ${node.name}`);
    console.log(`${prefix}  Attributes:`, node.attributes);
    if (node.children.length > 0) {
      console.log(`${prefix}  Children:`);
      node.children.forEach(child => show_ast(child, indent + 2));
    }
  } else if (node.type === 'Slot') {
    console.log(`${prefix}Slot: ${node.name}`);
    if (node.children.length > 0) {
      console.log(`${prefix}  Children:`);
      node.children.forEach(child => show_ast(child, indent + 2));
    }
  } else if (node.type === 'Text') {
    const text = node.content.trim();
    if (text) {
      console.log(`${prefix}Text: "${text.substring(0, 40)}${text.length > 40 ? '...' : ''}"`);
    }
  } else {
    console.log(`${prefix}${node.type}`);
  }
}

show_ast(ast);

// Step 3: Generate code
console.log('\n--- CODE GENERATION ---');
const generated = generate(ast);

// Save to file
const output_file = 'example-component-invocation.js';
fs.writeFileSync(output_file, generated.code, 'utf8');
console.log(`\nGenerated code saved to: ${output_file}`);

// Show component render functions
console.log('\n--- COMPONENT RENDER FUNCTIONS ---');
for (const [name, component] of generated.components) {
  console.log(`\n=== ${name} ===`);
  console.log(component.render_function);
}

console.log('\n✅ Component invocation test complete!');