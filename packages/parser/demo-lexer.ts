// Demo script showing how to use the JQHTML lexer

import { Lexer } from './src/lexer.js';

// Example JQHTML template
const template = `
<Define:UserCard>
  <div class="user-card" $sid="card_<%= user.id %>">
    <h3><%= user.name %></h3>
    
    <% if (user.isOnline): %>
      <span class="status online">Online</span>
    <% else: %>
      <span class="status offline">Offline</span>
    <% endif; %>
    
    <div class="actions">
      <button @click=this.edit_user>Edit</button>
      <button @click=this.delete_user>Delete</button>
    </div>
  </div>
</Define:UserCard>

<Define:UserList>
  <div class="user-list">
    <h2>Users (<%= users.length %>)</h2>
    
    <% for (let user of users): %>
      <UserCard $user="<%= user %>" />
    <% endfor; %>
  </div>
</Define:UserList>
`;

console.log('🎯 JQHTML Lexer Demo\n');
console.log('Template:');
console.log('─'.repeat(60));
console.log(template);
console.log('─'.repeat(60));

// Tokenize the template
const lexer = new Lexer(template);
const tokens = lexer.tokenize();

// Group tokens by type
const token_stats = new Map<string, number>();
for (const token of tokens) {
  token_stats.set(token.type, (token_stats.get(token.type) || 0) + 1);
}

console.log('\n📊 Token Statistics:');
for (const [type, count] of token_stats) {
  console.log(`  ${type.padEnd(20)} ${count}`);
}

// Show component definitions found
console.log('\n🧩 Components Found:');
for (let i = 0; i < tokens.length - 1; i++) {
  if (tokens[i].type === 'DEFINE_START' && tokens[i + 1].type === 'COMPONENT_NAME') {
    console.log(`  - ${tokens[i + 1].value}`);
  }
}

// Show expressions found
console.log('\n💻 Expressions Found:');
for (let i = 0; i < tokens.length - 1; i++) {
  if (tokens[i].type === 'EXPRESSION_START' && tokens[i + 1].type === 'JAVASCRIPT') {
    console.log(`  - <%= ${tokens[i + 1].value} %>`);
  }
}

// Show control flow
console.log('\n🔀 Control Flow Found:');
for (const token of tokens) {
  if (['IF', 'ELSE', 'ELSEIF', 'ENDIF', 'FOR', 'ENDFOR'].includes(token.type)) {
    const js_token = tokens[tokens.indexOf(token) + 1];
    if (js_token && js_token.type === 'JAVASCRIPT') {
      console.log(`  - ${token.type} ${js_token.value}`);
    } else {
      console.log(`  - ${token.type}`);
    }
  }
}

console.log('\n✅ Lexing complete! Total tokens:', tokens.length);