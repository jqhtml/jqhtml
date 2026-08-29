// Interactive demo of the JQHTML Parser

import { Lexer } from './src/lexer.js';
import { Parser } from './src/parser.js';
import { NodeType, ASTNode } from './src/ast.js';

// Example template showcasing all features
const template = `
<Define:BlogPost>
  <article class="blog-post" $sid="post_<%= post.id %>">
    <header>
      <h1><%= post.title %></h1>
      <div class="meta">
        By <%= post.author %> on <%= post.date %>
      </div>
    </header>
    
    <div class="content">
      <%= post.content %>
    </div>
    
    <% if (post.tags && post.tags.length > 0): %>
      <div class="tags">
        <h3>Tags:</h3>
        <ul>
          <% for (let tag of post.tags): %>
            <li>
              <a href="/tag/<%= tag %>" @click=this.handle_tag_click>
                #<%= tag %>
              </a>
            </li>
          <% endfor; %>
        </ul>
      </div>
    <% endif; %>
    
    <% if (user.can_comment): %>
      <section class="comments">
        <h3>Comments (<%= post.comments.length %>)</h3>
        
        <% for (let comment of post.comments): %>
          <div class="comment" $sid="comment_<%= comment.id %>">
            <strong><%= comment.author %>:</strong>
            <%= comment.text %>
          </div>
        <% endfor; %>
        
        <form @submit=this.add_comment>
          <textarea $sid="comment_text" placeholder="Add a comment..."></textarea>
          <button type="submit">Post Comment</button>
        </form>
      </section>
    <% else: %>
      <p class="no-comments">Comments are disabled.</p>
    <% endif; %>
  </article>
</Define:BlogPost>

<Define:BlogList>
  <div class="blog-list">
    <% if (posts.length === 0): %>
      <p>No posts yet!</p>
    <% else: %>
      <% for (let post of posts): %>
        <BlogPost $post="<%= post %>" />
      <% endfor; %>
    <% endif; %>
  </div>
</Define:BlogList>
`;

console.log('🎨 JQHTML Parser Demo\n');
console.log('Template:');
console.log('─'.repeat(60));
console.log(template);
console.log('─'.repeat(60));

// Step 1: Tokenize
console.log('\n📝 Step 1: Tokenization\n');
const lexer = new Lexer(template);
const tokens = lexer.tokenize();

// Show token summary
const token_counts = new Map<string, number>();
for (const token of tokens) {
  if (token.type !== 'WHITESPACE' && token.type !== 'EOF') {
    token_counts.set(token.type, (token_counts.get(token.type) || 0) + 1);
  }
}

console.log('Token Summary:');
for (const [type, count] of token_counts) {
  console.log(`  ${type.padEnd(20)} ${count}`);
}
console.log(`\nTotal tokens: ${tokens.length}`);

// Step 2: Parse
console.log('\n🌳 Step 2: Parsing to AST\n');
const parser = new Parser(tokens);
const ast = parser.parse();

console.log('✅ Parse successful!\n');

// Show AST statistics
const stats = analyze_ast(ast);
console.log('AST Statistics:');
console.log(`  Components defined:  ${stats.components.length} (${stats.components.join(', ')})`);
console.log(`  Expressions:         ${stats.expressions}`);
console.log(`  If statements:       ${stats.if_statements}`);
console.log(`  For loops:           ${stats.for_loops}`);
console.log(`  Text nodes:          ${stats.text_nodes}`);
console.log(`  Total nodes:         ${stats.total_nodes}`);

// Show component structure
console.log('\n🧩 Component Structure:\n');
for (const component of ast.body) {
  if (component.type === NodeType.COMPONENT_DEFINITION) {
    console.log(`Component: ${(component as any).name}`);
    show_component_structure(component as any, 1);
  }
}

// Show data bindings found
console.log('\n🔗 Data Bindings Found:\n');
const bindings = extract_bindings(ast);
console.log('Expressions:');
for (const expr of bindings.expressions) {
  console.log(`  - <%= ${expr} %>`);
}
console.log('\nConditions:');
for (const cond of bindings.conditions) {
  console.log(`  - if (${cond})`);
}
console.log('\nIterators:');
for (const iter of bindings.iterators) {
  console.log(`  - for (${iter})`);
}

