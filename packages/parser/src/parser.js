// JQHTML Parser - Builds AST from tokens
// Simple recursive descent parser, no complex libraries
import { TokenType } from './lexer.js';
import { NodeType, createNode } from './ast.js';
export class Parser {
    tokens;
    current = 0;
    constructor(tokens) {
        this.tokens = tokens;
    }
    // Main entry point - parse tokens into AST
    parse() {
        const body = [];
        const start = this.current_token();
        while (!this.is_at_end()) {
            const node = this.parse_top_level();
            if (node) {
                body.push(node);
            }
        }
        const end = this.previous_token();
        return createNode(NodeType.PROGRAM, { body }, start.start, end.end, start.line, start.column);
    }
    // Parse top-level constructs
    parse_top_level() {
        // Skip whitespace-only text nodes at top level
        if (this.match(TokenType.NEWLINE)) {
            return null;
        }
        // Component definition
        if (this.check(TokenType.DEFINE_START)) {
            return this.parse_component_definition();
        }
        // Regular content
        return this.parse_content();
    }
    // Parse <Define:ComponentName>...</Define:ComponentName>
    parse_component_definition() {
        const start_token = this.consume(TokenType.DEFINE_START, 'Expected <Define:');
        const name_token = this.consume(TokenType.COMPONENT_NAME, 'Expected component name');
        this.consume(TokenType.GT, 'Expected >');
        const body = [];
        // Parse until we find the closing tag
        while (!this.check(TokenType.DEFINE_END)) {
            if (this.is_at_end()) {
                throw new Error(`Unclosed component definition: ${name_token.value}`);
            }
            const node = this.parse_content();
            if (node) {
                body.push(node);
            }
        }
        // Consume closing tag
        this.consume(TokenType.DEFINE_END, 'Expected </Define:');
        const closing_name = this.consume(TokenType.COMPONENT_NAME, 'Expected component name');
        if (closing_name.value !== name_token.value) {
            throw new Error(`Mismatched component tags: <Define:${name_token.value}> closed with </Define:${closing_name.value}>`);
        }
        const end_token = this.consume(TokenType.GT, 'Expected >');
        return createNode(NodeType.COMPONENT_DEFINITION, { name: name_token.value, body }, start_token.start, end_token.end, start_token.line, start_token.column);
    }
    // Parse content (text, expressions, control flow)
    parse_content() {
        // Plain text
        if (this.match(TokenType.TEXT)) {
            const token = this.previous();
            return createNode(NodeType.TEXT, { content: token.value }, token.start, token.end, token.line, token.column);
        }
        // Expression <%= ... %>
        if (this.match(TokenType.EXPRESSION_START)) {
            return this.parse_expression();
        }
        // Code block <% ... %>
        if (this.match(TokenType.CODE_START)) {
            return this.parse_code_block();
        }
        // Skip newlines in content
        if (this.match(TokenType.NEWLINE)) {
            const token = this.previous();
            return createNode(NodeType.TEXT, { content: token.value }, token.start, token.end, token.line, token.column);
        }
        // HTML tags (treated as text for now)
        if (this.match(TokenType.LT)) {
            const token = this.previous();
            return createNode(NodeType.TEXT, { content: token.value }, token.start, token.end, token.line, token.column);
        }
        // Advance if we don't recognize the token
        if (!this.is_at_end()) {
            this.advance();
        }
        return null;
    }
    // Parse <%= expression %>
    parse_expression() {
        const start_token = this.previous(); // EXPRESSION_START
        const code_token = this.consume(TokenType.JAVASCRIPT, 'Expected JavaScript code');
        const end_token = this.consume(TokenType.TAG_END, 'Expected %>');
        return createNode(NodeType.EXPRESSION, { code: code_token.value }, start_token.start, end_token.end, start_token.line, start_token.column);
    }
    // Parse <% code %> - might be control flow or plain code
    parse_code_block() {
        const start_token = this.previous(); // CODE_START
        // Check for control flow keywords
        if (this.check(TokenType.IF)) {
            return this.parse_if_statement(start_token);
        }
        if (this.check(TokenType.FOR)) {
            return this.parse_for_statement(start_token);
        }
        // Skip else/endif/endfor - they're handled by their parent statements
        if (this.check(TokenType.ELSE) ||
            this.check(TokenType.ENDIF) ||
            this.check(TokenType.ENDFOR)) {
            // Put the CODE_START token back
            this.current--;
            return null;
        }
        // Plain code block
        const code_token = this.consume(TokenType.JAVASCRIPT, 'Expected JavaScript code');
        const end_token = this.consume(TokenType.TAG_END, 'Expected %>');
        return createNode(NodeType.CODE_BLOCK, { code: code_token.value }, start_token.start, end_token.end, start_token.line, start_token.column);
    }
    // Parse if statement with optional else
    parse_if_statement(start_token) {
        this.consume(TokenType.IF, 'Expected if');
        const condition_token = this.consume(TokenType.JAVASCRIPT, 'Expected condition');
        this.consume(TokenType.TAG_END, 'Expected %>');
        const consequent = [];
        let alternate = null;
        // Parse consequent branch
        while (!this.check_sequence(TokenType.CODE_START, TokenType.ELSE) &&
            !this.check_sequence(TokenType.CODE_START, TokenType.ENDIF)) {
            if (this.is_at_end()) {
                throw new Error('Unclosed if statement');
            }
            const node = this.parse_content();
            if (node) {
                consequent.push(node);
            }
        }
        // Check for else branch
        if (this.check_sequence(TokenType.CODE_START, TokenType.ELSE)) {
            this.advance(); // CODE_START
            this.advance(); // ELSE
            // Skip optional trailing code
            if (this.check(TokenType.JAVASCRIPT)) {
                this.advance();
            }
            this.consume(TokenType.TAG_END, 'Expected %>');
            alternate = [];
            // Parse else branch
            while (!this.check_sequence(TokenType.CODE_START, TokenType.ENDIF)) {
                if (this.is_at_end()) {
                    throw new Error('Unclosed if statement');
                }
                const node = this.parse_content();
                if (node) {
                    alternate.push(node);
                }
            }
        }
        // Consume endif
        this.consume(TokenType.CODE_START, 'Expected <%');
        this.consume(TokenType.ENDIF, 'Expected endif');
        // Skip optional semicolon
        if (this.check(TokenType.JAVASCRIPT)) {
            this.advance();
        }
        const end_token = this.consume(TokenType.TAG_END, 'Expected %>');
        return createNode(NodeType.IF_STATEMENT, {
            condition: condition_token.value,
            consequent,
            alternate
        }, start_token.start, end_token.end, start_token.line, start_token.column);
    }
    // Parse for loop
    parse_for_statement(start_token) {
        this.consume(TokenType.FOR, 'Expected for');
        const iterator_token = this.consume(TokenType.JAVASCRIPT, 'Expected iterator expression');
        this.consume(TokenType.TAG_END, 'Expected %>');
        const body = [];
        // Parse loop body
        while (!this.check_sequence(TokenType.CODE_START, TokenType.ENDFOR)) {
            if (this.is_at_end()) {
                throw new Error('Unclosed for statement');
            }
            const node = this.parse_content();
            if (node) {
                body.push(node);
            }
        }
        // Consume endfor
        this.consume(TokenType.CODE_START, 'Expected <%');
        this.consume(TokenType.ENDFOR, 'Expected endfor');
        // Skip optional semicolon
        if (this.check(TokenType.JAVASCRIPT)) {
            this.advance();
        }
        const end_token = this.consume(TokenType.TAG_END, 'Expected %>');
        return createNode(NodeType.FOR_STATEMENT, {
            iterator: iterator_token.value,
            body
        }, start_token.start, end_token.end, start_token.line, start_token.column);
    }
    // Token navigation helpers
    match(...types) {
        for (const type of types) {
            if (this.check(type)) {
                this.advance();
                return true;
            }
        }
        return false;
    }
    check(type) {
        if (this.is_at_end())
            return false;
        return this.peek().type === type;
    }
    check_sequence(...types) {
        for (let i = 0; i < types.length; i++) {
            if (this.current + i >= this.tokens.length) {
                return false;
            }
            if (this.tokens[this.current + i].type !== types[i]) {
                return false;
            }
        }
        return true;
    }
    advance() {
        if (!this.is_at_end())
            this.current++;
        return this.previous();
    }
    is_at_end() {
        return this.peek().type === TokenType.EOF;
    }
    peek() {
        return this.tokens[this.current];
    }
    previous() {
        return this.tokens[this.current - 1];
    }
    current_token() {
        return this.tokens[this.current] || this.tokens[this.tokens.length - 1];
    }
    previous_token() {
        return this.tokens[Math.max(0, this.current - 1)];
    }
    consume(type, message) {
        if (this.check(type))
            return this.advance();
        const token = this.peek();
        throw new Error(`${message} at line ${token.line}:${token.column}. Got ${token.type} instead.`);
    }
}
