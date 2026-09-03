// AST Node Types for JQHTML Templates
// Simple, clear node structures for the syntax tree

import { SourceLocation } from './lexer.js';

export enum NodeType {
  PROGRAM = 'Program',
  COMPONENT_DEFINITION = 'ComponentDefinition',
  COMPONENT_INVOCATION = 'ComponentInvocation',
  HTML_TAG = 'HtmlTag',
  TEXT = 'Text',
  EXPRESSION = 'Expression',
  IF_STATEMENT = 'IfStatement',
  FOR_STATEMENT = 'ForStatement',
  CODE_BLOCK = 'CodeBlock',
  FRAGMENT = 'Fragment',
  SLOT = 'Slot',  // v2 slot syntax
  CONDITIONAL_ATTRIBUTE = 'ConditionalAttribute'  // Conditional attribute: <% if (cond) { %>attr="val"<% } %>
}

// Base node interface - all nodes have these
export interface BaseNode {
  type: NodeType;
  start: number;      // Deprecated: use loc.start.offset
  end: number;        // Deprecated: use loc.end.offset
  line: number;       // Deprecated: use loc.start.line
  column: number;     // Deprecated: use loc.start.column
  loc?: SourceLocation;  // New: detailed location information for source maps
  range?: [number, number];  // Optional: start/end offsets as array
}

// Root node of the AST
export interface ProgramNode extends BaseNode {
  type: NodeType.PROGRAM;
  body: ASTNode[];
}

// Component definition: <Define:ComponentName>...</Define:ComponentName>
export interface ComponentDefinitionNode extends BaseNode {
  type: NodeType.COMPONENT_DEFINITION;
  name: string;
  body: ASTNode[];
  attributes: Record<string, any>;  // For metadata like tag="span", class="card", etc.
  extends?: string;  // Explicit template inheritance via extends="ParentComponent"
  defineArgs?: Record<string, any>;  // $ attributes on Define tag (raw JS, not data- attributes)
  isSlotOnly?: boolean;  // True if body contains only slot nodes (triggers template inheritance)
  slotNames?: string[];  // Names of slots when isSlotOnly is true
}

// Plain text or HTML content
export interface TextNode extends BaseNode {
  type: NodeType.TEXT;
  content: string;
}

// Expression: <%= javascript %> or <%!= javascript %> or <%br= javascript %>
export interface ExpressionNode extends BaseNode {
  type: NodeType.EXPRESSION;
  code: string;
  escaped: boolean;  // true for <%= and <%br=, false for <%!=
  nl2br: boolean;    // true for <%br= (escaped + newlines to <br />)
}

// If statement with optional else
export interface IfStatementNode extends BaseNode {
  type: NodeType.IF_STATEMENT;
  condition: string;
  consequent: ASTNode[];
  alternate: ASTNode[] | null;
}

// For loop
export interface ForStatementNode extends BaseNode {
  type: NodeType.FOR_STATEMENT;
  iterator: string;  // The full for expression
  body: ASTNode[];
}

// Generic code block: <% javascript %>
export interface CodeBlockNode extends BaseNode {
  type: NodeType.CODE_BLOCK;
  tokens?: Array<{type: string, value: string}>;  // New token-based approach
  code?: string;  // Keep for backward compatibility
}

// Conditional attribute: <% if (condition) { %>attr="value"<% } %>
export interface ConditionalAttributeNode extends BaseNode {
  type: NodeType.CONDITIONAL_ATTRIBUTE;
  condition: string;  // JavaScript condition expression
  attributes: Record<string, any>;  // Attributes to include if condition is true
}

// Fragment - a list of nodes (useful for grouping)
export interface FragmentNode extends BaseNode {
  type: NodeType.FRAGMENT;
  children: ASTNode[];
}

// Slot - v2 named content area: <Slot:name>content</Slot:name>
export interface SlotNode extends BaseNode {
  type: NodeType.SLOT;
  name: string;
  attributes?: Record<string, any>;
  // Parameter names declared with $params="a, b". When absent the slot
  // function takes a single parameter named after the slot.
  params?: string[];
  children: ASTNode[];
  selfClosing: boolean;
}

// Component invocation: <ComponentName prop="value">...</ComponentName>
export interface ComponentInvocationNode extends BaseNode {
  type: NodeType.COMPONENT_INVOCATION;
  name: string;
  attributes: Record<string, any>;
  conditionalAttributes?: ConditionalAttributeNode[];  // Optional conditional attributes
  children: ASTNode[];
  selfClosing: boolean;
}

// HTML tag: <div class="foo">...</div>
export interface HtmlTagNode extends BaseNode {
  type: NodeType.HTML_TAG;
  name: string;
  attributes: Record<string, any>;
  conditionalAttributes?: ConditionalAttributeNode[];  // Optional conditional attributes
  children: ASTNode[];
  selfClosing: boolean;
  preserveWhitespace?: boolean;  // True for <textarea>, <pre> - preserves exact whitespace
}

// Union type for all AST nodes
export type ASTNode =
  | ProgramNode
  | ComponentDefinitionNode
  | ComponentInvocationNode
  | HtmlTagNode
  | TextNode
  | ExpressionNode
  | IfStatementNode
  | ForStatementNode
  | CodeBlockNode
  | FragmentNode
  | SlotNode
  | ConditionalAttributeNode;

// Helper to create nodes with common properties
export function createNode<T extends ASTNode>(
  type: T['type'],
  props: Omit<T, 'type' | keyof BaseNode>,
  start: number,
  end: number,
  line: number,
  column: number,
  loc?: SourceLocation
): T {
  return {
    type,
    start,
    end,
    line,
    column,
    loc,
    ...props
  } as T;
}