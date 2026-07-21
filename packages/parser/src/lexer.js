// JQHTML Lexer - Simple character scanner, no regex
// Tracks positions for source map support
export var TokenType;
(function (TokenType) {
    // Literals
    TokenType["TEXT"] = "TEXT";
    // JQHTML tags
    TokenType["EXPRESSION_START"] = "EXPRESSION_START";
    TokenType["CODE_START"] = "CODE_START";
    TokenType["TAG_END"] = "TAG_END";
    // Control flow
    TokenType["IF"] = "IF";
    TokenType["ELSE"] = "ELSE";
    TokenType["ELSEIF"] = "ELSEIF";
    TokenType["ENDIF"] = "ENDIF";
    TokenType["FOR"] = "FOR";
    TokenType["ENDFOR"] = "ENDFOR";
    // Component definition
    TokenType["DEFINE_START"] = "DEFINE_START";
    TokenType["DEFINE_END"] = "DEFINE_END";
    TokenType["COMPONENT_NAME"] = "COMPONENT_NAME";
    // Attributes
    TokenType["ATTR_NAME"] = "ATTR_NAME";
    TokenType["ATTR_VALUE"] = "ATTR_VALUE";
    // Delimiters
    TokenType["COLON"] = "COLON";
    TokenType["SEMICOLON"] = "SEMICOLON";
    TokenType["GT"] = "GT";
    TokenType["LT"] = "LT";
    TokenType["SLASH"] = "SLASH";
    TokenType["EQUALS"] = "EQUALS";
    TokenType["QUOTE"] = "QUOTE";
    // Special
    TokenType["EOF"] = "EOF";
    TokenType["NEWLINE"] = "NEWLINE";
    TokenType["WHITESPACE"] = "WHITESPACE";
    // JavaScript code
    TokenType["JAVASCRIPT"] = "JAVASCRIPT";
})(TokenType || (TokenType = {}));
export class Lexer {
    input;
    position = 0;
    line = 1;
    column = 1;
    tokens = [];
    constructor(input) {
        this.input = input;
    }
    tokenize() {
        while (this.position < this.input.length) {
            this.scan_next();
        }
        this.add_token(TokenType.EOF, '', this.position, this.position);
        return this.tokens;
    }
    scan_next() {
        const start = this.position;
        const start_line = this.line;
        const start_column = this.column;
        // Check for JQHTML tags first
        if (this.match_sequence('<%=')) {
            this.add_token(TokenType.EXPRESSION_START, '<%=', start, this.position);
            this.scan_expression();
            return;
        }
        if (this.match_sequence('<%')) {
            this.add_token(TokenType.CODE_START, '<%', start, this.position);
            this.scan_code_block();
            return;
        }
        if (this.match_sequence('%>')) {
            this.add_token(TokenType.TAG_END, '%>', start, this.position);
            return;
        }
        // Check for Define tags
        if (this.match_sequence('<Define:')) {
            this.add_token(TokenType.DEFINE_START, '<Define:', start, this.position);
            this.scan_component_name();
            return;
        }
        if (this.match_sequence('</Define:')) {
            this.add_token(TokenType.DEFINE_END, '</Define:', start, this.position);
            this.scan_component_name();
            return;
        }
        // Single character tokens
        const char = this.current_char();
        if (char === '<') {
            this.advance();
            this.add_token(TokenType.LT, '<', start, this.position);
            return;
        }
        if (char === '>') {
            this.advance();
            this.add_token(TokenType.GT, '>', start, this.position);
            return;
        }
        if (char === '\n') {
            this.advance();
            this.add_token(TokenType.NEWLINE, '\n', start, this.position);
            return;
        }
        // Default: scan as text until next special character
        this.scan_text();
    }
    scan_text() {
        const start = this.position;
        let text = '';
        while (this.position < this.input.length) {
            const char = this.current_char();
            // Stop at any potential JQHTML tag start
            if (char === '<') {
                // Peek ahead for special sequences
                if (this.peek_ahead(1) === '%' ||
                    this.peek_ahead(1) === 'D' && this.peek_sequence_at(1, 'Define:') ||
                    this.peek_ahead(1) === '/' && this.peek_sequence_at(1, '/Define:')) {
                    break;
                }
            }
            if (char === '%' && this.peek_ahead(1) === '>') {
                break;
            }
            text += char;
            this.advance();
        }
        if (text.length > 0) {
            this.add_token(TokenType.TEXT, text, start, this.position);
        }
    }
    scan_code_block() {
        // After <%, scan until we find specific keywords or %>
        this.skip_whitespace();
        const keyword_start = this.position;
        // Check for control flow keywords
        if (this.match_keyword('if')) {
            this.add_token(TokenType.IF, 'if', keyword_start, this.position);
            this.scan_javascript(); // Scan the condition
        }
        else if (this.match_keyword('else')) {
            this.add_token(TokenType.ELSE, 'else', keyword_start, this.position);
            this.scan_javascript(); // Might have trailing code
        }
        else if (this.match_keyword('elseif')) {
            this.add_token(TokenType.ELSEIF, 'elseif', keyword_start, this.position);
            this.scan_javascript(); // Scan the condition
        }
        else if (this.match_keyword('endif')) {
            this.add_token(TokenType.ENDIF, 'endif', keyword_start, this.position);
            this.scan_javascript(); // Might have semicolon
        }
        else if (this.match_keyword('for')) {
            this.add_token(TokenType.FOR, 'for', keyword_start, this.position);
            this.scan_javascript(); // Scan the loop expression
        }
        else if (this.match_keyword('endfor')) {
            this.add_token(TokenType.ENDFOR, 'endfor', keyword_start, this.position);
            this.scan_javascript(); // Might have semicolon
        }
        else {
            // It's JavaScript code - scan until %>
            this.scan_javascript();
        }
    }
    scan_expression() {
        // After <%=, scan JavaScript until %>
        this.scan_javascript();
    }
    scan_javascript() {
        const start = this.position;
        let code = '';
        while (this.position < this.input.length) {
            if (this.current_char() === '%' && this.peek_ahead(1) === '>') {
                break;
            }
            code += this.current_char();
            this.advance();
        }
        if (code.trim().length > 0) {
            this.add_token(TokenType.JAVASCRIPT, code.trim(), start, this.position);
        }
    }
    scan_component_name() {
        const start = this.position;
        let name = '';
        while (this.position < this.input.length) {
            const char = this.current_char();
            // Component names are alphanumeric with underscores
            if ((char >= 'a' && char <= 'z') ||
                (char >= 'A' && char <= 'Z') ||
                (char >= '0' && char <= '9') ||
                char === '_') {
                name += char;
                this.advance();
            }
            else {
                break;
            }
        }
        if (name.length > 0) {
            this.add_token(TokenType.COMPONENT_NAME, name, start, this.position);
        }
    }
    match_sequence(sequence) {
        if (this.position + sequence.length > this.input.length) {
            return false;
        }
        for (let i = 0; i < sequence.length; i++) {
            if (this.input[this.position + i] !== sequence[i]) {
                return false;
            }
        }
        // Consume the sequence
        for (let i = 0; i < sequence.length; i++) {
            this.advance();
        }
        return true;
    }
    match_keyword(keyword) {
        const start = this.position;
        // Match the keyword
        for (let i = 0; i < keyword.length; i++) {
            if (this.position + i >= this.input.length ||
                this.input[this.position + i] !== keyword[i]) {
                return false;
            }
        }
        // Ensure it's not part of a larger word
        const next_pos = this.position + keyword.length;
        if (next_pos < this.input.length) {
            const next_char = this.input[next_pos];
            if ((next_char >= 'a' && next_char <= 'z') ||
                (next_char >= 'A' && next_char <= 'Z') ||
                (next_char >= '0' && next_char <= '9') ||
                next_char === '_') {
                return false;
            }
        }
        // Consume the keyword
        for (let i = 0; i < keyword.length; i++) {
            this.advance();
        }
        return true;
    }
    peek_sequence(sequence) {
        if (this.position + sequence.length > this.input.length) {
            return false;
        }
        for (let i = 0; i < sequence.length; i++) {
            if (this.input[this.position + i] !== sequence[i]) {
                return false;
            }
        }
        return true;
    }
    peek_sequence_at(offset, sequence) {
        const start = this.position + offset;
        if (start + sequence.length > this.input.length) {
            return false;
        }
        for (let i = 0; i < sequence.length; i++) {
            if (this.input[start + i] !== sequence[i]) {
                return false;
            }
        }
        return true;
    }
    skip_whitespace() {
        while (this.position < this.input.length) {
            const char = this.current_char();
            if (char === ' ' || char === '\t' || char === '\r') {
                this.advance();
            }
            else {
                break;
            }
        }
    }
    current_char() {
        return this.input[this.position] || '';
    }
    peek_ahead(offset) {
        return this.input[this.position + offset] || '';
    }
    advance() {
        if (this.current_char() === '\n') {
            this.line++;
            this.column = 1;
        }
        else {
            this.column++;
        }
        this.position++;
    }
    add_token(type, value, start, end) {
        this.tokens.push({
            type,
            value,
            line: this.line,
            column: this.column,
            start,
            end
        });
    }
}
