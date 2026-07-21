// Test suite for the JQHTML Parser

import { Lexer } from './src/lexer.js';
import { Parser } from './src/parser.js';
import { NodeType } from './src/ast.js';

// Test cases
const test_cases = [
  {
    name: "Simple text",
    input: "Hello World",
    expected_structure: {
      type: NodeType.PROGRAM,
      body_length: 1,
      first_node_type: NodeType.TEXT
    }
  },
  {
    name: "Expression",
    input: "Hello <%= user.name %>!",
    expected_structure: {
      type: NodeType.PROGRAM,
      body_length: 3,
      node_types: [NodeType.TEXT, NodeType.EXPRESSION, NodeType.TEXT]
    }
  },
  {
    name: "Component definition",
    input: `<Define:UserCard>
  <div class="card">
    <h3><%= user.name %></h3>
  </div>
</Define:UserCard>`,
    expected_structure: {
      type: NodeType.PROGRAM,
      body_length: 1,
      first_node_type: NodeType.COMPONENT_DEFINITION,
      component_name: "UserCard"
    }
  },
  {
    name: "If statement",
    input: `<% if (user.active): %>
  <span>Active</span>
<% else: %>
  <span>Inactive</span>
<% endif; %>`,
    expected_structure: {
      type: NodeType.PROGRAM,
      body_length: 1,
      first_node_type: NodeType.IF_STATEMENT,
      has_alternate: true
    }
  },
  {
    name: "For loop",
    input: `<% for (let item of items): %>
  <li><%= item.name %></li>
<% endfor; %>`,
    expected_structure: {
      type: NodeType.PROGRAM,
      body_length: 1,
      first_node_type: NodeType.FOR_STATEMENT
    }
  },
  {
    name: "Complex template",
    input: `<Define:TodoList>
  <div class="todo-list">
    <h2>My Todos</h2>
    
    <% if (todos.length > 0): %>
      <ul>
        <% for (let todo of todos): %>
          <li class="<%= todo.done ? 'done' : '' %>">
            <%= todo.text %>
          </li>
        <% endfor; %>
      </ul>
    <% else: %>
      <p>No todos yet!</p>
    <% endif; %>
  </div>
</Define:TodoList>`,
    expected_structure: {
      type: NodeType.PROGRAM,
      body_length: 1,
      first_node_type: NodeType.COMPONENT_DEFINITION,
      component_name: "TodoList"
    }
  }
];

console.log("🧪 Testing JQHTML Parser\n");

// Run tests
for (const test of test_cases) {
  console.log(`Test: ${test.name}`);
  console.log(`Input: ${test.input.slice(0, 50)}${test.input.length > 50 ? '...' : ''}`);
  
  try {
    // Lex the input
    const lexer = new Lexer(test.input);
    const tokens = lexer.tokenize();
    
    // Parse the tokens
    const parser = new Parser(tokens);
    const ast = parser.parse();
    
    console.log(`\n✅ Parsed successfully!`);
    console.log(`AST Root: ${ast.type}`);
    console.log(`Body nodes: ${ast.body.length}`);
    
    // Check expected structure
    const expected = test.expected_structure;
    let passed = true;
    
    if (expected.body_length !== undefined && ast.body.length !== expected.body_length) {
      console.log(`❌ Expected ${expected.body_length} body nodes, got ${ast.body.length}`);
      passed = false;
    }
    
    if (expected.first_node_type && ast.body[0]?.type !== expected.first_node_type) {
      console.log(`❌ Expected first node type ${expected.first_node_type}, got ${ast.body[0]?.type}`);
      passed = false;
    }
    
    if (expected.node_types) {
      const actual_types = ast.body.map(node => node.type);
      if (JSON.stringify(actual_types) !== JSON.stringify(expected.node_types)) {
        console.log(`❌ Expected node types ${expected.node_types}, got ${actual_types}`);
        passed = false;
      }
    }
    
    if (expected.component_name && ast.body[0]?.type === NodeType.COMPONENT_DEFINITION) {
      const component = ast.body[0] as any;
      if (component.name !== expected.component_name) {
        console.log(`❌ Expected component name ${expected.component_name}, got ${component.name}`);
        passed = false;
      }
    }
    
    if (expected.has_alternate !== undefined && ast.body[0]?.type === NodeType.IF_STATEMENT) {
      const if_stmt = ast.body[0] as any;
      const has_alternate = if_stmt.alternate !== null;
      if (has_alternate !== expected.has_alternate) {
        console.log(`❌ Expected alternate branch: ${expected.has_alternate}, got ${has_alternate}`);
        passed = false;
      }
    }
    
    if (passed) {
      console.log(`✅ All checks passed!`);
    }
    
    // Print AST structure
    console.log(`\nAST Structure:`);
    print_ast(ast, 0);
    
  } catch (error) {
    console.log(`\n❌ Parse error: ${error.message}`);
  }
  
  console.log('\n' + '='.repeat(60) + '\n');
}

// Helper to print AST structure
function print_ast(node: any, indent: number) {
  const spaces = '  '.repeat(indent);
  
  switch (node.type) {
    case NodeType.PROGRAM:
      console.log(`${spaces}Program`);
      for (const child of node.body) {
        print_ast(child, indent + 1);
      }
      break;
      
    case NodeType.COMPONENT_DEFINITION:
      console.log(`${spaces}ComponentDefinition: ${node.name}`);
      for (const child of node.body) {
        print_ast(child, indent + 1);
      }
      break;
      
    case NodeType.TEXT:
      const text = node.content.trim().replace(/\n/g, '\\n');
      if (text) {
        console.log(`${spaces}Text: "${text.slice(0, 40)}${text.length > 40 ? '...' : ''}"`);
      }
      break;
      
    case NodeType.EXPRESSION:
      console.log(`${spaces}Expression: <%= ${node.code} %>`);
      break;
      
    case NodeType.IF_STATEMENT:
      console.log(`${spaces}If: ${node.condition}`);
      console.log(`${spaces}  Then:`);
      for (const child of node.consequent) {
        print_ast(child, indent + 2);
      }
      if (node.alternate) {
        console.log(`${spaces}  Else:`);
        for (const child of node.alternate) {
          print_ast(child, indent + 2);
        }
      }
      break;
      
    case NodeType.FOR_STATEMENT:
      console.log(`${spaces}For: ${node.iterator}`);
      for (const child of node.body) {
        print_ast(child, indent + 1);
      }
      break;
      
    case NodeType.CODE_BLOCK:
      console.log(`${spaces}Code: <% ${node.code} %>`);
      break;
      
    default:
      console.log(`${spaces}${node.type}`);
  }
}