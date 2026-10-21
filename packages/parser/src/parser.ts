// JQHTML Parser - Builds AST from tokens
// Simple recursive descent parser, no complex libraries

import { Token, TokenType, SourceLocation } from './lexer.js';
import {
  NodeType,
  ASTNode,
  ProgramNode,
  ComponentDefinitionNode,
  TextNode,
  ExpressionNode,
  IfStatementNode,
  ForStatementNode,
  CodeBlockNode,
  SlotNode,
  ConditionalAttributeNode,
  CodeLocation,
  createNode
} from './ast.js';
import {
  JQHTMLParseError,
  unclosedError,
  mismatchedTagError,
  syntaxError
} from './errors.js';
import { CodeGenerator, VOID_ELEMENTS } from './codegen.js';
import { COMPONENT_NAME_RULE, is_component_name } from './component-name.js';
import { join_lines, join_lines_mapped } from './js_scanner.js';
import { decode_attribute_text } from './html_attribute.js';

/** Only HTML whitespace (space, tab, LF, CR, FF). String.trim() also strips U+00A0,
 *  which is content: an author's non-breaking space. */
function is_html_whitespace(text: string): boolean {
  return /^[ \t\n\r\f]*$/.test(text);
}

export class Parser {
  private tokens: Token[];
  private current: number = 0;
  private source?: string;
  private filename?: string;
  // Paired tags and slots currently being parsed, innermost last; names the
  // open element when a closing tag does not match it.
  private open_elements: Array<{ name: string, kind: 'tag' | 'component' | 'slot', token: Token }> = [];
  private define_name: string | null = null;

  constructor(tokens: Token[], source?: string, filename?: string) {
    this.tokens = tokens;
    this.source = source;
    this.filename = filename;
  }

  /**
   * Validate JavaScript code for common mistakes
   */
  private validate_javascript_code(code: string, token: Token): void {
    // Check for this.innerHTML usage (should use content() function instead)
    const match = /\bthis\.innerHTML\b/.exec(code);
    if (match) {
      // Point at the match: the token starts at the whitespace after <%=
      const before = code.slice(0, match.index);
      const newline = before.lastIndexOf('\n');
      const error = new JQHTMLParseError(
        `Invalid usage: this.innerHTML is not available in JQHTML templates.\n` +
        `Did you mean to use the content() function instead?`,
        token.line + (before.match(/\n/g) || []).length,
        newline === -1 ? token.column + match.index : match.index - newline,
        this.source,
        this.filename
      );
      error.suggestion =
        `\nJQHTML uses content() to render child elements, not this.innerHTML:\n\n` +
        `  ❌ Wrong:   <%= this.innerHTML %>\n` +
        `  ✓ Correct: <%= content() %>\n\n` +
        `  ❌ Wrong:   <% if (condition) { %> this.innerHTML <% } %>\n` +
        `  ✓ Correct: <% if (condition) { %> <%= content() %> <% } %>\n\n` +
        `Why content() instead of this.innerHTML?\n` +
        `- content() is a function that returns the rendered child content\n` +
        `- this.innerHTML is a DOM property, not available during template compilation\n` +
        `- content() supports named slots: content('slot_name')\n` +
        `- content() can pass data: content('row', rowData)`;
      throw error;
    }
  }

  // Main entry point - parse tokens into AST
  parse(): ProgramNode {
    const body: ASTNode[] = [];
    const start = this.current_token();
    
    // Skip leading whitespace and newlines
    while (!this.is_at_end() && (
      this.match(TokenType.NEWLINE) ||
      (this.match(TokenType.TEXT) && is_html_whitespace(this.previous_token().value))
    )) {
      // Skip whitespace
    }
    
    // Check if file is empty (only whitespace)
    if (this.is_at_end()) {
      // Empty file is allowed
      return createNode(
        NodeType.PROGRAM,
        { body: [] },
        start.start,
        start.end,
        start.line,
        start.column,
        this.create_location(start, start)
      );
    }
    
    // Must have exactly one Define tag at top level
    if (!this.check(TokenType.DEFINE_START)) {
      const token = this.current_token();
      throw syntaxError(
        'JQHTML files must have exactly one top-level <Define:ComponentName> tag',
        token.line,
        token.column,
        this.source,
        this.filename
      );
    }
    
    // Parse the single component definition
    const component = this.parse_component_definition();
    if (component) {
      body.push(component);
    }
    
    // Skip trailing whitespace and newlines
    while (!this.is_at_end() && (this.match(TokenType.NEWLINE) || this.match(TokenType.TEXT) && is_html_whitespace(this.previous_token().value))) {
      // Skip whitespace
    }
    
    // Ensure no other content after the Define tag
    if (!this.is_at_end()) {
      const token = this.current_token();
      throw syntaxError(
        'JQHTML files must have exactly one top-level <Define:ComponentName> tag. Found additional content after the component definition.',
        token.line,
        token.column,
        this.source,
        this.filename
      );
    }
    
    const end = this.previous_token();
    return createNode(
      NodeType.PROGRAM,
      { body },
      start.start,
      end.end,
      start.line,
      start.column,
      this.create_location(start, end)
    );
  }
  
