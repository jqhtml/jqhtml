// JQHTML Lexer - Simple character scanner, no regex
// Tracks positions for source map support

import { JQHTMLParseError, HiddenCloseLocation } from './errors.js';
import { find_template_close, find_matching_bracket, blank_line_comments, code_line_starts, find_hidden_closes } from './js_scanner.js';

export enum TokenType {
  // Literals
  TEXT = 'TEXT',
  
  // JQHTML tags
  EXPRESSION_START = 'EXPRESSION_START',     // <%=
  EXPRESSION_UNESCAPED = 'EXPRESSION_UNESCAPED', // <%!=
  EXPRESSION_BR = 'EXPRESSION_BR',           // <%br= (escaped + newlines to <br />)
  CODE_START = 'CODE_START',                 // <%
  TAG_END = 'TAG_END',                       // %>
  
  // Comments
  COMMENT = 'COMMENT',                       // <%-- comment --%>
  
  // Component definition
  DEFINE_START = 'DEFINE_START',             // <Define:
  DEFINE_END = 'DEFINE_END',                 // </Define:
  COMPONENT_NAME = 'COMPONENT_NAME',
  
  // Slots (v2)
  SLOT_START = 'SLOT_START',                 // <Slot:
  SLOT_END = 'SLOT_END',                     // </Slot:
  SLOT_NAME = 'SLOT_NAME',
  
  // HTML tags
  TAG_OPEN = 'TAG_OPEN',                     // <tagname or <ComponentName
  TAG_CLOSE = 'TAG_CLOSE',                   // </tagname or </ComponentName
  TAG_NAME = 'TAG_NAME',                     // The tag/component name
  DYNAMIC_TAG_NAME = 'DYNAMIC_TAG_NAME',     // <{expression}> - value is the expression text
  SELF_CLOSING = 'SELF_CLOSING',             // />
  
  // Attributes
  ATTR_NAME = 'ATTR_NAME',                   // $property or regular
  ATTR_VALUE = 'ATTR_VALUE',
  
  // Delimiters
  COLON = 'COLON',
  SEMICOLON = 'SEMICOLON',
  GT = 'GT',                                 // >
  LT = 'LT',                                 // <
  SLASH = 'SLASH',                           // /
  EQUALS = 'EQUALS',                         // =
  QUOTE = 'QUOTE',                           // " or '
  
  // Special
  EOF = 'EOF',
  NEWLINE = 'NEWLINE',
  WHITESPACE = 'WHITESPACE',
  
  // JavaScript code
  JAVASCRIPT = 'JAVASCRIPT'
}

// Position information for precise source mapping
export interface SourceLocation {
  start: {
    line: number;    // 1-based line number
    column: number;  // 1-based column number
    offset: number;  // 0-based absolute position in file
  };
  end: {
    line: number;    // 1-based line number
    column: number;  // 1-based column number
    offset: number;  // 0-based absolute position in file
  };
}

export interface Token {
  type: TokenType;
  value: string;
  line: number;      // Deprecated: use loc.start.line
  column: number;    // Deprecated: use loc.start.column
  start: number;     // Deprecated: use loc.start.offset
  end: number;       // Deprecated: use loc.end.offset
  loc?: SourceLocation;  // New: detailed location information for source maps
  /**
   * Set on the literal text parts of an interpolated attribute value
   * (title="a <%= x %> b"): they are text, never a value to classify as an
   * identifier or expression.
   */
  interpolation_text?: boolean;
}

export class Lexer {
  private input: string;
  private filename?: string;
  private position: number = 0;
  private line: number = 1;
  private column: number = 1;
  private tokens: Token[] = [];
  // Offset at which each line of the input starts, for token positions
  private line_starts: number[] = [0];

  // Each %> that a // comment in template code hides and that looks like it was
  // meant to close the tag; compile errors explain them (add_hidden_close_note)
  public readonly hidden_closes: HiddenCloseLocation[] = [];
  // True while an expression inside a quoted attribute value is scanned
  private in_attribute_value = false;

  // Track saved positions for accurate token creation
  private savedPosition: { line: number; column: number; offset: number } | null = null;

  constructor(input: string, filename?: string) {
    this.filename = filename;
    // Preprocess: Normalize all line endings to \n (handles \r\n and \r)
    // This ensures the lexer only needs to handle \n throughout
    let processed = input.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    // Preprocess: Replace JQHTML comments (<%-- --%) with equivalent newlines to preserve line mapping
    processed = this.preprocessComments(processed);
    // Preprocess: Replace HTML comments (<!-- -->) outside Define tags with equivalent newlines
    processed = this.preprocessHTMLComments(processed);
    // Preprocess: Insert // for empty lines in code blocks to preserve line mapping
    processed = this.preprocessCodeBlocks(processed);
    this.input = processed;
    for (let i = 0; i < processed.length; i++) {
      if (processed[i] === '\n') this.line_starts.push(i + 1);
    }
  }

  /** 1-based line and column of an input offset. */
  private position_at(offset: number): { line: number; column: number } {
    let low = 0;
    let high = this.line_starts.length - 1;
    while (low < high) {
      const mid = (low + high + 1) >> 1;
      if (this.line_starts[mid] <= offset) low = mid; else high = mid - 1;
    }
    return { line: low + 1, column: offset - this.line_starts[low] + 1 };
  }

  /**
   * Save current position for later token creation
   */
  private savePosition(): { line: number; column: number; offset: number } {
    this.savedPosition = {
      line: this.line,
      column: this.column,
      offset: this.position
    };
    return this.savedPosition;
  }

  /**
   * Get saved position or current position
   */
  private getSavedPosition(): { line: number; column: number; offset: number } {
    if (this.savedPosition) {
      const pos = this.savedPosition;
      this.savedPosition = null;
      return pos;
    }
    return {
      line: this.line,
      column: this.column,
      offset: this.position
    };
  }

  /**
   * Replace <%-- comment --%> with equivalent number of newlines
   * This ensures line mapping stays accurate while removing comment content
   */
  private preprocessComments(input: string): string {
    let result = input;
    let searchPos = 0;

    while (true) {
      // Find next comment start
      const startIdx = result.indexOf('<%--', searchPos);
      if (startIdx === -1) break;

      // Find matching comment end
      const endIdx = result.indexOf('--%>', startIdx + 4);
      if (endIdx === -1) {
        // Unclosed comment - leave it for parser to report error
        break;
      }

      // Extract the comment including delimiters
      const commentText = result.substring(startIdx, endIdx + 4);

      // Count newlines in the comment
      const newlineCount = (commentText.match(/\n/g) || []).length;

      // Replace comment with spaces and same number of newlines
      // We preserve the same total length to keep position tracking accurate
      let replacement = '';
      let charsNeeded = commentText.length;

      // First, add the newlines at their original positions
      let commentPos = 0;
      for (let i = 0; i < commentText.length; i++) {
        if (commentText[i] === '\n') {
          replacement += '\n';
        } else {
          replacement += ' ';
        }
      }

      // Replace the comment with the spacing
      result = result.substring(0, startIdx) + replacement + result.substring(endIdx + 4);

      // Move search position past this replacement
      searchPos = startIdx + replacement.length;
    }

    return result;
  }

