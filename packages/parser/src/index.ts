// JQHTML Parser - Main entry point

import { Lexer } from './lexer.js';
import { Parser } from './parser.js';

export { Lexer, Token, TokenType } from './lexer.js';
export { Parser } from './parser.js';
export { CodeGenerator, generate } from './codegen.js';
export { compileTemplate, CompileOptions, CompiledOutput } from './compiler.js';
export {
  NodeType,
  ASTNode,
  ProgramNode,
  ComponentDefinitionNode,
  TextNode,
  ExpressionNode,
  IfStatementNode,
  ForStatementNode,
  CodeBlockNode,
  FragmentNode
} from './ast.js';
export { JQHTMLParseError, ErrorCollector } from './errors.js';

// Convenience function for parsing with error context
export function parse(source: string, filename?: string) {
  try {
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens, source, filename);
    return parser.parse();
  } catch (error: any) {
    // If it's already a JQHTMLParseError, just re-throw it
    if (error.name === 'JQHTMLParseError') {
      throw error;
    }

    // Otherwise wrap it with context
    const message = error.message || String(error);
    const enhancedMessage = filename
      ? `Error parsing ${filename}: ${message}`
      : `Error parsing JQHTML: ${message}`;

    throw new Error(enhancedMessage);
  }
}