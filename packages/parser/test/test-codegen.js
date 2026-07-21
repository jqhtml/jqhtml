// Test the JQHTML Code Generator
import { Lexer } from './dist/lexer.js';
import { Parser } from './dist/parser.js';
import { CodeGenerator } from './dist/codegen.js';

console.log('JQHTML Code Generator Test\n');
console.log('=' .repeat(50));

// Test cases
const test_cases = [
  {
    name: 'Simple Component',
    template: `
<Define:HelloWorld>
  <h1>Hello, World!</h1>
  <p>This is a simple component.</p>
</Define:HelloWorld>
    `.trim()
  },
  
  {
    name: 'Component with Expression',
    template: `
<Define:UserCard>
  <div class="user-card">
    <h3><%= this.data.name %></h3>
    <p>Email: <%= this.data.email %></p>
  </div>
</Define:UserCard>
    `.trim()
  },
  
  {
    name: 'Component with Conditional',
    template: `
<Define:ConditionalCard>
  <div class="card">
    <h3><%= this.data.title %></h3>
    <% if (this.data.show_content): %>
      <p><%= this.data.content %></p>
    <% else: %>
      <p>Content hidden</p>
    <% endif; %>
  </div>
</Define:ConditionalCard>
    `.trim()
  },
  
  {
    name: 'Component with Loop',
    template: `
<Define:ItemList>
  <ul class="item-list">
    <% for (const item of this.data.items): %>
      <li>
        <strong><%= item.name %></strong>: <%= item.value %>
      </li>
    <% endfor; %>
  </ul>
</Define:ItemList>
    `.trim()
  },
  
  {
    name: 'Complex Component',
    template: `
<Define:Dashboard>
  <div class="dashboard">
    <h1><%= this.data.title %></h1>
    
    <% if (this.data.user): %>
      <div class="user-info">
        <h2>Welcome, <%= this.data.user.name %>!</h2>
        <p>Last login: <%= this.data.user.last_login %></p>
      </div>
    <% endif; %>
    
    <div class="stats">
      <h3>Statistics</h3>
      <% for (const stat of this.data.stats): %>
        <div class="stat-item">
          <span class="label"><%= stat.label %>:</span>
          <span class="value"><%= stat.value %></span>
          <% if (stat.trend): %>
            <span class="trend <%= stat.trend %>"><%= stat.trend %></span>
          <% endif; %>
        </div>
      <% endfor; %>
    </div>
    
    <% if (this.data.alerts && this.data.alerts.length > 0): %>
      <div class="alerts">
        <h3>Alerts</h3>
        <% for (const alert of this.data.alerts): %>
          <div class="alert alert-<%= alert.type %>">
            <%= alert.message %>
          </div>
        <% endfor; %>
      </div>
    <% else: %>
      <p class="no-alerts">No alerts at this time.</p>
    <% endif; %>
  </div>
</Define:Dashboard>
    `.trim()
  },
  
  {
    name: 'Component with Slots',
    template: `
<Define:Card>
  <div class="card">
    <div class="card-header">
      <%= content('header') %>
    </div>
    <div class="card-body">
      <#default>
        <p>Default card content</p>
      </#default>
    </div>
    <div class="card-footer">
      <#footer />
    </div>
  </div>
</Define:Card>
    `.trim()
  },
  
  {
    name: 'DataTable with Slots',
    template: `
<Define:DataTable>
  <table class="data-table">
    <thead>
      <tr>
        <%= content('header') %>
      </tr>
    </thead>
    <tbody>
      <% if (this.data.rows && this.data.rows.length > 0): %>
        <% for (const row of this.data.rows): %>
          <tr>
            <%= content('row', row) %>
          </tr>
        <% endfor; %>
      <% else: %>
        <tr>
          <td colspan="100">
            <%= content('empty') || 'No data available' %>
          </td>
        </tr>
      <% endif; %>
    </tbody>
  </table>
</Define:DataTable>
    `.trim()
  }
];

// Process each test case
for (const test of test_cases) {
  console.log(`\n${test.name}:`);
  console.log('-'.repeat(test.name.length + 1));
  
  try {
    // Tokenize
    const lexer = new Lexer(test.template);
    const tokens = lexer.tokenize();
    console.log(`✓ Tokenized: ${tokens.length} tokens`);
    
    // Parse
    const parser = new Parser(tokens);
    const ast = parser.parse();
    console.log(`✓ Parsed: ${ast.body.length} top-level nodes`);
    
    // Generate code
    const generator = new CodeGenerator();
    const result = generator.generate(ast);
    console.log(`✓ Generated: ${result.components.size} components`);
    
    // Show the generated code
    console.log('\nGenerated Code:');
    console.log('```javascript');
    console.log(result.code);
    console.log('```');
    
  } catch (error) {
    console.error(`✗ Error: ${error.message}`);
  }
}

console.log('\n' + '='.repeat(50));
console.log('Code Generation Test Complete!');