  /**
   * Replace HTML comments (<!-- -->) that appear OUTSIDE of <Define> tags
   * This strips documentation comments before component definitions
   * HTML comments INSIDE <Define> tags are preserved in the output
   */
  private preprocessHTMLComments(input: string): string {
    let result = input;
    let searchPos = 0;
    let insideDefine = false;

    while (searchPos < result.length) {
      // Check if we're entering or leaving a Define tag
      if (result.substring(searchPos, searchPos + 8) === '<Define:') {
        insideDefine = true;
        searchPos += 8;
        continue;
      }
      if (result.substring(searchPos, searchPos + 9) === '</Define:') {
        insideDefine = false;
        searchPos += 9;
        continue;
      }

      // Only strip HTML comments if we're outside Define tags
      if (!insideDefine && result.substring(searchPos, searchPos + 4) === '<!--') {
        const startIdx = searchPos;

        // Find matching comment end
        const endIdx = result.indexOf('-->', searchPos + 4);
        if (endIdx === -1) {
          // Unclosed comment - leave it for lexer to report error
          break;
        }

        // Extract the comment including delimiters
        const commentText = result.substring(startIdx, endIdx + 3);

        // Replace comment with spaces and same number of newlines to preserve line mapping
        let replacement = '';
        for (let i = 0; i < commentText.length; i++) {
          if (commentText[i] === '\n') {
            replacement += '\n';
          } else {
            replacement += ' ';
          }
        }

        // Replace the comment with the spacing
        result = result.substring(0, startIdx) + replacement + result.substring(endIdx + 3);

        // Move search position past this replacement
        searchPos = startIdx + replacement.length;
      } else {
        searchPos++;
      }
    }

    return result;
  }

  /**
   * Preprocess code blocks: mark empty lines with a comment placeholder.
   *
   * Expressions (<%= %>, <%!= %>, <%br= %>) are left exactly as written - a
   * multi-line expression is joined onto one generated line by the parser, so no
   * newline is moved out of it into the template text. Lines that start inside a
   * string, template literal or block comment are part of that literal or comment
   * and are never touched (shared JS scanner).
   */
  private preprocessCodeBlocks(input: string): string {
    let result = input;
    let searchPos = 0;

    while (true) {
      // Find next <% sequence
      let startIdx = result.indexOf('<%', searchPos);
      if (startIdx === -1) break;

      // Expressions: skip the whole body, so a <% inside one is not a code block
      const after = result.substring(startIdx + 2, startIdx + 5);
      const exprStart = after.startsWith('=') ? startIdx + 3
        : after.startsWith('!=') ? startIdx + 4
        : after === 'br=' ? startIdx + 5
        : -1;
      if (exprStart !== -1) {
        const endIdx = find_template_close(result, exprStart);
        // Unclosed expression - leave it for the parser to report
        searchPos = endIdx === -1 ? startIdx + 2 : endIdx + 2;
        continue;
      }

      // Code block: insert /* empty line */ for empty lines
      const endIdx = find_template_close(result, startIdx + 2);
      if (endIdx === -1) {
        // Unclosed code block - leave it for parser to report error
        break;
      }

      this.record_hidden_closes(result, startIdx + 2);

      // Extract the code block content between <% and %>, with every // comment
      // blanked (length and newlines preserved for sourcemaps). Codegen joins a
      // source line's nodes onto one generated line, so a comment left in place
      // would comment out whatever follows the block on that line.
      const blockContent = blank_line_comments(result.substring(startIdx + 2, endIdx), true);

      // Process the content line by line
      const lines = blockContent.split('\n');
      const in_code = code_line_starts(blockContent, true);
      const processedLines: string[] = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        // Don't add placeholders on the last line if it's empty
        // (this would be right before the %>), or inside a literal or comment
        if (trimmed === '' && i < lines.length - 1 && in_code[i]) {
          // Empty line - use /* */ instead of // to avoid breaking code
          // Extra trailing space helps with alignment
          processedLines.push(' /* empty line */ ');
        } else {
          // Line has code, is the last line, or belongs to a literal - keep as is
          processedLines.push(line);
        }
      }

      // Reconstruct the code block
      const processedContent = processedLines.join('\n');
      result = result.substring(0, startIdx + 2) + processedContent + result.substring(endIdx);

      // Move search position past this block
      searchPos = startIdx + 2 + processedContent.length + 2; // +2 for %>
    }

