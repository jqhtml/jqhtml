#!/usr/bin/env node

// Comprehensive test of all parser features
import fs from 'fs';
import { Lexer } from './dist/lexer.js';
import { Parser } from './dist/parser.js';
import { generate } from './dist/codegen.js';

const test_template = `
<Define:StatusBadge>
  <span class="badge <%= this.data.active ? 'active' : 'inactive' %>" 
        title="Status: <%= this.data.status %>">
    <%= this.data.label %>
  </span>
</Define:StatusBadge>

<Define:UserList>
  <div class="user-list">
    <h2>User Management</h2>
    
    <% // Regular JavaScript - passes through directly %>
    <% const activeUsers = this.data.users.filter(u => u.active); %>
    <% const inactiveUsers = this.data.users.filter(u => !u.active); %>
    
    <% if (activeUsers.length > 0) { %>
      <h3>Active Users (<%= activeUsers.length %>)</h3>
      <ul>
        <% for (const user of activeUsers) { %>
          <li>
            <StatusBadge 
              $active=user.active 
              $status=user.status
              $label=user.name />
            <span>Email: <%= user.email %></span>
            <span>Raw HTML: <%!= user.bio %></span>
          </li>
        <% } %>
      </ul>
    <% } else { %>
      <p>No active users found.</p>
    <% } %>
    
    <% // PHP-style control flow %>
    <% if (inactiveUsers.length > 0): %>
      <h3>Inactive Users</h3>
      <% for (const user of inactiveUsers): %>
        <div class="user-card <%= user.premium ? 'premium' : '' %>">
          <%= user.name %> - Last seen: <%= user.lastSeen %>
        </div>
      <% endfor; %>
    <% endif; %>
    
    <% // Test string with special characters %>
    <% const message = 'This string has "%>" inside it'; %>
    <p><%= message %></p>
  </div>
</Define:UserList>

<Define:App>
  <div class="app" id="<%= this.id('root') %>">
    <UserList $users=this.data.users>
      <#empty>
        <p>No users in the system.</p>
      </#empty>
    </UserList>
  </div>
</Define:App>
`;

console.log('Testing comprehensive JQHTML features...\n');

// Step 1: Tokenize
console.log('--- LEXING ---');
const lexer = new Lexer(test_template);
const tokens = lexer.tokenize();

// Show key tokens
const interesting_tokens = tokens.filter(t => 
  !['TEXT', 'WHITESPACE', 'NEWLINE'].includes(t.type) || 
  (t.type === 'TEXT' && t.value.trim()) ||
  (t.type === 'JAVASCRIPT' && t.value.includes('%>'))
);

console.log(`Total tokens: ${tokens.length}`);
console.log(`Interesting tokens: ${interesting_tokens.length}`);

// Show tokens related to interpolation
console.log('\nAttribute interpolation tokens:');
const attr_area = tokens.slice(20, 50);
attr_area.forEach((token, i) => {
  if (token.type === 'ATTR_NAME' || token.type === 'ATTR_VALUE' || 
      token.type === 'EXPRESSION_START' || token.type === 'EXPRESSION_UNESCAPED') {
    console.log(`  ${token.type}: "${token.value}"`);
  }
});

// Step 2: Parse
console.log('\n--- PARSING ---');
const parser = new Parser(tokens);
const ast = parser.parse();

// Show component structure
console.log('\nComponent definitions:');
ast.body.forEach(node => {
  if (node.type === 'ComponentDefinition') {
    console.log(`  ${node.name}`);
  }
});

// Step 3: Generate code
console.log('\n--- CODE GENERATION ---');
const generated = generate(ast);

// Save to file
const output_file = 'example-all-features.js';
fs.writeFileSync(output_file, generated.code, 'utf8');
console.log(`\nGenerated code saved to: ${output_file}`);

// Show specific interesting parts
console.log('\n--- FEATURE DEMONSTRATIONS ---');

// Extract StatusBadge to show attribute interpolation
const status_badge = generated.components.get('StatusBadge');
if (status_badge) {
  console.log('\n1. Attribute Interpolation (StatusBadge):');
  const lines = status_badge.render_function.split('\n');
  const span_line = lines.find(l => l.includes('span') && l.includes('class'));
  if (span_line) {
    console.log('  ' + span_line.trim());
  }
}

// Extract UserList to show control flow
const user_list = generated.components.get('UserList');
if (user_list) {
  console.log('\n2. Regular JavaScript Control Flow:');
  const lines = user_list.render_function.split('\n');
  const if_line = lines.findIndex(l => l.includes('if (activeUsers.length > 0)'));
  if (if_line >= 0) {
    console.log('  ' + lines[if_line].trim());
    console.log('  ' + lines[if_line + 1].trim());
  }
  
  console.log('\n3. PHP-style Control Flow:');
  const colon_if = lines.findIndex(l => l.includes('if (inactiveUsers.length > 0)'));
  if (colon_if >= 0) {
    console.log('  ' + lines[colon_if].trim());
  }
  
  console.log('\n4. String with %>:');
  const special_string = lines.find(l => l.includes('This string has'));
  if (special_string) {
    console.log('  ' + special_string.trim());
  }
}

console.log('\n✅ All features test complete!');