import { Lexer } from './dist/lexer.js';
import fs from 'fs';

const source = fs.readFileSync('../router/demo/spa/src/templates/StatusBadge.jqhtml', 'utf-8');
const lexer = new Lexer(source);
const tokens = lexer.tokenize();

console.log('=== StatusBadge Tokens ===');
tokens.forEach((token, i) => {
  console.log(`[${i}] ${token.type}: "${token.value}" (line ${token.line})`);
});