  // Parse <Define:ComponentName>...</Define:ComponentName>
  private parse_component_definition(): ComponentDefinitionNode {
    const start_token = this.consume(TokenType.DEFINE_START, 'Expected <Define:');
    const name_token = this.consume(TokenType.COMPONENT_NAME, 'Expected component name');
    this.define_name = name_token.value;

    // Validate component name against the shared rule
    if (!is_component_name(name_token.value)) {
      throw syntaxError(
        `Component name '${name_token.value}' ${COMPONENT_NAME_RULE}. Convention is First_Letter_With_Underscores.`,
        name_token.line,
        name_token.column,
        this.source,
        this.filename
      );
    }
    
    // Parse attributes (like tag="span", class="card", extends="Parent", $prop=value)
    const attributes: Record<string, any> = {};
    const defineArgs: Record<string, any> = {};  // $ attributes (raw JS, not data- attributes)
    let extendsValue: string | undefined;

    // Skip any leading newlines before attributes
    while (this.match(TokenType.NEWLINE)) {
      // Skip
    }

    while (!this.check(TokenType.GT) && !this.is_at_end()) {
      const attr_name = this.consume(TokenType.ATTR_NAME, 'Expected attribute name');

      // Validate that $sid is not used in Define tags
      if (attr_name.value === '$sid') {
        throw syntaxError(
          '$sid is not allowed in <Define:> tags. Component definitions cannot have scoped IDs.',
          attr_name.line,
          attr_name.column,
          this.source,
          this.filename
        );
      }

      this.consume(TokenType.EQUALS, 'Expected =');
      const attr_value = this.parse_attribute_value();

      // Check if attribute value contains template expressions (dynamic content)
      // Define tag attributes must be static - they're part of the template definition, not runtime values
      const hasInterpolation = attr_value &&
                                typeof attr_value === 'object' &&
                                (attr_value.interpolated === true ||
                                 (attr_value.parts && attr_value.parts.some((p: any) => p.type === 'expression')));

      if (hasInterpolation) {
        // Special error message for class attribute - most common case
        if (attr_name.value === 'class') {
          const error = syntaxError(
            `Template expressions cannot be used in <Define:> tag attributes. The <Define> tag is a static template definition, not a live component instance.`,
            attr_name.line,
            attr_name.column,
            this.source,
            this.filename
          );
          error.message += '\n\n' +
            '  For dynamic classes, set the class attribute on the component invocation instead:\n' +
            '    ❌ <Define:MyComponent class="<%= this.args.col_class || \'default\' %>">\n' +
            '    ✅ <Define:MyComponent class="static-class">\n' +
            '       ...\n' +
            '       </Define:MyComponent>\n\n' +
            '  Then when using the component:\n' +
            '    <MyComponent class="col-md-8 col-xl-4" />\n\n' +
            '  Or set attributes dynamically in on_create() or on_ready():\n' +
            '    on_ready() {\n' +
            '      const classes = this.args.col_class || \'col-12 col-md-6\';\n' +
            '      this.$.addClass(classes);\n' +
            '    }';
          throw error;
        } else {
          // General error for other attributes
          const error = syntaxError(
            `Template expressions cannot be used in <Define:> tag attributes. The <Define> tag is a static template definition, not a live component instance.`,
            attr_name.line,
            attr_name.column,
            this.source,
            this.filename
          );
          error.message += '\n\n' +
            `  For dynamic "${attr_name.value}" attribute values, set them dynamically in lifecycle methods:\n` +
            '    ❌ <Define:MyComponent ' + attr_name.value + '="<%= expression %>">\n' +
            '    ✅ <Define:MyComponent>\n' +
            '       ...\n' +
            '       </Define:MyComponent>\n\n' +
            '  Then in your component class:\n' +
            '    on_create() {\n' +
            `      this.$.attr('${attr_name.value}', this.args.some_value);\n` +
            '    }\n\n' +
            '  Or use on_ready() for attributes that need DOM to be fully initialized.';
          throw error;
        }
      }

      // Handle special attributes on Define tags
      if (attr_name.value === 'extends') {
        // extends="ParentComponent" - explicit template inheritance
        if (typeof attr_value === 'object' && attr_value.quoted) {
          extendsValue = attr_value.value;
        } else if (typeof attr_value === 'string') {
          extendsValue = attr_value;
        } else {
          throw syntaxError(
            `extends attribute must be a quoted string with the parent component name`,
            attr_name.line,
            attr_name.column,
            this.source,
            this.filename
          );
        }
      } else if (attr_name.value.startsWith('$')) {
        // $ attributes on Define tags are raw JS assignments (like component invocations)
        // Store them separately - they don't become data- attributes
        const propName = attr_name.value.substring(1);  // Remove $
        defineArgs[propName] = attr_value;
      } else {
        // Regular attributes (tag="span", class="card", etc.)
        if (attr_name.value === 'tag') this.reject_forbidden_tag_attribute(attr_value, attr_name.line, attr_name.column);
        attributes[attr_name.value] = attr_value;
      }

      // Skip newlines between attributes
      while (this.match(TokenType.NEWLINE)) {
        // Skip
      }
    }
    
    this.consume(TokenType.GT, 'Expected >');
    
    const body: ASTNode[] = [];
    
    // Parse until we find the closing tag
    while (!this.check(TokenType.DEFINE_END)) {
      if (this.is_at_end()) {
        const error = unclosedError(
          'component definition',
          name_token.value,
          name_token.line,
          name_token.column,
          this.source,
          this.filename
        );
        throw error;
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
      throw mismatchedTagError(
        `Define:${name_token.value}`,
        `Define:${closing_name.value}`,
        closing_name.line,
        closing_name.column,
        this.source,
        this.filename
      );
    }
    
    const end_token = this.consume(TokenType.GT, 'Expected >');

    // Detect slot-only templates for inheritance
    let isSlotOnly = false;
    let slotNames: string[] = [];

    // Check if body contains only slot nodes (ignoring whitespace-only text)
    const nonWhitespaceNodes = body.filter(node => {
      if (node.type === NodeType.TEXT) {
        return !is_html_whitespace((node as TextNode).content);
      }
      return true;
    });

    if (nonWhitespaceNodes.length > 0) {
      // Check if ALL non-whitespace nodes are slots
      const allSlots = nonWhitespaceNodes.every(node => node.type === NodeType.SLOT);

      if (allSlots) {
        isSlotOnly = true;
        slotNames = nonWhitespaceNodes.map(node => (node as SlotNode).name);
      } else if (nonWhitespaceNodes.some(node => node.type === NodeType.SLOT)) {
        // A slot in a template with other content would compile to invalid JavaScript
        const stray = nonWhitespaceNodes.find(node => node.type !== NodeType.SLOT)!;
        throw syntaxError(
          `Mixed content not allowed in <Define:${name_token.value}>: a template with slots overrides its parent's, ` +
          `so all content must be inside <Slot:slotname> tags (non-slot content at line ${stray.line}, col ${stray.column})`,
          stray.line,
          stray.column,
          this.source,
          this.filename
        );
      }
    }

    return createNode(
      NodeType.COMPONENT_DEFINITION,
      {
        name: name_token.value,
        body,
        attributes,
        extends: extendsValue,
        defineArgs: Object.keys(defineArgs).length > 0 ? defineArgs : undefined,
        isSlotOnly,
        slotNames
      },
      start_token.start,
      end_token.end,
      start_token.line,
      start_token.column,
      this.create_location(start_token, end_token)
    );
  }
  
  // Parse content (text, expressions, control flow)
  private parse_content(): ASTNode | null {
    // Comments are now preprocessed into whitespace by the lexer

    // Plain text
    if (this.match(TokenType.TEXT)) {
      const token = this.previous();
      return createNode(
        NodeType.TEXT,
        { content: token.value },
        token.start,
        token.end,
        token.line,
        token.column,
        this.create_location(token, token)
      );
    }

    // Expression <%= ... %> or <%!= ... %> or <%br= ... %>
    if (this.match(TokenType.EXPRESSION_START) ||
        this.match(TokenType.EXPRESSION_UNESCAPED) ||
        this.match(TokenType.EXPRESSION_BR)) {
      return this.parse_expression();
    }

    // Code block <% ... %>
    if (this.match(TokenType.CODE_START)) {
      return this.parse_code_block();
    }
    
    // Slot <Slot:name>...</Slot:name>
    if (this.match(TokenType.SLOT_START)) {
      return this.parse_slot();
    }
    
    // HTML tags and component invocations
    if (this.match(TokenType.TAG_OPEN)) {
      return this.parse_tag();
    }
    
    // A newline in content is whitespace text. Codegen emits it on the line the
    // newline leads into (its end position), so the whitespace before a line's
    // markup is generated with that markup and a header line carries no body.
    if (this.match(TokenType.NEWLINE)) {
      const token = this.previous();
      const end = token.loc ? token.loc.end : { line: token.line + 1, column: 1 };
      return createNode(
        NodeType.TEXT,
        { content: token.value },
        token.start,
        token.end,
        end.line,
        end.column,
        this.create_location(token, token)
      );
    }
    
    // Anything else is a token that cannot appear here. Skipping it silently
    // dropped stray closing tags and stray %> from the output.
    if (!this.is_at_end()) {
      throw this.unexpected_content_error(this.peek());
    }

    return null;
  }

  /** 1-based line/column where a token starts. */
  private position_of(token: Token): { line: number, column: number } {
    return { line: token.line, column: token.column };
  }

  /** Error for a token parse_content() cannot place: stray or mismatched closing
   *  tags, a stray %>, a nested <Define:>. */
  private unexpected_content_error(token: Token): JQHTMLParseError {
    const at = this.position_of(token);
    const where = `(line ${at.line}, col ${at.column})`;
    const fail = (message: string) => new JQHTMLParseError(message, at.line, at.column, this.source, this.filename);

    let closing: string | null = null;
    if (token.type === TokenType.TAG_CLOSE) {
      const name = this.peek_ahead(1);
      closing = name.type === TokenType.DYNAMIC_TAG_NAME ? `{${Parser.normalize_expression(name.value)}}`
        : name.type === TokenType.TAG_NAME ? name.value : '';
    } else if (token.type === TokenType.SLOT_END) {
      closing = `Slot:${this.peek_ahead(1).value}`;
    } else if (token.type === TokenType.DEFINE_END) {
      closing = `Define:${this.peek_ahead(1).value}`;
    }

    if (closing !== null) {
      if (token.type === TokenType.TAG_CLOSE && !is_component_name(closing) && VOID_ELEMENTS.has(closing.toLowerCase())) {
        return fail(
          `Closing </${closing}> is not allowed: <${closing}> is a void element and has no closing tag ${where}. ` +
          `Write <${closing}> or <${closing} /> alone.`
        );
      }
      const open = this.open_elements[this.open_elements.length - 1];
      if (!open) {
        return fail(`Closing </${closing}> has no matching open tag ${where}`);
      }
      const opened = this.position_of(open.token);
      // A closing tag for an element further out means the innermost one was
      // never closed (<div><span></div>); report that, not a mismatch.
      const closes_outer = closing === `Define:${this.define_name}` ||
        this.open_elements.slice(0, -1).some((e) => e.name === closing);
      if (closes_outer) {
        const name = open.kind === 'slot' ? open.name.slice('Slot:'.length) : open.name;
        return new JQHTMLParseError(
          `Unclosed ${open.kind}: ${name} (line ${opened.line}, col ${opened.column}); ` +
          `</${closing}> ${where} closes an enclosing element first`,
          opened.line, opened.column, this.source, this.filename
        );
      }
      return fail(
        `Closing </${closing}> does not match open <${open.name}> ${where}; ` +
        `<${open.name}> was opened at line ${opened.line}, col ${opened.column}`
      );
    }

    if (token.type === TokenType.TAG_END) {
      return fail(`Stray %> with no matching <% ${where}`);
    }
    if (token.type === TokenType.DEFINE_START) {
      return fail(`<Define:${this.peek_ahead(1).value}> cannot appear inside a component definition ${where}`);
    }
    return fail(`Unexpected ${token.type} ${JSON.stringify(token.value)} ${where}`);
  }
  
  // Parse <%= expression %> or <%!= expression %> or <%br= expression %>
  private parse_expression(): ExpressionNode {
    const start_token = this.previous(); // EXPRESSION_START, EXPRESSION_UNESCAPED, or EXPRESSION_BR
    const code_token = this.consume(TokenType.JAVASCRIPT, 'Expected JavaScript code');

    // Validate JavaScript code for common mistakes
    this.validate_javascript_code(code_token.value, code_token);

    // With no %>, the lexer ran the expression to the end of the file
    if (this.is_at_end()) this.throw_unterminated_expression(start_token);
    const end_token = this.consume(TokenType.TAG_END, 'Expected %>');

    // EXPRESSION_START and EXPRESSION_BR are escaped, EXPRESSION_UNESCAPED is not
    const is_escaped = start_token.type === TokenType.EXPRESSION_START ||
                       start_token.type === TokenType.EXPRESSION_BR;
    // Only EXPRESSION_BR converts newlines to <br />
    const is_nl2br = start_token.type === TokenType.EXPRESSION_BR;

    // One line: codegen emits the expression on the line it starts on. The
    // source's newlines stay inside the <% %> - none becomes template text.
    const joined = join_lines_mapped(code_token.value);

    return createNode(
      NodeType.EXPRESSION,
      {
        code: joined.code,
        escaped: is_escaped,
        nl2br: is_nl2br,
        code_loc: { line: code_token.line, column: code_token.column, line_starts: joined.line_starts }
      },
      start_token.start,
      end_token.end,
      start_token.line,
      start_token.column,
      this.create_location(start_token, end_token)
    );
  }
  
  // Parse <% code %> - collect tokens with their types for proper transformation
  private parse_code_block(): ASTNode {
    const start_token = this.previous(); // CODE_START
    
    // Collect tokens with their types
    const tokens: Array<{type: TokenType, value: string}> = [];
    let code_loc: { line: number, column: number } | undefined;

    while (!this.check(TokenType.TAG_END)) {
      if (this.is_at_end()) {
        throw syntaxError(
          'Unterminated code block - expected %>',
          start_token.line,
          start_token.column,
          this.source,
          this.filename
        );
      }

      const token = this.advance();

      // Validate JavaScript tokens for common mistakes
      if (token.type === TokenType.JAVASCRIPT) {
        this.validate_javascript_code(token.value, token);
        if (!code_loc) code_loc = { line: token.line, column: token.column };
      }

      tokens.push({type: token.type, value: token.value});
    }

    const end_token = this.consume(TokenType.TAG_END, 'Expected %>');

    return createNode(
      NodeType.CODE_BLOCK,
      { tokens, code_loc },  // Pass tokens array instead of concatenated code
      start_token.start,
      end_token.end,
      start_token.line,
      start_token.column,
      this.create_location(start_token, end_token)
    );
  }
  
  // JavaScript reserved words that cannot be used as slot names
  private static readonly JAVASCRIPT_RESERVED_WORDS = new Set([
    // Keywords
    'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default',
    'delete', 'do', 'else', 'enum', 'export', 'extends', 'false', 'finally',
    'for', 'function', 'if', 'import', 'in', 'instanceof', 'let', 'new', 'null',
    'return', 'super', 'switch', 'this', 'throw', 'true', 'try', 'typeof',
    'var', 'void', 'while', 'with', 'yield',
    // Future reserved words
    'implements', 'interface', 'package', 'private', 'protected', 'public', 'static', 'await',
    // Other problematic words
    'arguments', 'eval'
  ]);

  /**
   * Validate a slot tag's attributes and return the declared parameter list.
   *
   *   <Slot:row $params="record, index">   -> ['record', 'index']
   *   <Slot:row>                            -> undefined (function(row) {...})
   */
  private parse_slot_params(
    name_token: Token,
    attributes: Record<string, any>,
    conditionalAttributes: ConditionalAttributeNode[]
  ): string[] | undefined {
    const fail = (message: string) => syntaxError(message, name_token.line, name_token.column, this.source, this.filename);

    if (conditionalAttributes.length > 0) {
      throw fail(`Slot "${name_token.value}" cannot have conditional attributes`);
    }
    for (const key of Object.keys(attributes)) {
      if (key !== '$params') {
        throw fail(
          `Slot "${name_token.value}" does not accept the attribute "${key}". ` +
          `The only slot attribute is $params="a, b", which names the values the slot receives from content('${name_token.value}', a, b).`
        );
      }
    }
    if (!('$params' in attributes)) {
      return undefined;
    }

    // parse_attribute_value() returns { quoted: true, value } for a plain quoted string.
    const raw = attributes['$params'];
    if (!raw || typeof raw !== 'object' || raw.quoted !== true || typeof raw.value !== 'string') {
      throw fail(`Slot "${name_token.value}": $params must be a quoted list of names, e.g. $params="record, index"`);
    }
    const params = raw.value.split(',').map((p: string) => p.trim()).filter((p: string) => p.length > 0);
    if (params.length === 0) {
      throw fail(`Slot "${name_token.value}": $params is empty`);
    }
    for (const param of params) {
      if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(param)) {
        throw fail(`Slot "${name_token.value}": $params entry "${param}" is not a valid JavaScript identifier`);
      }
      if (Parser.JAVASCRIPT_RESERVED_WORDS.has(param.toLowerCase())) {
        throw fail(`Slot "${name_token.value}": $params entry "${param}" is a JavaScript reserved word`);
      }
    }
    if (new Set(params).size !== params.length) {
      throw fail(`Slot "${name_token.value}": $params has a duplicate name`);
    }
    return params;
  }