// Helper functions

function analyze_ast(node: ASTNode, stats: any = null): any {
  if (!stats) {
    stats = {
      components: [],
      expressions: 0,
      if_statements: 0,
      for_loops: 0,
      text_nodes: 0,
      total_nodes: 0
    };
  }
  
  stats.total_nodes++;
  
  switch (node.type) {
    case NodeType.PROGRAM:
      for (const child of (node as any).body) {
        analyze_ast(child, stats);
      }
      break;
      
    case NodeType.COMPONENT_DEFINITION:
      stats.components.push((node as any).name);
      for (const child of (node as any).body) {
        analyze_ast(child, stats);
      }
      break;
      
    case NodeType.EXPRESSION:
      stats.expressions++;
      break;
      
    case NodeType.IF_STATEMENT:
      stats.if_statements++;
      for (const child of (node as any).consequent) {
        analyze_ast(child, stats);
      }
      if ((node as any).alternate) {
        for (const child of (node as any).alternate) {
          analyze_ast(child, stats);
        }
      }
      break;
      
    case NodeType.FOR_STATEMENT:
      stats.for_loops++;
      for (const child of (node as any).body) {
        analyze_ast(child, stats);
      }
      break;
      
    case NodeType.TEXT:
      if ((node as any).content.trim()) {
        stats.text_nodes++;
      }
      break;
  }
  
  return stats;
}

function show_component_structure(node: any, indent: number) {
  const spaces = '  '.repeat(indent);
  
  // Count different types of nodes
  const summary = {
    html: 0,
    expressions: 0,
    control_flow: 0
  };
  
  function count_nodes(n: any) {
    if (n.type === NodeType.TEXT && n.content.includes('<')) {
      summary.html++;
    } else if (n.type === NodeType.EXPRESSION) {
      summary.expressions++;
    } else if (n.type === NodeType.IF_STATEMENT || n.type === NodeType.FOR_STATEMENT) {
      summary.control_flow++;
    }
    
    // Recurse into children
    if (n.body) {
      for (const child of n.body) {
        count_nodes(child);
      }
    }
    if (n.consequent) {
      for (const child of n.consequent) {
        count_nodes(child);
      }
    }
    if (n.alternate) {
      for (const child of n.alternate) {
        count_nodes(child);
      }
    }
  }
  
  for (const child of node.body) {
    count_nodes(child);
  }
  
  console.log(`${spaces}├─ HTML elements: ${summary.html}`);
  console.log(`${spaces}├─ Expressions: ${summary.expressions}`);
  console.log(`${spaces}└─ Control flow: ${summary.control_flow}`);
}

function extract_bindings(node: ASTNode, bindings: any = null): any {
  if (!bindings) {
    bindings = {
      expressions: new Set<string>(),
      conditions: new Set<string>(),
      iterators: new Set<string>()
    };
  }
  
  switch (node.type) {
    case NodeType.PROGRAM:
    case NodeType.COMPONENT_DEFINITION:
      for (const child of (node as any).body) {
        extract_bindings(child, bindings);
      }
      break;
      
    case NodeType.EXPRESSION:
      bindings.expressions.add((node as any).code);
      break;
      
    case NodeType.IF_STATEMENT:
      bindings.conditions.add((node as any).condition);
      for (const child of (node as any).consequent) {
        extract_bindings(child, bindings);
      }
      if ((node as any).alternate) {
        for (const child of (node as any).alternate) {
          extract_bindings(child, bindings);
        }
      }
      break;
      
    case NodeType.FOR_STATEMENT:
      bindings.iterators.add((node as any).iterator);
      for (const child of (node as any).body) {
        extract_bindings(child, bindings);
      }
      break;
  }
  
  // Convert sets to arrays for display
  return {
    expressions: Array.from(bindings.expressions),
    conditions: Array.from(bindings.conditions),
    iterators: Array.from(bindings.iterators)
  };
}

console.log('\n✨ Demo complete!');