    return result;
  }

  /**
   * Record the suspicious %> hidden in // comments of the code region starting at
   * `start` of `text`. Line comments are blanked once a code block is preprocessed,
   * so code blocks are recorded there and expressions (and an unclosed code block)
   * when scanned; no region is seen with its comments twice.
   */
  private record_hidden_closes(text: string, start: number) {
    for (const h of find_hidden_closes(text, start)) {
      if (!h.suspicious) continue;
      const line_start = text.lastIndexOf('\n', h.comment - 1) + 1;
      let line = 1;
      for (let i = text.indexOf('\n'); i !== -1 && i < line_start; i = text.indexOf('\n', i + 1)) line++;
      this.hidden_closes.push({
        line,
        column: h.comment - line_start + 1,
        close_column: h.close - line_start + 1,
        ...(this.in_attribute_value ? { in_attribute: true } : {})
      });
    }
  }

  tokenize(): Token[] {
    this.reject_script_text();
    while (this.position < this.input.length) {
      this.scan_next();
    }
    
    this.add_token(TokenType.EOF, '', this.position, this.position);
    return this.tokens;
  }
  
  /**
   * A template is compiled into JavaScript, and that JavaScript may be inlined in an
   * HTML <script> block, where any `<script` or `</script` in it would end or nest the
   * block. So the text is a compile error wherever it is written - a <script> element,
   * text, an attribute value, a <% %> block or an HTML comment. <%-- --%> comments are
   * never emitted and are blanked out of this.input already.
   */
  private reject_script_text(): void {
    const match = /<\/?script/i.exec(this.input);
    if (!match) return;
    const { line, column } = this.position_at(match.index);
    const error = new JQHTMLParseError(
      `${match[0]} is not allowed in a JQHTML template. The template compiles to JavaScript ` +
      `that may be inlined in an HTML <script> block, and this text would end it.`,
      line,
      column,
      this.input,
      this.filename
    );
    error.suggestion = `\n\nBehavior belongs in the component's .js file or a <% %> block. ` +
      `If a string must contain the text, split it: '<' + '/script>'.`;
    throw error;
  }

  private scan_next() {
    const start = this.position;
    const start_line = this.line;
    const start_column = this.column;
    
    // Check for JQHTML tags first
    // Comments are now preprocessed out, so we don't need to check for them

    // Check for invalid <%== syntax (common mistake)
    if (this.match_sequence('<%==')) {
      const error = new JQHTMLParseError(
        'Invalid expression syntax: <%== is not valid JQHTML syntax',
        this.line,
        this.column - 4,  // Point to the start of <%==
        this.input,
        this.filename
      );
      error.suggestion = '\n\nValid expression syntax:\n' +
        '  <%= expr %>   - Escaped output (safe, default)\n' +
        '  <%!= expr %>  - Unescaped HTML output (raw)\n\n' +
        'Did you mean:\n' +
        '  <%= ... %>   for escaped output, or\n' +
        '  <%!= ... %>  for unescaped/raw HTML output?';
      throw error;
    }

    if (this.match_sequence('<%!=')) {
      this.add_token(TokenType.EXPRESSION_UNESCAPED, '<%!=', start, this.position);
      this.scan_expression();
      return;
    }

    if (this.match_sequence('<%br=')) {
      this.add_token(TokenType.EXPRESSION_BR, '<%br=', start, this.position);
      this.scan_expression();
      return;
    }

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
    
    // Check for slot tags (v2)
    if (this.match_sequence('</Slot:')) {
      this.add_token(TokenType.SLOT_END, '</Slot:', start, this.position);
      this.scan_slot_name();
      return;
    }

    if (this.match_sequence('<Slot:')) {
      this.add_token(TokenType.SLOT_START, '<Slot:', start, this.position);
      this.scan_slot_name();
      return;
    }
    
    // Check for HTML comment first
    if (this.current_char() === '<' && this.peek_ahead(1) === '!' &&
        this.peek_ahead(2) === '-' && this.peek_ahead(3) === '-') {
      this.scan_html_comment();
      return;
    }

    // Check for HTML tags (including components)
    if (this.current_char() === '<') {
      // Dynamic component tags: <{expression} ...> and </{expression}>
      if (this.peek_ahead(1) === '{') {
        this.scan_dynamic_tag(false);
        return;
      }
      if (this.peek_ahead(1) === '/' && this.peek_ahead(2) === '{') {
        this.scan_dynamic_tag(true);
        return;
      }
      // Peek ahead to see if this is an HTML tag
      if (this.peek_ahead(1) === '/') {
        // Closing tag
        if (this.is_tag_start_at(2)) {
          this.scan_closing_tag();
          return;
        }
      } else if (this.is_tag_start_at(1)) {
        // Opening tag
        this.scan_opening_tag();
        return;
      }
    }
    
    // Single character tokens
    const char = this.current_char();
    
    // Don't tokenize < and > separately when they're part of HTML
    // They should be part of TEXT tokens
    
    /*
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
    */
    
    if (char === '\n') {
      this.advance();
      this.add_token(TokenType.NEWLINE, '\n', start, this.position);
      return;
    }
    
    // Default: scan as text until next special character
    this.scan_text();
  }
  
  private scan_text() {
    const start = this.position;
    let text = '';

    while (this.position < this.input.length) {
      const char = this.current_char();

      // Stop at any potential tag start
      if (char === '<') {
        // Check for HTML comment first - don't break, these should be in text
        if (this.peek_ahead(1) === '!' &&
            this.peek_ahead(2) === '-' &&
            this.peek_ahead(3) === '-') {
          break; // HTML comment will be handled separately
        }

        // Peek ahead for special sequences
        if (this.peek_ahead(1) === '%' ||
            this.peek_sequence_at(1, 'Slot:') ||  // Slot start
            this.peek_sequence_at(1, '/Slot:') ||  // Slot end
            this.peek_ahead(1) === 'D' && this.peek_sequence_at(1, 'Define:') ||
            this.peek_ahead(1) === '/' && this.peek_sequence_at(1, '/Define:')) {
          break;
        }
        // Also stop for HTML tags
        if (this.peek_ahead(1) === '{' || (this.peek_ahead(1) === '/' && this.peek_ahead(2) === '{')) {
          break; // Dynamic component tag
        }
        if (this.peek_ahead(1) === '/' && this.is_tag_start_at(2)) {
          break; // Closing tag
        }
        if (this.is_tag_start_at(1)) {
          break; // Opening tag
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
  
  private scan_code_block() {
    // The code, including any whitespace after <%, is JavaScript.
    this.scan_javascript();
  }
  
  private scan_html_comment() {
    // Scan HTML comment from <!-- to -->
    // Everything inside should be treated as raw text, no parsing
    const start = this.position;

    // Consume <!--
    this.advance(); // <
    this.advance(); // !
    this.advance(); // -
    this.advance(); // -

    let comment = '<!--';

    // Scan until we find -->
    while (this.position < this.input.length) {
      if (this.current_char() === '-' &&
          this.peek_ahead(1) === '-' &&
          this.peek_ahead(2) === '>') {
        // Found end of HTML comment
        comment += '-->';
        this.advance(); // -
        this.advance(); // -
        this.advance(); // >

        // Add the entire HTML comment as a TEXT token
        // This ensures it gets passed through as-is to the output
        this.add_token(TokenType.TEXT, comment, start, this.position);
        return;
      }

      comment += this.current_char();
      this.advance(); // tracks line and column
    }

    // Error: unterminated HTML comment, reported where it opens
    const opened = this.position_at(start);
    throw new JQHTMLParseError(
      'Unterminated HTML comment - expected -->',
      opened.line,
      opened.column,
      this.input,
      this.filename
    );
  }

  private scan_expression() {
    // After <%=, scan JavaScript until %>, keeping its whitespace
    this.scan_javascript(true);
  }

  private scan_javascript(keep_whitespace: boolean = false) {
    const start = this.position;
    // Up to the closing %> (left unconsumed), or the end of input if there is none
    let end = find_template_close(this.input, start);
    if (end === -1) end = this.input.length;
    this.record_hidden_closes(this.input, start);

    // Blank // comments (length preserved for sourcemaps): codegen puts this code
    // on a line with other generated code, which a comment would swallow
    let code = blank_line_comments(this.input.substring(start, end), true);
    while (this.position < end) this.advance();

    // Interpolations keep their whitespace; code blocks are trimmed, and the token
    // then starts at the code's first character (its position is a sourcemap target)
    let code_start = start;
    if (!keep_whitespace) {
      code_start += code.length - code.trimStart().length;
      code = code.trim();
    }

    if (code.trim().length > 0) {
      this.add_token(TokenType.JAVASCRIPT, code, code_start, this.position);
    }
  }

  private scan_component_name() {
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
      } else {
        break;
      }
    }
    
    if (name.length > 0) {
      this.add_token(TokenType.COMPONENT_NAME, name, start, this.position);
    }
    
    // Skip whitespace after component name
    this.skip_whitespace();

    // Also skip newlines after component name (for multiline Define tags)
    while (this.current_char() === '\n' || this.current_char() === '\r') {
      if (this.current_char() === '\n') {
        this.add_token(TokenType.NEWLINE, '\n', this.position, this.position + 1);
      }
      this.advance();
      this.skip_whitespace();
    }

    // If we see attributes, scan them
    if (this.is_attribute_start_char(this.current_char())) {
      this.scan_attributes();
    } else if (this.current_char() === '>') {
      // Otherwise scan the closing >
      const gt_start = this.position;
      this.advance();
      this.add_token(TokenType.GT, '>', gt_start, this.position);
    }
  }
  
  private scan_slot_name() {
    const start = this.position;
    let name = '';
    
    while (this.position < this.input.length) {
      const char = this.current_char();
      
      // Slot names are alphanumeric with underscores, same as components
      if ((char >= 'a' && char <= 'z') ||
          (char >= 'A' && char <= 'Z') ||
          (char >= '0' && char <= '9') ||
          char === '_') {
        name += char;
        this.advance();
      } else {
        break;
      }
    }
    
    if (name.length > 0) {
      this.add_token(TokenType.SLOT_NAME, name, start, this.position);
    }
    
    // Skip whitespace before attributes or closing
    this.skip_whitespace();
    
    // Attributes (<Slot:row $params="record, index">) scan like a tag's
    if (this.is_attribute_start_char(this.current_char())) {
      this.scan_attributes();
      return;
    }

    // For self-closing slots, check for />
    if (this.current_char() === '/' && this.peek_ahead(1) === '>') {
      const slash_start = this.position;
      this.advance(); // consume /
      this.add_token(TokenType.SLASH, '/', slash_start, this.position);
      const gt_start = this.position;
      this.advance(); // consume >
      this.add_token(TokenType.GT, '>', gt_start, this.position);
    } else if (this.current_char() === '>') {
      // Regular closing >
      const gt_start = this.position;
      this.advance();
      this.add_token(TokenType.GT, '>', gt_start, this.position);
    }
  }
  
  private match_sequence(sequence: string): boolean {
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
  
  private peek_sequence(sequence: string): boolean {
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
  
  private peek_sequence_at(offset: number, sequence: string): boolean {
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
  
  private skip_whitespace() {
    while (this.position < this.input.length) {
      const char = this.current_char();
      if (char === ' ' || char === '\t' || char === '\r') {
        this.advance();
      } else {
        break;
      }
    }
  }
  
  private current_char(): string {
    return this.input[this.position] || '';
  }
  
  private peek_ahead(offset: number): string {
    return this.input[this.position + offset] || '';
  }
  
  private advance() {
    if (this.current_char() === '\n') {
      this.line++;
      this.column = 1;
    } else {
      this.column++;
    }
    this.position++;
  }
  
  /**
   * Record a token spanning input offsets [start, end). Its line/column (and
   * loc.start) are those of `start` - the token's first character - and loc.end is
   * the position of `end`, whatever the scanner has consumed by the time it calls.
   */
  private add_token(type: TokenType, value: string, start: number, end: number, extra?: Partial<Token>) {
    const from = this.position_at(start);
    const to = this.position_at(end);

    this.tokens.push({
      type,
      value,
      line: from.line,  // Keep for backward compatibility
      column: from.column,  // Keep for backward compatibility
      start,  // Keep for backward compatibility
      end,  // Keep for backward compatibility
      loc: {
        start: {
          line: from.line,
          column: from.column,
          offset: start
        },
        end: {
          line: to.line,
          column: to.column,
          offset: end
        }
      },
      ...extra
    });
  }
  
  private is_tag_name_char(char: string): boolean {
    if (!char) return false;
    return (char >= 'a' && char <= 'z') || 
           (char >= 'A' && char <= 'Z');
  }
  
  // A tag may also begin with a single underscore followed by a letter: the
  // reserved component prefix (<_Root_Layout>). Whether such a name IS a
  // component is the parser's call (component-name.ts); "<_ " and "<__" stay text.
  private is_tag_start_at(pos: number): boolean {
    const char = this.peek_ahead(pos);
    return this.is_tag_name_char(char) ||
           (char === '_' && this.is_tag_name_char(this.peek_ahead(pos + 1)));
  }
  
  private is_tag_name_continue_char(char: string): boolean {
    if (!char) return false;
    return this.is_tag_name_char(char) ||
           (char >= '0' && char <= '9') ||
           char === '-' || char === '_' || char === ':';
  }
  
  private scan_opening_tag() {
    const start = this.position;
    this.advance(); // consume <
    this.add_token(TokenType.TAG_OPEN, '<', start, this.position);
    
    // Scan tag name
    const name_start = this.position;
    let name = '';
    
    while (this.position < this.input.length && 
           this.is_tag_name_continue_char(this.current_char())) {
      name += this.current_char();
      this.advance();
    }
    
    if (name.length > 0) {
      this.add_token(TokenType.TAG_NAME, name, name_start, this.position);
    }
    
    // Scan attributes until > or />
    this.scan_attributes();

    // <pre> is a raw-text element: everything up to </pre> is literal, including
    // markup. Tokenizing it as tags is what destroys the whitespace <pre> exists to
    // preserve, so the content never becomes tags in the first place. JQHTML
    // delimiters still apply - the block is raw HTML, not an opaque blob.
    if (name.toLowerCase() === 'pre' && this.last_token_type() === TokenType.GT) {
      this.scan_raw_text_element('pre');
    }
  }

  /**
   * <{expression} attrs...> or </{expression}>: a component whose name is
   * computed at render time. The expression runs from the { after < to its
   * matching }, honouring nested braces and string literals, so a > inside it
   * (<{a > b ? 'X' : 'Y'}>) never terminates the tag - the tag name ends at
   * the brace, not at >. Emits TAG_OPEN/TAG_CLOSE then DYNAMIC_TAG_NAME
   * carrying the raw expression text; attributes scan as for any tag.
   */
  private scan_dynamic_tag(closing: boolean) {
    const start = this.position;
    const start_line = this.line;
    const start_column = this.column;
    this.advance(); // <
    if (closing) this.advance(); // /
    this.add_token(closing ? TokenType.TAG_CLOSE : TokenType.TAG_OPEN, closing ? '</' : '<', start, this.position);

    const brace_start = this.position;
    const brace_end = find_matching_bracket(this.input, brace_start);
    if (brace_end === -1) {
      throw new JQHTMLParseError(
        `Unterminated dynamic component tag: <${closing ? '/' : ''}{ has no matching }`,
        start_line,
        start_column,
        this.input,
        this.filename
      );
    }
    this.advance(); // {
    const expr_start = this.position;
    while (this.position < brace_end) this.advance();
    const expression = this.input.substring(expr_start, this.position);
    this.advance(); // }
    this.add_token(TokenType.DYNAMIC_TAG_NAME, expression, brace_start, this.position);

    if (closing) {
      this.skip_whitespace();
      if (this.current_char() === '>') {
        const gt_start = this.position;
        this.advance();
        this.add_token(TokenType.GT, '>', gt_start, this.position);
      }
    } else {
      this.scan_attributes();
    }
  }

  private last_token_type(): TokenType | undefined {
    return this.tokens.length > 0 ? this.tokens[this.tokens.length - 1].type : undefined;
  }

  /**
   * Scan the body of a raw-text element as literal text, stopping at its closing tag.
   *
   * Markup inside is emitted as TEXT rather than tags, so <pre><code>..</code></pre>
   * round-trips exactly as written. JQHTML delimiters are still honoured, so
   * <%= %> interpolation keeps working; the search for the closing tag skips those
   * regions, so an expression may contain the literal string "</pre>".
   *
   * NEWLINE tokens are emitted as usual: codegen is line-based, and swallowing them
   * here would desynchronise every downstream line number, including sourcemaps.
   */
  private scan_raw_text_element(tag_name: string) {
    const close_seq = '</' + tag_name;
    let text = '';
    let text_start = this.position;

    const flush = () => {
      if (text.length > 0) {
        this.add_token(TokenType.TEXT, text, text_start, this.position);
        text = '';
      }
      text_start = this.position;
    };

    while (this.position < this.input.length) {
      // Closing tag (case-insensitive, tolerating </pre  >)
      if (this.current_char() === '<' &&
          this.input.substr(this.position, close_seq.length).toLowerCase() === close_seq) {
        const after = this.input.substr(this.position + close_seq.length).match(/^\s*>/);
        if (after) {
          flush();
          return; // leave </pre> for the normal scanner
        }
      }

      // JQHTML delimiters still apply inside raw text. scan_expression() and
      // scan_code_block() stop at the closing %> without consuming it - in normal
      // scanning the main loop emits that token, so emit it here too.
      const consume_tag_end = () => {
        if (this.current_char() === '%' && this.peek_ahead(1) === '>') {
          const tag_end_start = this.position;
          this.advance();
          this.advance();
          this.add_token(TokenType.TAG_END, '%>', tag_end_start, this.position);
        }
      };

      const start = this.position;
      if (this.match_sequence('<%!=')) {
        flush();
        this.add_token(TokenType.EXPRESSION_UNESCAPED, '<%!=', start, this.position);
        this.scan_expression();
        consume_tag_end();
        text_start = this.position;
        continue;
      }
      if (this.match_sequence('<%br=')) {
        flush();
        this.add_token(TokenType.EXPRESSION_BR, '<%br=', start, this.position);
        this.scan_expression();
        consume_tag_end();
        text_start = this.position;
        continue;
      }
      if (this.match_sequence('<%=')) {
        flush();
        this.add_token(TokenType.EXPRESSION_START, '<%=', start, this.position);
        this.scan_expression();
        consume_tag_end();
        text_start = this.position;
        continue;
      }
      if (this.match_sequence('<%')) {
        flush();
        this.add_token(TokenType.CODE_START, '<%', start, this.position);
        this.scan_code_block();
        consume_tag_end();
        text_start = this.position;
        continue;
      }

      // Newlines stay their own tokens so line accounting survives
      if (this.current_char() === '\n') {
        flush();
        const nl_start = this.position;
        this.advance();
        this.add_token(TokenType.NEWLINE, '\n', nl_start, this.position);
        text_start = this.position;
        continue;
      }

      text += this.current_char();
      this.advance();
    }

    flush(); // unterminated <pre>: hand what we have to the parser
  }

  private scan_closing_tag() {
    const start = this.position;
    this.advance(); // consume <
    this.advance(); // consume /
    this.add_token(TokenType.TAG_CLOSE, '</', start, this.position);
    
    // Scan tag name
    const name_start = this.position;
    let name = '';
    
    while (this.position < this.input.length && 
           this.is_tag_name_continue_char(this.current_char())) {
      name += this.current_char();
      this.advance();
    }
    
    if (name.length > 0) {
      this.add_token(TokenType.TAG_NAME, name, name_start, this.position);
    }
    
    // Skip whitespace
    this.skip_whitespace();
    
    // Expect >
    if (this.current_char() === '>') {
      const gt_start = this.position;
      this.advance();
      this.add_token(TokenType.GT, '>', gt_start, this.position);
    }
  }
  
  private scan_attributes() {
    while (this.position < this.input.length) {
      this.skip_whitespace();

      // Also skip newlines in attribute area
      while (this.current_char() === '\n' || this.current_char() === '\r') {
        if (this.current_char() === '\n') {
          this.add_token(TokenType.NEWLINE, '\n', this.position, this.position + 1);
        }
        this.advance();
        this.skip_whitespace();
      }

      const char = this.current_char();

      // Check for />
      if (char === '/' && this.peek_ahead(1) === '>') {
        const slash_start = this.position;
        this.advance(); // consume /
        this.advance(); // consume >
        this.add_token(TokenType.SELF_CLOSING, '/>', slash_start, this.position);
        return;
      }

      // Check for >
      if (char === '>') {
        const gt_start = this.position;
        this.advance();
        this.add_token(TokenType.GT, '>', gt_start, this.position);
        return;
      }

      // Check for <% (conditional attribute start)
      if (char === '<' && this.peek_ahead(1) === '%') {
        const start = this.position;
        this.advance(); // <
        this.advance(); // %
        this.add_token(TokenType.CODE_START, '<%', start, this.position);
        this.scan_code_block();

        // Consume the %> that scan_code_block left behind
        if (this.current_char() === '%' && this.peek_ahead(1) === '>') {
          const tag_end_start = this.position;
          this.advance(); // %
          this.advance(); // >
          this.add_token(TokenType.TAG_END, '%>', tag_end_start, this.position);
        }

        // Continue scanning attributes - DO NOT return
        continue;
      }

      // Must be an attribute
      if (this.is_attribute_start_char(char)) {
        this.scan_attribute();
      } else {
        break;
      }
    }
  }
  
  private is_attribute_start_char(char: string): boolean {
    if (!char) return false;
    return this.is_tag_name_char(char) || char === '$' || char === ':' || char === '@';
  }
  
  
  /**
   * Characters HTML does not allow in an attribute name: whitespace, quotes, `<`,
   * `/`, and control characters (`=` and `>` end the name before this is asked).
   * An attribute name is emitted into the compiled module as an object key, so a
   * quote in one is not just invalid HTML - it is the end of a JS string literal.
   * Everything templates legitimately use stays allowed: `:` `.` `-` `_` `@` `$`
   * and digits (x-on:click, :class, @click.prevent, aria-label, data-foo.bar).
   */
  private static is_forbidden_attribute_name_char(char: string): boolean {
    const code = char.charCodeAt(0);
    return char === '"' || char === "'" || char === '<' || char === '/' ||
           code <= 0x20 || (code >= 0x7f && code <= 0x9f);
  }

  private throw_invalid_attribute_name(name_so_far: string, char: string): never {
    const code = char.charCodeAt(0);
    const shown = (code < 0x20 || (code >= 0x7f && code <= 0x9f))
      ? `U+${code.toString(16).toUpperCase().padStart(4, '0')}`
      : `'${char}'`;
    const error = new JQHTMLParseError(
      `Invalid character ${shown} in attribute name, after "${name_so_far}"`,
      this.line,
      this.column,
      this.input,
      this.filename
    );
    error.suggestion = `\n\nAttribute names cannot contain whitespace, quotes ("), apostrophes ('),\n` +
      `"<", "/", "=", ">" or control characters.\n\n` +
      `Names such as x-on:click, :class, @click.prevent, aria-label and data-foo.bar are fine.\n` +
      `A quote here usually means a missing "=" or a stray quote earlier in the tag.`;
    throw error;
  }

  private scan_attribute() {
    const start = this.position;
    let name = '';
    
    // Scan attribute name
    while (this.position < this.input.length) {
      const char = this.current_char();
      if (char === '=' || char === ' ' || char === '\t' ||
          char === '\n' || char === '\r' || char === '>' ||
          (char === '/' && this.peek_ahead(1) === '>') ||
          (char === '<' && this.peek_ahead(1) === '%')) {
        break;
      }
      if (Lexer.is_forbidden_attribute_name_char(char)) {
        this.throw_invalid_attribute_name(name, char);
      }
      name += char;
      this.advance();
    }
    
    if (name.length > 0) {
      this.add_token(TokenType.ATTR_NAME, name, start, this.position);
    }
    
    this.skip_whitespace();
    
    // Check for = and value
    if (this.current_char() === '=') {
      const eq_start = this.position;
      this.advance();
      this.add_token(TokenType.EQUALS, '=', eq_start, this.position);
      
      this.skip_whitespace();
      
      // Scan attribute value
      this.scan_attribute_value();
    }
  }
  
  private scan_attribute_value() {
    const char = this.current_char();

    // Check for common mistake: attr=<%= instead of attr="<%=
    if (char === '<' && this.peek_ahead(1) === '%') {
      const attr_context = this.get_current_attribute_context(); // Returns "attrname="
      const is_dollar_attr = attr_context.startsWith('$');

      const error = new JQHTMLParseError(
        `Attribute value cannot be assigned directly to <%= %> interpolation block.\n` +
        `  Attribute: ${attr_context}<%`,
        this.line,
        this.column,
        this.input,
        this.filename
      );

      if (is_dollar_attr) {
        error.suggestion = `\n\n$ attributes take JavaScript directly - no <%= %> needed:\n\n` +
          `   ✗ Wrong:   ${attr_context}<%= JSON.stringify(data) %>\n` +
          `   ✓ Correct: ${attr_context}(JSON.stringify(data))\n` +
          `   ✓ Correct: ${attr_context}this.data.options\n\n` +
          `A bracketed value, ${attr_context}( ... ), may contain spaces and span lines.\n` +
          `Quoted interpolation, ${attr_context}"<%= value %>", also works, but always gives a\n` +
          `string and must stay on one line.`;
      } else {
        error.suggestion = `\n\nRegular attributes must use quoted values:\n\n` +
          `   ✗ Wrong:   ${attr_context}<%= value %>\n` +
          `   ✓ Correct: ${attr_context}"<%= value %>"\n` +
          `   ✓ Correct: ${attr_context}"static text"\n\n` +
          `Always wrap attribute values in quotes.`;
      }

      throw error;
    }

    if (char === '"' || char === "'") {
      // Check if this is an @ event attribute - they MUST be unquoted
      const attr_context = this.get_current_attribute_context();
      if (attr_context.startsWith('@')) {
        const error = new JQHTMLParseError(
          `Event attributes (@) must have unquoted values to pass function references.\n` +
          `  Attribute: ${attr_context}=`,
          this.line,
          this.column,
          this.input,
          this.filename
        );
        error.suggestion = `\n\nEvent attributes must be unquoted:\n` +
          `  ✗ Wrong:   @click="handleClick"     (passes string, not function)\n` +
          `  ✓ Correct: @click=handleClick       (passes function reference)\n` +
          `  ✓ Correct: @click=this.handleClick  (passes method reference)\n\n` +
          `Quoted values only pass strings and cannot pass functions or callbacks.\n` +
          `In the component scope, 'this' refers to the component instance.`;
        throw error;
      }

      // Quoted value - check for interpolation
      const quote = char;
      this.advance(); // consume opening quote

      // Check if value contains <% (lookahead only - the position is not moved)
      if (this.value_contains_interpolation(quote)) {
        this.scan_interpolated_attribute_value(quote);
      } else {
        // Simple value without interpolation
        const value_start = this.position - 1; // Include opening quote
        let value = quote; // Start with the quote

        while (this.position < this.input.length && this.current_char() !== quote) {
          value += this.current_char();
          this.advance();
        }

        if (this.current_char() === quote) {
          value += quote; // Add closing quote
          this.advance(); // consume closing quote
        }

        if (value.length > 2 || value === '""' || value === "''") {
          this.add_token(TokenType.ATTR_VALUE, value, value_start, this.position);
        }
      }
    } else if (char === '(') {
      // Parenthesized expression: $attr=(condition ? 'online' : 'offline')
      // Runs to the matching ) (shared JS scanner), or to the end of input if none
      const attr_context = this.get_current_attribute_context();
      if (!attr_context.startsWith('@') && !attr_context.startsWith('$')) {
        this.throw_unquoted_regular_attribute(attr_context, '(expression)');
      }
      const value_start = this.position;
      const close = find_matching_bracket(this.input, value_start);
      const value_end = close === -1 ? this.input.length : close + 1;
      const value = this.input.substring(value_start, value_end);
      while (this.position < value_end) this.advance();

      if (value.length > 0) {
        this.add_token(TokenType.ATTR_VALUE, value, value_start, this.position);
      }
    } else {
      // Unquoted value - JavaScript identifier or member expression
      // Valid chars: alphanumeric, underscore, period, dollar sign
      // Can be prefixed with ! for negation
      // Examples: myVar, this.method, obj.prop.subprop, $element, !this.canEdit
      //
      // RULES:
      // - @ event attributes: MUST be unquoted (to pass functions)
      // - $ attributes: Can be quoted (string) or unquoted (any JS value)
      // - Regular attributes: MUST be quoted (strings only)

      // Check attribute type
      const attr_context = this.get_current_attribute_context();
      const is_event_attr = attr_context.startsWith('@');
      const is_dollar_attr = attr_context.startsWith('$');

      // Regular attributes (not @ or $) must be quoted
      if (!is_event_attr && !is_dollar_attr) {
        this.throw_unquoted_regular_attribute(attr_context, 'myValue');
      }

      const value_start = this.position;
      let value = '';
      let isFirstChar = true;

      while (this.position < this.input.length) {
        const ch = this.current_char();

        // Allow ! only as the first character (negation operator)
        if (isFirstChar && ch === '!') {
          value += ch;
          this.advance();
          isFirstChar = false;
          continue;
        }

        // Allow - as the first character (for negative numbers)
        if (isFirstChar && ch === '-') {
          value += ch;
          this.advance();
          isFirstChar = false;
          continue;
        }
        isFirstChar = false;

        // Check if character is valid for JavaScript identifier/member expression/function call
        const isValidChar = (ch >= 'a' && ch <= 'z') ||
                          (ch >= 'A' && ch <= 'Z') ||
                          (ch >= '0' && ch <= '9') ||
                          ch === '_' ||
                          ch === '.' ||
                          ch === '$' ||
                          ch === '(' ||  // Allow parentheses for function calls
                          ch === ')' ||
                          ch === ',' ||  // Allow commas in function arguments
                          ch === '"' ||  // Allow quoted strings in function arguments
                          ch === "'";    // Allow quoted strings in function arguments

        if (!isValidChar) {
          // Stop at first non-valid character
          break;
        }

        value += ch;
        this.advance();
      }

      if (value.length > 0) {
        // Validate the pattern before accepting it
        this.validate_unquoted_value(value, attr_context);
        this.add_token(TokenType.ATTR_VALUE, value, value_start, this.position);
      }
    }
  }

  private validate_unquoted_value(value: string, attr_context: string) {
    // Allowed patterns:
    // 1. Literals: true, false, null, undefined, 123, 45.67
    // 2. Identifiers: myVar, $variable, _private
    // 3. Property chains: obj.prop, MyClass.method, deep.nested.property
    // 4. Function calls: func(), obj.method(), func(arg1, arg2)
    // 5. Chains with calls: obj.method().property.another()
    //
    // NOT allowed:
    // - Operators: +, -, *, /, %, =, ==, ===, &&, ||, etc.
    // - Objects: {key: value}
    // - Arrays: [1, 2, 3]
    // - Ternary: condition ? a : b

    // Check for disallowed operators
    // Allow - at the start for negative numbers (e.g., -1, -45.67)
    const valueForOperatorCheck = value.startsWith('-') ? value.slice(1) : value;
    if (/[+\-*/%=<>!&|^~?:]/.test(valueForOperatorCheck)) {
      const error = new JQHTMLParseError(
        `Operators are not allowed in unquoted $ attribute values.\n` +
        `  Found: ${attr_context}${value}`,
        this.line,
        this.column,
        this.input,
        this.filename
      );
      error.suggestion = `\n\nUnquoted $ attribute values must be simple references or function calls:\n\n` +
        `✓ Allowed patterns:\n` +
        `  - Literals:         $count=42  or  $active=true  or  $offset=-1\n` +
        `  - Variables:        $data=myVariable\n` +
        `  - Property access:  $handler=Controller.method\n` +
        `  - Function calls:   $value=getData()\n` +
        `  - Complex chains:   $fetch=API.users.getAll()\n\n` +
        `✗ Not allowed:\n` +
        `  - Operators:        $value=a+b  (use quoted string or component logic)\n` +
        `  - Ternary:          $class=active?'on':'off'  (use quoted string)\n` +
        `  - Comparisons:      $show=count>5  (handle in component logic)\n\n` +
        `If you need complex expressions, handle them in the component's on_load() or on_ready() method.`;
      throw error;
    }

    // Check for object literals
    if (value.trim().startsWith('{')) {
      const error = new JQHTMLParseError(
        `Object literals are not allowed in unquoted $ attribute values.\n` +
        `  Found: ${attr_context}${value}`,
        this.line,
        this.column,
        this.input,
        this.filename
      );
      error.suggestion = `\n\nUnquoted $ attribute values cannot contain object literals.\n\n` +
        `If you need to pass an object, create it in the component:\n` +
        `  ✗ Wrong:   $config={key:"value"}\n` +
        `  ✓ Correct: In component: this.data.config = {key: "value"}\n` +
        `            In template:  $config=this.data.config`;
      throw error;
    }

    // Check for array literals
    if (value.trim().startsWith('[')) {
      const error = new JQHTMLParseError(
        `Array literals are not allowed in unquoted $ attribute values.\n` +
        `  Found: ${attr_context}${value}`,
        this.line,
        this.column,
        this.input,
        this.filename
      );
      error.suggestion = `\n\nUnquoted $ attribute values cannot contain array literals.\n\n` +
        `If you need to pass an array, create it in the component:\n` +
        `  ✗ Wrong:   $items=[1,2,3]\n` +
        `  ✓ Correct: In component: this.data.items = [1, 2, 3]\n` +
        `            In template:  $items=this.data.items`;
      throw error;
    }

    // Validate that parentheses are balanced
    let parenDepth = 0;
    let inString = false;
    let stringChar = '';

    for (let i = 0; i < value.length; i++) {
      const ch = value[i];

      // Track string boundaries
      if ((ch === '"' || ch === "'") && !inString) {
        inString = true;
        stringChar = ch;
      } else if (ch === stringChar && inString) {
        inString = false;
        stringChar = '';
      }

      // Only count parentheses outside strings
      if (!inString) {
        if (ch === '(') parenDepth++;
        if (ch === ')') parenDepth--;

        if (parenDepth < 0) {
          const error = new JQHTMLParseError(
            `Unmatched closing parenthesis in unquoted $ attribute value.\n` +
            `  Found: ${attr_context}${value}`,
            this.line,
            this.column,
            this.input,
            this.filename
          );
          error.suggestion = `\n\nCheck for mismatched parentheses in the attribute value.`;
          throw error;
        }
      }
    }

    if (parenDepth !== 0) {
      const error = new JQHTMLParseError(
        `Unmatched opening parenthesis in unquoted $ attribute value.\n` +
        `  Found: ${attr_context}${value}`,
        this.line,
        this.column,
        this.input,
        this.filename
      );
      error.suggestion = `\n\nCheck for mismatched parentheses in the attribute value.`;
      throw error;
    }

    // Validate the overall pattern using regex
    // Pattern: identifier(.identifier)*(( args? ))*
    // This allows: var, obj.prop, func(), obj.method(arg1, arg2).chain().more
    // Also allows negative numbers: -1, -45.67
    const pattern = /^!?[a-zA-Z_$][a-zA-Z0-9_$]*(\.[a-zA-Z_$][a-zA-Z0-9_$]*|\([^)]*\))*$|^(true|false|null|undefined|-?\d+(\.\d+)?)$/;

    if (!pattern.test(value)) {
      const error = new JQHTMLParseError(
        `Invalid syntax in unquoted $ attribute value.\n` +
        `  Found: ${attr_context}${value}`,
        this.line,
        this.column,
        this.input,
        this.filename
      );
      error.suggestion = `\n\nUnquoted $ attribute values must follow these patterns:\n\n` +
        `✓ Allowed:\n` +
        `  - Number literals:  42, 3.14, -1, -45.67\n` +
        `  - Boolean literals: true, false\n` +
        `  - Null/undefined:   null, undefined\n` +
        `  - Identifiers:      myVar, _private, $jQuery\n` +
        `  - Property chains:  Controller.method, obj.deep.property\n` +
        `  - Function calls:   getData(), API.fetch("url")\n` +
        `  - Mixed chains:     obj.method().property.call()\n\n` +
        `✗ Not allowed:\n` +
        `  - Spaces in names\n` +
        `  - Complex expressions with operators\n` +
        `  - Object or array literals\n\n` +
        `The value should be a simple reference to data, not complex logic.`;
      throw error;
    }
  }
  
  /** The rule for plain attributes: a value must be quoted, on every tag, <Define:> included.
   *  Only @ attributes (unquoted) and $ attributes (either) take a JavaScript value. */
  private throw_unquoted_regular_attribute(attr_context: string, example: string): never {
    const error = new JQHTMLParseError(
      `Regular HTML attributes must have quoted values.\n` +
      `  Attribute: ${attr_context}`,
      this.line,
      this.column,
      this.input,
      this.filename
    );
    error.suggestion = `\n\nRegular attributes must be quoted:\n` +
      `  ✗ Wrong:   ${attr_context}${example}\n` +
      `  ✓ Correct: ${attr_context}"myValue"\n` +
      `  ✓ Correct: ${attr_context}"prefix <%= this.data.value %> suffix"\n\n` +
      `Only @ event attributes (unquoted) and $ attributes (either) allow unquoted values:\n` +
      `  ✓ Correct: @click=this.handleClick  (passes function reference)\n` +
      `  ✓ Correct: $data=this.complexObject (passes object)\n` +
      `  ✓ Correct: $sid="my-id"              (passes string)`;
    throw error;
  }

  private get_current_attribute_context(): string {
    // Look back in tokens to find the current attribute name for error reporting
    let i = this.tokens.length - 1;
    while (i >= 0) {
      const token = this.tokens[i];
      if (token.type === TokenType.ATTR_NAME) {
        // The @ or $ is already part of the attribute name
        return token.value + '=';
      }
      // Stop if we hit a tag boundary
      if (token.type === TokenType.TAG_OPEN || token.type === TokenType.TAG_CLOSE) {
        break;
      }
      i--;
    }
    return '';
  }

  private value_contains_interpolation(quote: string): boolean {
    // Look ahead to see if this quoted value contains <%= or <%!=
    let pos = this.position;
    while (pos < this.input.length && this.input[pos] !== quote) {
      if (pos + 2 < this.input.length && 
          this.input[pos] === '<' && 
          this.input[pos + 1] === '%') {
        return true;
      }
      pos++;
    }
    return false;
  }
  
  private scan_interpolated_attribute_value(quote: string) {
    let text_start = this.position;
    let text = '';

    // Literal text between interpolations: always text, never re-classified
    const flush_text = () => {
      if (text.length > 0) {
        this.add_token(TokenType.ATTR_VALUE, text, text_start, this.position, { interpolation_text: true });
        text = '';
      }
    };

    while (this.position < this.input.length && this.current_char() !== quote) {
      // Check for interpolation start
      if (this.current_char() === '<' && this.peek_ahead(1) === '%') {
        // Save any text before the interpolation
        flush_text();
        const tag_start = this.position;
        const tag_line = this.line;
        const tag_column = this.column;

        // Check what kind of expression
        if (this.peek_ahead(2) === '!' && this.peek_ahead(3) === '=') {
          // <%!= expression %>
          this.advance(); // <
          this.advance(); // %
          this.advance(); // !
          this.advance(); // =
          this.add_token(TokenType.EXPRESSION_UNESCAPED, '<%!=', tag_start, this.position);
        } else if (this.peek_ahead(2) === '=') {
          // <%= expression %>
          this.advance(); // <
          this.advance(); // %
          this.advance(); // =
          this.add_token(TokenType.EXPRESSION_START, '<%=', tag_start, this.position);
        } else if (this.peek_sequence('<%br=')) {
          throw this.attribute_nl2br_error();
        } else if (
          this.peek_ahead(2) === ' ' || this.peek_ahead(2) === '\t' ||
          this.peek_ahead(2) === '\n' || this.peek_ahead(2) === '\r'
        ) {
          // <% ... %> code block (statement, e.g. <% if (x) { %>) inside an
          // attribute value. Code blocks are never evaluated here - they would
          // be silently treated as literal text - so reject with guidance.
          throw this.attribute_code_block_error();
        } else {
          // Any other <% form (<%-, <%x, a bare <%) is not a template tag JQHTML
          // knows; emitting it as literal text would hide the mistake.
          throw this.attribute_unknown_tag_error();
        }

        // Scan the JavaScript expression
        const expression_start = this.position;
        this.in_attribute_value = true;
        try {
          this.scan_javascript();
        } finally {
          this.in_attribute_value = false;
        }
        
        // Consume %>
        if (this.current_char() === '%' && this.peek_ahead(1) === '>') {
          // An expression in an attribute value stays on one line. (Without a %>
          // the parser reports the unterminated expression instead.)
          if (this.input.substring(expression_start, this.position).includes('\n')) {
            throw this.attribute_multiline_expression_error(
              this.input.substring(tag_start, expression_start), tag_line, tag_column);
          }
          const tag_end_start = this.position;
          this.advance(); // %
          this.advance(); // >
          this.add_token(TokenType.TAG_END, '%>', tag_end_start, this.position);
        }
        
        // Reset text tracking
        text_start = this.position;
      } else {
        text += this.current_char();
        this.advance();
      }
    }
    
    // Add any remaining text
    flush_text();
    
    // Consume closing quote
    if (this.current_char() === quote) {
      this.advance();
    }
  }

  private attribute_nl2br_error(): JQHTMLParseError {
    const attr_context = this.get_current_attribute_context(); // e.g. "title="
    const error = new JQHTMLParseError(
      `<%br= is not allowed in attribute values; use <%= %>\n` +
      `  Attribute: ${attr_context}"<%br= ...`,
      this.line,
      this.column,
      this.input,
      this.filename
    );
    error.suggestion = `\n\n<%br= converts newlines to <br /> elements, which cannot exist inside an\n` +
      `attribute value. Use an escaped expression instead:\n` +
      `  ✗ Wrong:   title="<%br= this.data.text %>"\n` +
      `  ✓ Correct: title="<%= this.data.text %>"`;
    return error;
  }

  private attribute_multiline_expression_error(open: string, line: number, column: number): JQHTMLParseError {
    const attr_context = this.get_current_attribute_context(); // e.g. "title="
    const error = new JQHTMLParseError(
      `A ${open} %> expression in an attribute value must be on one line\n` +
      `  Attribute: ${attr_context}"...${open} ...`,
      line,
      column,
      this.input,
      this.filename
    );
    if (attr_context.startsWith('$')) {
      // A $ arg takes JavaScript directly: the bracketed form may span lines and
      // gives the same value.
      const name = attr_context.replace(/=$/, '');
      error.suggestion = `\n\nA $ attribute takes JavaScript directly. Use the bracketed form, which may\n` +
        `span lines:\n` +
        `  ✗ Wrong:   ${name}="<%= JSON.stringify([\n` +
        `               {value: 1, label: 'One'},\n` +
        `             ]) %>"\n` +
        `  ✓ Correct: ${name}=(JSON.stringify([\n` +
        `               {value: 1, label: 'One'},\n` +
        `             ]))`;
    } else {
      error.suggestion = `\n\nPut the whole expression, including its %>, on the line where it opens. For a\n` +
        `longer value, compute it first in a <% %> block:\n` +
        `  ✗ Wrong:   title="<%= this.data.first +\n` +
        `                      this.data.last %>"\n` +
        `  ✓ Correct: <% const full_name = this.data.first + this.data.last; %>\n` +
        `             <b title="<%= full_name %>">`;
    }
    error.suggestion += `\n\nA // comment runs to the end of its line, so it hides a %> written after it on\n` +
      `the same line; inside an attribute value use /* */ instead.`;
    return error;
  }

  private attribute_unknown_tag_error(): JQHTMLParseError {
    const attr_context = this.get_current_attribute_context(); // e.g. "title="
    const next = this.peek_ahead(2);
    const form = next && next !== '"' && next !== "'" ? `<%${next}` : '<%';
    const error = new JQHTMLParseError(
      `Unknown template tag ${form} in attribute value; only <%= %> and <%!= %> are allowed in attribute values\n` +
      `  Attribute: ${attr_context}"...${form}`,
      this.line,
      this.column,
      this.input,
      this.filename
    );
    error.suggestion = `\n\nInside an attribute value, <% starts a template tag. The forms allowed there are\n` +
      `<%= expr %> (escaped) and <%!= expr %> (unescaped). To put the literal text "<%" in\n` +
      `an attribute, output it from an expression: title="<%= '<' + '%' %>"`;
    return error;
  }

  private attribute_code_block_error(): JQHTMLParseError {
    const attr_context = this.get_current_attribute_context(); // e.g. "style="
    const error = new JQHTMLParseError(
      `<% %> code blocks are not allowed inside attribute values.\n` +
      `  Attribute: ${attr_context}"<% ...`,
      this.line,
      this.column,
      this.input,
      this.filename
    );
    error.suggestion = `\n\nA <% %> code block (statement) is never evaluated inside an attribute value.\n` +
      `Use a <%= %> expression instead - expressions DO work inside attributes.\n\n` +
      `If you were writing a conditional, use a ternary expression:\n` +
      `  ✗ Wrong:   style="<% if (_hours_based) { %>display: none;<% } %>"\n` +
      `  ✓ Correct: style="<%= _hours_based ? 'display: none;' : '' %>"\n\n` +
      `General form:\n` +
      `  ✗ Wrong:   attr="<% if (cond) { %>val1<% } else { %>val2<% } %>"\n` +
      `  ✓ Correct: attr="<%= cond ? 'val1' : 'val2' %>"`;
    return error;
  }
}