  // Parse slot <Slot:name>content</Slot:name> or <Slot:name />
  private parse_slot(): SlotNode {
    const start_token = this.previous(); // SLOT_START
    const name_token = this.consume(TokenType.SLOT_NAME, 'Expected slot name');

    // A slot name becomes an object key and the slot function's parameter name
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name_token.value)) {
      throw syntaxError(
        `Slot name "${name_token.value}" is not a valid JavaScript identifier: a slot name must start with a letter or underscore`,
        name_token.line,
        name_token.column,
        this.source,
        this.filename
      );
    }

    // Validate slot name against JavaScript reserved words
    if (Parser.JAVASCRIPT_RESERVED_WORDS.has(name_token.value.toLowerCase())) {
      throw syntaxError(
        `Slot name "${name_token.value}" is a JavaScript reserved word and cannot be used. Please choose a different name.`,
        name_token.line,
        name_token.column,
        this.source,
        this.filename
      );
    }

    // The only attribute a slot takes is $params="a, b" - the names its
    // function receives from content('name', a, b). Without it the function
    // has one parameter named after the slot.
    const { attributes, conditionalAttributes } = this.parse_attributes();
    const params = this.parse_slot_params(name_token, attributes, conditionalAttributes);

    // Check for self-closing slot. With no attributes the lexer emits SLASH GT;
    // after attributes it emits a single SELF_CLOSING token.
    if (this.check(TokenType.SLASH) || this.check(TokenType.SELF_CLOSING)) {
      const end_token = this.match(TokenType.SELF_CLOSING)
        ? this.previous()
        : (this.advance(), this.consume(TokenType.GT, 'Expected >'));
      return createNode(
        NodeType.SLOT,
        {
          name: name_token.value,
          attributes,
          params,
          children: [],
          selfClosing: true
        },
        start_token.start,
        end_token.end,
        start_token.line,
        start_token.column,
        this.create_location(start_token, end_token)
      );
    }
    
    // Regular slot with content
    this.consume(TokenType.GT, 'Expected >');
    
    const children: ASTNode[] = [];
    this.open_elements.push({ name: `Slot:${name_token.value}`, kind: 'slot', token: start_token });
    
    // Parse until we find the closing tag
    while (!this.check(TokenType.SLOT_END)) {
      if (this.is_at_end()) {
        const error = unclosedError(
          'slot',
          name_token.value,
          name_token.line,
          name_token.column,
          this.source,
          this.filename
        );
        throw error;
      }
      
      const node = this.parse_content();
      if (node) {
        children.push(node);
      }
    }
    
    this.open_elements.pop();

    // Consume closing tag
    const close_token = this.consume(TokenType.SLOT_END, 'Expected </Slot:');
    const closing_name = this.consume(TokenType.SLOT_NAME, 'Expected slot name');
    
    if (closing_name.value !== name_token.value) {
      throw mismatchedTagError(
        name_token.value,
        closing_name.value,
        closing_name.line,
        closing_name.column,
        this.source,
        this.filename
      );
    }
    
    const end_token = this.consume(TokenType.GT, 'Expected >');
    
    return createNode(
      NodeType.SLOT,
      {
        name: name_token.value,
        attributes,
        params,
        children,
        selfClosing: false,
        close_loc: this.position_of(close_token)
      },
      start_token.start,
      end_token.end,
      start_token.line,
      start_token.column,
      this.create_location(start_token, end_token)
    );
  }
  
  // Token navigation helpers
  
  // Parse HTML tag or component invocation
  private parse_tag(): ASTNode {
    const start_token = this.previous(); // TAG_OPEN

    // <{expression}>: a component whose name is computed at render time. The
    // node's name is the normalized expression text, used only to match the
    // closing tag and to describe the tag in errors.
    const is_dynamic = this.check(TokenType.DYNAMIC_TAG_NAME);
    const name_token = this.consume(is_dynamic ? TokenType.DYNAMIC_TAG_NAME : TokenType.TAG_NAME, 'Expected tag name');
    const dynamic_expression = is_dynamic ? name_token.value : null;
    // Emitted as code on the tag's line, so a multi-line expression is joined there.
    // The token starts at the {; the expression one column later.
    const dynamic_joined = dynamic_expression !== null ? join_lines_mapped(dynamic_expression) : null;
    const dynamic_code = dynamic_joined ? {
      expression: dynamic_joined.code,
      expression_loc: { line: name_token.line, column: name_token.column + 1, line_starts: dynamic_joined.line_starts }
    } : {};
    if (is_dynamic && name_token.value.trim() === '') {
      throw syntaxError(
        `Dynamic component tag <{}> has an empty expression`,
        name_token.line,
        name_token.column,
        this.source,
        this.filename
      );
    }
    let tag_name = is_dynamic ? Parser.normalize_expression(name_token.value) : name_token.value;
    let original_tag_name: string | null = null;  // Track original for $redrawable

    // Check for forbidden tags (any <script text is already a lexer error)
    const tag_lower = tag_name.toLowerCase();
    if (!is_dynamic && tag_lower === 'style') {
      throw syntaxError(
        `<${tag_name}> tags are not allowed in JQHTML templates. ` +
        `Use external files or inline styles via attributes instead.`,
        name_token.line,
        name_token.column,
        this.source,
        this.filename
      );
    }

    // Determine if this is a component or an HTML tag (see component-name.ts)
    let is_component = is_dynamic || is_component_name(tag_name);

    // Check if this is an HTML5 void element (only for HTML tags, not components)
    const is_void_element = !is_component && VOID_ELEMENTS.has(tag_lower);

    // Parse attributes
    const { attributes, conditionalAttributes } = this.parse_attributes();
    if (is_component) this.reject_forbidden_tag_attribute(attributes['tag'], name_token.line, name_token.column);

    // Check for $redrawable attribute transformation
    // Transform <div $redrawable> to <Redrawable tag="div">
    if (attributes['$redrawable'] !== undefined || attributes['data-redrawable'] !== undefined) {
      const redrawable_attr = attributes['$redrawable'] !== undefined ? '$redrawable' : 'data-redrawable';

      // Remove the $redrawable attribute
      delete attributes[redrawable_attr];

      // Store original tag name for closing tag matching
      original_tag_name = tag_name;

      // Add tag="original_tag_name" attribute
      attributes['tag'] = { quoted: true, value: tag_name };

      // Transform tag name to Redrawable (reserved component name)
      tag_name = 'Redrawable';
      is_component = true;  // Now it's a component
    }

    // Check for explicit self-closing syntax
    if (this.match(TokenType.SELF_CLOSING)) {
      const end_token = this.previous();
      
      if (is_component) {
        return createNode(
          NodeType.COMPONENT_INVOCATION,
          {
            name: tag_name,
            dynamic: is_dynamic || undefined,
            ...dynamic_code,
            attributes,
            conditionalAttributes: conditionalAttributes.length > 0 ? conditionalAttributes : undefined,
            children: [],
            selfClosing: true
          },
          start_token.start,
          end_token.end,
          start_token.line,
          start_token.column,
          this.create_location(start_token, end_token)
        );
      } else {
        return createNode(
          NodeType.HTML_TAG,
          {
            name: tag_name,
            attributes,
            conditionalAttributes: conditionalAttributes.length > 0 ? conditionalAttributes : undefined,
            children: [],
            selfClosing: true
          },
          start_token.start,
          end_token.end,
          start_token.line,
          start_token.column,
          this.create_location(start_token, end_token)
        );
      }
    }

    // Auto-close void elements even without explicit /> syntax
    // This matches standard HTML5 authoring where <input> doesn't need />
    if (is_void_element) {
      // Skip newlines before >
      while (this.match(TokenType.NEWLINE)) {
        // Skip newlines
      }
      const end_token = this.consume(TokenType.GT, 'Expected >');

      // Void elements are always HTML tags (not components)
      return createNode(
        NodeType.HTML_TAG,
        {
          name: tag_name,
          attributes,
          conditionalAttributes: conditionalAttributes.length > 0 ? conditionalAttributes : undefined,
          children: [],
          selfClosing: true
        },
        start_token.start,
        end_token.end,
        start_token.line,
        start_token.column,
        this.create_location(start_token, end_token)
      );
    }

    // Must be a paired tag - skip newlines before >
    while (this.match(TokenType.NEWLINE)) {
      // Skip newlines
    }
    this.consume(TokenType.GT, 'Expected >');
    
    // Parse children
    const children: ASTNode[] = [];
    this.open_elements.push({
      name: is_dynamic ? `{${tag_name}}` : (original_tag_name || tag_name),
      kind: is_component && !original_tag_name ? 'component' : 'tag',
      token: start_token
    });

    // Keep parsing content until we hit the closing tag
    // For $redrawable transforms, accept either original or transformed name
    while (!(is_dynamic ? this.check_closing_dynamic_tag(tag_name) : this.check_closing_tag(tag_name)) &&
           !(original_tag_name && this.check_closing_tag(original_tag_name))) {
      if (this.is_at_end()) {
        const error = unclosedError(
          is_component ? 'component' : 'tag',
          is_dynamic ? `{${dynamic_expression}}` : tag_name,
          start_token.line,
          start_token.column,
          this.source,
          this.filename
        );
        throw error;
      }

      // A dynamic closing tag whose expression text differs from the opening
      // one is a mismatch, reported with both expressions and both lines. The
      // comparison is textual (trimmed, internal whitespace collapsed); the
      // closing expression is never evaluated.
      if (is_dynamic && this.check(TokenType.TAG_CLOSE)) {
        const next = this.tokens[this.current + 1];
        if (next && next.type === TokenType.DYNAMIC_TAG_NAME) {
          throw syntaxError(
            `Mismatched dynamic component tags: <{${dynamic_expression!.trim()}}> opened on line ${start_token.line} ` +
            `is closed by </{${next.value.trim()}}> on line ${next.line}. ` +
            `The closing expression must match the opening one textually (whitespace aside).`,
            next.line,
            next.column,
            this.source,
            this.filename
          );
        }
      }

      const child = this.parse_content();
      if (child) {
        children.push(child);
      }
    }

    this.open_elements.pop();

    // Consume closing tag
    const close_token = this.consume(TokenType.TAG_CLOSE, 'Expected </');
    const close_name = this.consume(is_dynamic ? TokenType.DYNAMIC_TAG_NAME : TokenType.TAG_NAME, 'Expected tag name');
    if (is_dynamic) close_name.value = Parser.normalize_expression(close_name.value);

    // For $redrawable transforms, accept either original or transformed tag name
    const is_valid_closing = close_name.value === tag_name ||
                             (original_tag_name && close_name.value === original_tag_name);

    if (!is_valid_closing) {
      throw mismatchedTagError(
        original_tag_name || tag_name,  // Show original name in error
        close_name.value,
        close_name.line,
        close_name.column,
        this.source,
        this.filename
      );
    }
    
    const end_token = this.consume(TokenType.GT, 'Expected >');
    
    if (is_component) {
      // Validate mixed content mode for components
      this.validate_component_children(children, tag_name, start_token);
      return createNode(
        NodeType.COMPONENT_INVOCATION,
        {
          name: tag_name,
          dynamic: is_dynamic || undefined,
          ...dynamic_code,
          attributes,
          conditionalAttributes: conditionalAttributes.length > 0 ? conditionalAttributes : undefined,
          children,
          selfClosing: false,
          close_loc: this.position_of(close_token)
        },
        start_token.start,
        end_token.end,
        start_token.line,
        start_token.column,
        this.create_location(start_token, end_token)
      );
    } else {
      // Check if this tag needs whitespace preservation
      const tag_lower = tag_name.toLowerCase();
      const preserveWhitespace = tag_lower === 'textarea' || tag_lower === 'pre';

      return createNode(
        NodeType.HTML_TAG,
        {
          name: tag_name,
          attributes,
          conditionalAttributes: conditionalAttributes.length > 0 ? conditionalAttributes : undefined,
          children,
          selfClosing: false,
          preserveWhitespace,
          close_loc: this.position_of(close_token)
        },
        start_token.start,
        end_token.end,
        start_token.line,
        start_token.column,
        this.create_location(start_token, end_token)
      );
    }
  }
  
  // Parse attributes from tokens
  private parse_attributes(): { attributes: Record<string, any>, conditionalAttributes: ConditionalAttributeNode[] } {
    const attributes: Record<string, any> = {};
    const conditionalAttributes: ConditionalAttributeNode[] = [];

    // Skip any leading newlines
    while (this.match(TokenType.NEWLINE)) {
      // Skip
    }

    while (this.check(TokenType.ATTR_NAME) || this.check(TokenType.CODE_START)) {
      // Check for conditional attribute: <% if (condition) { %>
      if (this.check(TokenType.CODE_START)) {
        // Check if this is a closing brace <% } %> - if so, stop parsing attributes
        // Peek ahead to see if the next token after CODE_START is a closing brace
        const peek_next = this.tokens[this.current + 1];
        if (peek_next && peek_next.type === TokenType.JAVASCRIPT && peek_next.value.trim() === '}') {
          // This is a closing brace, not a new conditional attribute
          // Stop parsing and return control to the caller
          break;
        }

        const condAttr = this.parse_conditional_attribute();
        if (condAttr) {
          conditionalAttributes.push(condAttr);
        }
        // Skip newlines after conditional attribute
        while (this.match(TokenType.NEWLINE)) {
          // Skip
        }
        continue;
      }

      const name_token = this.advance();
      let name = name_token.value;
      let value: any = true; // Default for boolean attributes

      // Check for equals sign and value
      if (this.match(TokenType.EQUALS)) {
        // Check if this is a compound value with interpolation
        if (this.check(TokenType.ATTR_VALUE) ||
            this.check(TokenType.EXPRESSION_START) ||
            this.check(TokenType.EXPRESSION_UNESCAPED)) {
          value = this.parse_attribute_value();
        }
      }

      // Handle special attribute prefixes
      if (name.startsWith('$')) {
        // Special case: $sid becomes data-sid (needed for scoped ID system)
        // All other $ attributes stay as-is (handled by instruction-processor.ts)
        if (name === '$sid') {
          name = 'data-sid';
        }
        // Keep $ prefix for other attributes - they get stored via .data() at runtime
        // Keep the value object intact to preserve quoted/unquoted distinction
      } else if (name.startsWith(':')) {
        // Property binding: :prop="value" becomes data-bind-prop
        // Preserve whether value was quoted or not for proper code generation
        name = 'data-bind-' + name.substring(1);
        // Keep the value object intact to preserve quoted/unquoted distinction
      } else if (name.startsWith('@')) {
        // Event binding: @click="handler" becomes data-__-on-click
        // Preserve whether value was quoted or not for proper code generation
        name = 'data-__-on-' + name.substring(1);
        // Keep the value object intact to preserve quoted/unquoted distinction
      }

      attributes[name] = value;

      // Skip newlines between attributes
      while (this.match(TokenType.NEWLINE)) {
        // Skip
      }
    }

    return { attributes, conditionalAttributes };
  }

  // Parse conditional attribute: <% if (condition) { %>attr="value"<% } %>
  private parse_conditional_attribute(): ConditionalAttributeNode | null {
    const start_token = this.peek();

    // Consume <%
    this.consume(TokenType.CODE_START, 'Expected <%');

    let condition: string;

    // Only brace style supported: CODE_START → JAVASCRIPT "if (condition) {" → TAG_END
    if (this.check(TokenType.JAVASCRIPT)) {
      const jsToken = this.consume(TokenType.JAVASCRIPT, 'Expected if statement');
      const jsCode = jsToken.value.trim();

      // Verify it starts with 'if' and contains both ( and {
      if (!jsCode.startsWith('if')) {
        throw syntaxError(
          'Only if statements are allowed in attribute context. Use <% if (condition) { %>attr="value"<% } %>',
          jsToken.line,
          jsToken.column,
          this.source
        );
      }

      // Extract condition from: if (condition) {
      const openParen = jsCode.indexOf('(');
      const closeBrace = jsCode.lastIndexOf('{');

      if (openParen === -1 || closeBrace === -1) {
        throw syntaxError(
          'Expected format: <% if (condition) { %>',
          jsToken.line,
          jsToken.column,
          this.source
        );
      }

      // Extract just the condition part (between parens, including parens). It is
      // emitted on the tag's line, so a multi-line condition is joined there.
      condition = join_lines(jsCode.substring(openParen, closeBrace).trim());

    } else {
      // Not an if statement
      throw syntaxError(
        'Only if statements are allowed in attribute context. Use <% if (condition) { %>attr="value"<% } %>',
        this.peek().line,
        this.peek().column,
        this.source
      );
    }

    // Consume %>
    this.consume(TokenType.TAG_END, 'Expected %>');

    // Now parse the attributes inside the conditional
    const innerAttrs = this.parse_attributes();

    // These should be plain attributes only (no nested conditionals)
    if (innerAttrs.conditionalAttributes.length > 0) {
      throw syntaxError(
        'Nested conditional attributes are not supported',
        start_token.line,
        start_token.column,
        this.source
      );
    }

    // Consume <% } %>
    this.consume(TokenType.CODE_START, 'Expected <% to close conditional attribute');
    const closeToken = this.consume(TokenType.JAVASCRIPT, 'Expected }');
    if (closeToken.value.trim() !== '}') {
      throw syntaxError(
        'Expected } to close if statement',
        closeToken.line,
        closeToken.column,
        this.source
      );
    }
    this.consume(TokenType.TAG_END, 'Expected %>');

    return createNode(
      NodeType.CONDITIONAL_ATTRIBUTE,
      {
        condition,
        attributes: innerAttrs.attributes
      },
      start_token.start,
      this.previous().end,
      start_token.line,
      start_token.column
    ) as ConditionalAttributeNode;
  }

  /** tag="script" / tag="style" on a <Define:> or a component would build the element
   *  the template rules forbid. */
  private reject_forbidden_tag_attribute(value: any, line: number, column: number): void {
    if (value && typeof value === 'object' && value.quoted && /^\s*(script|style)\s*$/i.test(value.value)) {
      throw syntaxError(
        `tag="${value.value}" is not allowed: <script> and <style> elements cannot appear in JQHTML templates`,
        line,
        column,
        this.source,
        this.filename
      );
    }
  }

  /** An expression whose %> never comes: report the opening tag, not the end of file. */
  private throw_unterminated_expression(open_token: Token): never {
    throw syntaxError(
      `Unterminated ${open_token.value} expression - expected %>`,
      open_token.line,
      open_token.column,
      this.source,
      this.filename
    );
  }

  // Parse potentially compound attribute value. <%br= never reaches here: the
  // lexer rejects it in attribute values.
  private parse_attribute_value(): any {
    const parts: Array<{type: 'text' | 'expression', value: string, escaped: boolean}> = [];
    let interpolated = false;

    // Where a lone value token starts: the position of an unquoted JS value
    const first = this.peek();

    // Collect all parts of the attribute value
    while (this.check(TokenType.ATTR_VALUE) ||
           this.check(TokenType.EXPRESSION_START) ||
           this.check(TokenType.EXPRESSION_UNESCAPED)) {

      if (this.check(TokenType.ATTR_VALUE)) {
        const token = this.advance();
        if (token.interpolation_text) interpolated = true;
        // Preserve whitespace in interpolated attribute values - spaces between
        // expressions and text are significant (e.g., "<%= expr %> suffix")
        // Only skip completely empty parts
        if (token.value.length > 0) {
          // Literal text inside a quoted value with <%= %> parts: resolve its
          // character references here (a lone token is classified below).
          const value = token.interpolation_text ? decode_attribute_text(token.value) : token.value;
          parts.push({ type: 'text', value, escaped: true });
        }
      } else {
        const is_escaped = this.peek().type === TokenType.EXPRESSION_START;
        const open_token = this.advance(); // consume <%= or <%!=
        const expr_token = this.consume(TokenType.JAVASCRIPT, 'Expected expression');
        if (this.is_at_end()) this.throw_unterminated_expression(open_token);
        this.consume(TokenType.TAG_END, 'Expected %>');
        const joined = join_lines_mapped(expr_token.value);
        parts.push(Parser.with_code_loc(
          { type: 'expression', value: joined.code, escaped: is_escaped },
          { line: expr_token.line, column: expr_token.column, line_starts: joined.line_starts }
        ));
        interpolated = true;
      }
    }
    
    // A single text part that is not literal text from an interpolated value:
    // classify it (quoted string, parenthesised expression, identifier, ...)
    if (!interpolated && parts.length === 1 && parts[0].type === 'text') {
      const value = parts[0].value;
      
      // Check if the value has quotes (preserved by lexer for quoted strings)
      if ((value.startsWith('"') && value.endsWith('"')) || 
          (value.startsWith("'") && value.endsWith("'"))) {
        // Return a marker that this was a quoted string. Its character references
        // are resolved as the HTML tokenizer resolves them (html_attribute.ts).
        return { quoted: true, value: decode_attribute_text(value.slice(1, -1)) };
      }
      
      // Check if it's a parenthesized expression: $attr=(expr)
      if (value.startsWith('(') && value.endsWith(')')) {
        // Return as an expression - remove the parentheses. It is emitted on the
        // tag's line, so a multi-line expression is joined there.
        const joined = join_lines_mapped(value.slice(1, -1));
        return Parser.with_code_loc(
          { expression: true, value: joined.code },
          { line: first.line, column: first.column + 1, line_starts: joined.line_starts }
        );
      }
      
      // Check if it's a bare identifier or member expression: $attr=identifier or $attr=this.method
      // Valid identifiers can include dots for member access (e.g., this.handleClick, data.user.name)
      // Can be prefixed with ! for negation (e.g., !this.canEdit)
      // Pattern: optional ! then starts with letter/$/_ then any combo of letters/numbers/$/_ and dots
      if (/^!?[a-zA-Z_$][a-zA-Z0-9_$.]*$/.test(value)) {
        // Return as an identifier expression
        return Parser.with_code_loc({ identifier: true, value: value }, { line: first.line, column: first.column });
      }

      // Check if it contains function calls (parentheses)
      // If the lexer allowed it (passed validation), treat it as an identifier/expression
      // Examples: getData(), obj.method(arg), rsx.route('A','B').url(123)
      if (value.includes('(') || value.includes(')')) {
        // Return as an identifier expression (function call chain)
        return Parser.with_code_loc({ identifier: true, value: value }, { line: first.line, column: first.column });
      }

      // Otherwise, treat as a JavaScript expression (includes numeric literals like 42, 3.14, etc.)
      return Parser.with_code_loc({ expression: true, value: value }, { line: first.line, column: first.column });
    }
    
    // Any expression or multiple parts needs interpolation handling
    return { interpolated: true, parts };
  }
  
  /**
   * Attach where an attribute's JavaScript starts in the source (for sourcemaps) as a
   * non-enumerable `loc`, so the value object keeps its documented shape.
   */
  static with_code_loc<T extends object>(value: T, loc: CodeLocation): T {
    Object.defineProperty(value, 'loc', { value: loc, enumerable: false });
    return value;
  }

  // Check if we're at a closing tag for the given name
  /** Trim and collapse internal whitespace: the textual identity of a dynamic tag expression. */
  static normalize_expression(expression: string): string {
    return expression.trim().replace(/\s+/g, ' ');
  }

  private check_closing_dynamic_tag(normalized_expression: string): boolean {
    if (!this.check(TokenType.TAG_CLOSE)) {
      return false;
    }
    const next = this.tokens[this.current + 1];
    return !!next && next.type === TokenType.DYNAMIC_TAG_NAME &&
      Parser.normalize_expression(next.value) === normalized_expression;
  }

  private check_closing_tag(tag_name: string): boolean {
    if (!this.check(TokenType.TAG_CLOSE)) {
      return false;
    }
    
    // Look ahead to see if the tag name matches
    const next_pos = this.current + 1;
    if (next_pos < this.tokens.length && 
        this.tokens[next_pos].type === TokenType.TAG_NAME &&
        this.tokens[next_pos].value === tag_name) {
      return true;
    }
    
    return false;
  }
  
  private match(...types: TokenType[]): boolean {
    for (const type of types) {
      if (this.check(type)) {
        this.advance();
        return true;
      }
    }
    return false;
  }
  
  private check(type: TokenType): boolean {
    if (this.is_at_end()) return false;
    return this.peek().type === type;
  }
  
  private check_ahead(offset: number, type: TokenType): boolean {
    if (this.current + offset >= this.tokens.length) {
      return false;
    }
    return this.tokens[this.current + offset].type === type;
  }
  
  private check_sequence(...types: TokenType[]): boolean {
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
  
  private advance(): Token {
    if (!this.is_at_end()) this.current++;
    return this.previous();
  }
  
  private is_at_end(): boolean {
    return this.peek().type === TokenType.EOF;
  }
  
  private peek(): Token {
    return this.tokens[this.current];
  }
  
  private peek_ahead(offset: number): Token {
    const pos = this.current + offset;
    if (pos >= this.tokens.length) {
      return this.tokens[this.tokens.length - 1]; // Return EOF token
    }
    return this.tokens[pos];
  }
  
  private previous(): Token {
    return this.tokens[this.current - 1];
  }
  
  private current_token(): Token {
    return this.tokens[this.current] || this.tokens[this.tokens.length - 1];
  }
  
  private previous_token(): Token {
    return this.tokens[Math.max(0, this.current - 1)];
  }

  /**
   * Create a SourceLocation from start and end tokens
   * Propagates loc field if available, falls back to old fields for compatibility
   */
  private create_location(start: Token, end: Token) {
    if (start.loc && end.loc) {
      // Use new loc field if available
      return {
        start: start.loc.start,
        end: end.loc.end
      };
    }
    // Fall back to old fields for backward compatibility
    return undefined;
  }

  private consume(type: TokenType, message: string): Token {
    if (this.check(type)) return this.advance();

    const token = this.peek();

    // Special case: Detecting template expressions inside HTML tag attributes
    if (type === TokenType.GT &&
        (token.type === TokenType.EXPRESSION_START || token.type === TokenType.EXPRESSION_UNESCAPED || token.type === TokenType.EXPRESSION_BR)) {
      const error = syntaxError(
        'Template expressions (<% %>) cannot be used as attribute values inside HTML tags',
        token.line,
        token.column,
        this.source,
        this.filename
      );

      // Add helpful remediation examples
      error.message += '\n\n' +
        '  Use template expressions INSIDE attribute values instead:\n' +
        '    ✅ <tag style="<%= expression %>">\n' +
        '    ✅ <tag class="<%= condition ? \'active\' : \'\' %>">\n\n' +
        '  Or use conditional logic before the tag:\n' +
        '    ✅ <% let attrs = expression ? \'value\' : \'\'; %>\n' +
        '       <tag attr="<%= attrs %>">\n\n' +
        '  Or set attributes in on_ready() using jQuery:\n' +
        '    ✅ <tag $sid="my_element">\n' +
        '       on_ready() {\n' +
        '         if (this.args.required) this.$sid(\'my_element\').attr(\'required\', true);\n' +
        '       }';

      throw error;
    }

    const error = syntaxError(
      `${message}. Got ${token.type} instead`,
      token.line,
      token.column,
      this.source,
      this.filename
    );
    throw error;
  }
  
  // Validate component children to prevent mixed content mode
  private validate_component_children(children: ASTNode[], componentName: string, startToken: Token): void {
    let hasSlots = false;
    let hasNonSlotContent = false;
    
    for (const child of children) {
      if (child.type === NodeType.SLOT) {
        hasSlots = true;
      } else if (child.type === NodeType.TEXT) {
        // Check if it's non-whitespace text
        const textContent = (child as TextNode).content;
        if (!is_html_whitespace(textContent)) {
          hasNonSlotContent = true;
        }
      } else {
        // Any other node type (expressions, tags, etc.) is non-slot content
        hasNonSlotContent = true;
      }
    }
    
    // If component has both slots and non-slot content, throw error
    if (hasSlots && hasNonSlotContent) {
      throw syntaxError(
        `Mixed content not allowed: when using slots, all content must be inside <Slot:slotname> tags`,
        startToken.line,
        startToken.column,
        this.source,
        this.filename
      );
    }
  }
  
  /**
   * Compile method for simplified API
   * Parses the template and returns component metadata and render function
   */
  compile(): { name: string; tagName: string; defaultAttributes: Record<string, any>; renderFunction: string } {
    // Parse to get AST
    const ast = this.parse();

    // Generate code with sourcemap
    const generator = new CodeGenerator();
    const result = generator.generateWithSourceMap(
      ast,
      this.filename || 'template.jqhtml',
      this.source || ''
    );
    
    // Extract the single component (should only be one per file)
    const componentEntries: [string, any][] = Array.from(result.components.entries());
    
    if (componentEntries.length === 0) {
      throw new Error('No component definition found in template');
    }
    
    if (componentEntries.length > 1) {
      const names = componentEntries.map(([name]) => name).join(', ');
      throw new Error(`Multiple component definitions found: ${names}. Only one component per file is allowed.`);
    }
    
    // Extract component information
    const [name, componentDef] = componentEntries[0];
    
    return {
      name: name,
      tagName: componentDef.tagName || 'div',
      defaultAttributes: componentDef.defaultAttributes || {},
      renderFunction: componentDef.render_function
    };
  }
}