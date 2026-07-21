// Interactive demo of the JQHTML Code Generator
import { Lexer } from './dist/lexer.js';
import { Parser } from './dist/parser.js';
import { CodeGenerator } from './dist/codegen.js';
import fs from 'fs';

console.log('JQHTML Code Generator Demo\n');
console.log('=' .repeat(60));
console.log('This demo shows how JQHTML templates compile to JavaScript\n');

// Example template that showcases various features
const template = `
<Define:TodoApp>
  <div class="todo-app">
    <h1><%= this.data.title || 'My Todo List' %></h1>
    
    <div class="todo-stats">
      <p>Total: <%= this.data.todos.length %></p>
      <p>Completed: <%= this.data.todos.filter(t => t.completed).length %></p>
    </div>
    
    <% if (this.data.todos.length === 0): %>
      <p class="empty-state">No todos yet. Add one below!</p>
    <% else: %>
      <ul class="todo-list">
        <% for (const todo of this.data.todos): %>
          <li class="todo-item <%= todo.completed ? 'completed' : '' %>">
            <input type="checkbox" <%= todo.completed ? 'checked' : '' %>>
            <span><%= todo.text %></span>
            <% if (todo.due_date): %>
              <small>Due: <%= todo.due_date %></small>
            <% endif; %>
          </li>
        <% endfor; %>
      </ul>
    <% endif; %>
    
    <div class="add-todo">
      <input type="text" placeholder="Add a new todo...">
      <button>Add</button>
    </div>
  </div>
</Define:TodoApp>
`;

console.log('Input Template:');
console.log('```jqhtml');
console.log(template);
console.log('```\n');

// Step 1: Tokenize
console.log('Step 1: Tokenization');
console.log('-'.repeat(20));
const lexer = new Lexer(template);
const tokens = lexer.tokenize();
console.log(`Generated ${tokens.length} tokens`);
console.log('\nFirst 10 tokens:');
tokens.slice(0, 10).forEach((token, i) => {
  console.log(`  ${i + 1}. ${token.type}: "${token.value.replace(/\n/g, '\\n')}"`);
});
console.log('  ...\n');

// Step 2: Parse
console.log('Step 2: Parsing');
console.log('-'.repeat(20));
const parser = new Parser(tokens);
const ast = parser.parse();
console.log('Generated AST:');
console.log(JSON.stringify(ast, null, 2).split('\n').slice(0, 20).join('\n'));
console.log('...\n');

// Step 3: Generate Code
console.log('Step 3: Code Generation');
console.log('-'.repeat(20));
const generator = new CodeGenerator();
const result = generator.generate(ast);
console.log(`Generated code for ${result.components.size} component(s)\n`);

console.log('Generated JavaScript:');
console.log('```javascript');
console.log(result.code);
console.log('```\n');

// Save the generated code
const output_file = 'demo-codegen-output.js';
fs.writeFileSync(output_file, result.code);
console.log(`✓ Generated code saved to: ${output_file}\n`);

// Show how to use the generated code
console.log('Usage Example:');
console.log('```javascript');
console.log(`// Import the generated components
import { jqhtml_components } from './${output_file}';

// Get the TodoApp component
const TodoApp = jqhtml_components.get('TodoApp');

// Use it in a JQHTML Component class
class MyTodoApp extends Component {
  async on_render() {
    // Call the generated render function
    const elements = TodoApp.render.call(this);
    this.$.append(elements);
  }
  
  async on_ready() {
    // Component is ready with generated template
    console.log('TodoApp rendered with generated template!');
  }
}
`);
console.log('```\n');

console.log('=' .repeat(60));
console.log('Demo complete! The code generator successfully converted');
console.log('JQHTML template syntax into executable JavaScript functions.');