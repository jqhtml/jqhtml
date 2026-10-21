// JQHTML Code Generator - Converts AST to JavaScript functions
// Generates v1-compatible instruction arrays for efficient DOM construction

// HTML5 void elements: no closing tag exists. Emitting one is invalid HTML and
// actively harmful for <br> - browsers parse a stray </br> as a SECOND <br>
// element, producing a double line break. Shared with the parser (which uses it
// to auto-close these tags without requiring /> syntax).
export const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'source', 'track', 'wbr'
]);

import {
  ASTNode,
  NodeType,
  ProgramNode,
  ComponentDefinitionNode,
  ComponentInvocationNode,
  HtmlTagNode,
  TextNode,
  ExpressionNode,
  CodeBlockNode,
  SlotNode,
  CodeLocation,
  ClosePosition
} from './ast.js';
import { SourceMapGenerator } from 'source-map';
import { JQHTMLParseError } from './errors.js';
import { find_matching_bracket, find_statement_end, code_line_starts, strip_trailing_semicolons, has_top_level_comma, find_template_close, scan_js } from './js_scanner.js';
import * as vm from 'vm';
import { js_string, js_string_single } from './js_literal.js';

export interface GeneratedCode {
  code: string;
  source_map?: string; // Generated source map as JSON string
  source_map_data_uri?: string; // Data URI for inline source maps
  components: Map<string, ComponentCode>;
}

/** One sourcemap segment of a render function: generated line 1-based, columns 0-based. */
export interface RenderMapping {
  generated: { line: number, column: number };
  original: { line: number, column: number };
  name?: string;
  /** Author JavaScript copied verbatim from here on, so columns run in step. */
  code?: boolean;
}

export interface ComponentCode {
  name: string;
  render_function: string;
  // Sourcemap segments within render_function, one per emitted node. Render line N is
  // source line N; line 1 is the function header.
  source_mappings: RenderMapping[];
  // Where the <Define> tag starts (1-based line, 0-based column): the target for code
  // that stands for the component as a whole (the function header, module wrapper)
  define_position: { line: number, column: number };
  dependencies: string[]; // Other components referenced
  tagName: string; // Element type (div, span, etc.)
  defaultAttributes: Record<string, any>; // Default attributes from Define tag
  defineArgs?: Record<string, any>; // Default this.args from $ attributes on Define tag (raw JS)
  extends?: string; // Explicit template inheritance via extends="ParentComponent"
}

export class CodeGenerator {
  private components: Map<string, ComponentCode> = new Map();
  private current_component: string | null = null;
  private tag_depth: number = 0;
  private lastOutput: string = ''; // Track last generated output for deduplication
  private marks: Array<{ line: number, column: number, name?: string, code?: boolean }> = []; // see mark()

  private sourceContent?: string;
  private sourceFile?: string;

  generate(ast: ProgramNode, sourceFile?: string, sourceContent?: string): GeneratedCode {
    // Reset state
    this.components.clear();
    this.current_component = null;
    this.tag_depth = 0;

    // Store source info for error reporting
    this.sourceFile = sourceFile;
    this.sourceContent = sourceContent;

    // Process all top-level nodes
    for (const node of ast.body) {
      if (node.type === NodeType.COMPONENT_DEFINITION) {
        this.generate_component(node as ComponentDefinitionNode);
      }
    }

    // Build the final code
    const code = this.build_module_code();

    return {
      code,
      components: this.components
    };
  }

  /**
   * Generate code with source maps using 1:1 line mapping + SourceMapGenerator
   */
  generateWithSourceMap(
    ast: ProgramNode,
    sourceFile: string,
    sourceContent: string
  ): GeneratedCode {
    // Use the regular generate method which creates 1:1 line mapping
    const result = this.generate(ast, sourceFile, sourceContent);

    // Now create a proper sourcemap for each component using SourceMapGenerator
    const componentsWithSourcemaps = new Map();

    for (const [name, component] of result.components) {
      // Create a SourceMapGenerator for this component
      const generator = new SourceMapGenerator({
        file: sourceFile.replace(/\.jqhtml$/, '.js')
      });
      generator.setSourceContent(sourceFile, sourceContent);

      // The render function stands alone: it starts at line 1, column 0
      add_render_mappings(generator, component, sourceFile, 1, 0);

      // Generate the sourcemap
      const sourcemap = generator.toJSON();
      const sourcemapJson = JSON.stringify(sourcemap);
      const sourcemapBase64 = Buffer.from(sourcemapJson).toString('base64');
      const sourceMapDataUri = `data:application/json;charset=utf-8;base64,${sourcemapBase64}`;

      // Add inline sourcemap to render function
      const renderWithSourcemap = component.render_function +
        '\n//# sourceMappingURL=' + sourceMapDataUri;

      componentsWithSourcemaps.set(name, {
        ...component,
        render_function: renderWithSourcemap
      });
    }

    return {
      code: result.code,
      components: componentsWithSourcemaps,
      source_map: JSON.stringify({}), // Not used for inline sourcemaps
      source_map_data_uri: '' // Not used for inline sourcemaps
    };
  }
  
  private generate_component(node: ComponentDefinitionNode) {
    this.current_component = node.name;
    this.lastOutput = ''; // Reset output tracking for each component
    this.marks = [];
    const define_position = { line: node.line, column: Math.max(0, node.column - 1) };
    const dependencies = new Set<string>();

    // Extract metadata and default attributes
    // Handle the 'tag' attribute which might be a quoted object from the parser
    let tagName = 'div';
    const defaultAttributes: Record<string, any> = {};

    // Extract new fields from Define tag (extends and defineArgs)
    const defineArgs = node.defineArgs;
    const extendsValue = node.extends;

    // Process all attributes from the Define tag
    for (const [key, value] of Object.entries(node.attributes)) {
      if (key === 'tag') {
        // Special handling for 'tag' attribute
        if (typeof value === 'object' && value.quoted) {
          tagName = value.value;
        } else if (typeof value === 'string') {
          tagName = value;
        }
      } else {
        // Store as default attribute - extract actual value from quoted objects
        // The lexer accepts only quoted values for plain attributes
        if (typeof value === 'object' && value.quoted) {
          defaultAttributes[key] = value.value;
        } else {
          defaultAttributes[key] = value;
        }
      }
    }

    // Check if this is a slot-only template (template inheritance pattern)
    if (node.isSlotOnly && node.slotNames && node.slotNames.length > 0) {
      // Generate slot-only render function with 1:1 line mapping
      // Extract slot nodes from body
      const slots: Record<string, SlotNode> = {};
      for (const child of node.body) {
        if (child.type === NodeType.SLOT) {
          const slotNode = child as SlotNode;
          slots[slotNode.name] = slotNode;
        }
      }

      // Filter out TEXT nodes (whitespace) from slot-only templates
      // TEXT nodes cause _output.p() calls which are invalid in slot-only context
      const slotsOnly = node.body.filter(child => child.type === NodeType.SLOT);

      // Use 1:1 line mapping for slot-only templates
      const bodyLines = this.generate_function_body_1to1(slotsOnly);

      // Build the render function with line preservation
      const lines: string[] = [];

      // Line 1: function declaration returning slots object, plus anything
      // written on the Define line itself (bodyLines[0] is source line 1)
      lines.push(`function render(data, args, content, jqhtml) { return {_slots: {` + (bodyLines[0] ? ' ' + bodyLines[0] : ''));

      // Lines 2-N: Body lines with slot functions
      lines.push(...bodyLines.slice(1));

      // Fix trailing comma on last slot function
      // Find the last line that contains '.bind(this),' and remove the comma
      for (let i = lines.length - 1; i >= 0; i--) {
        if (lines[i] && lines[i].includes('.bind(this),')) {
          lines[i] = lines[i].replace(/\.bind\(this\),([^,]*)$/, '.bind(this)$1');
          break;
        }
      }

      // Last line: close slots object and return
      if (lines[lines.length - 1]) {
        lines[lines.length - 1] += ' }}; }';
      } else {
        lines[lines.length - 1] = '}}; }';
      }

      const { render_function, source_mappings } = this.finish_render(lines);
      this.validate_render_function(render_function, source_mappings, node);

      // Store component with slot-only metadata
      this.components.set(node.name, {
        name: node.name,
        render_function,
        source_mappings,
        define_position,
        dependencies: Array.from(dependencies),
        tagName,
        defaultAttributes,
        defineArgs,
        extends: extendsValue
      });

      this.current_component = null;
      return;
    }

    // For 1:1 line mapping, we need to generate the body first to know how many lines it has
    const bodyLines = this.generate_function_body_1to1(node.body);

    // Now create the render function with 1:1 line mapping
    // Line 1 of input (Define tag) becomes the function declaration
    const lines: string[] = [];

    // First line: function declaration and initial setup (corresponds to the
    // Define line) followed by any markup written on that same line
    lines.push(`function render(data, args, content, jqhtml) { let _output = new jqhtml.Markup(this); const _cid = this._cid; const that = this;` + (bodyLines[0] ? ' ' + bodyLines[0] : ''));

    // Body lines: each corresponds to a source line
    lines.push(...bodyLines.slice(1));

    // Last line: closing (corresponds to closing Define tag)
    if (lines[lines.length - 1]) {
      lines[lines.length - 1] += ' return _output; }';
    } else {
      lines[lines.length - 1] = 'return _output; }';
    }

    const { render_function, source_mappings } = this.finish_render(lines);

    this.validate_render_function(render_function, source_mappings, node);

    this.components.set(node.name, {
      name: node.name,
      render_function,
      source_mappings,
      define_position,
      dependencies: Array.from(dependencies),
      tagName,  // Store metadata
      defaultAttributes,  // Store default attributes
      defineArgs,  // Store $ attributes from Define tag
      extends: extendsValue  // Store extends value for template inheritance
    });
    
    this.current_component = null;
  }
  
  /**
   * Parse the exact render function text that will be emitted, so invalid JS in any
   * template (slot-only included) fails compilation instead of failing at load time.
   * The text is 1:1 with the source lines, so the reported line is the source line.
   * A bracket the <% %> blocks leave unbalanced is reported where it is; any other
   * syntax error at the template column V8's caret maps back to.
   */
  private validate_render_function(render_function: string, source_mappings: RenderMapping[], node: ComponentDefinitionNode): void {
    try {
      new vm.Script('(' + render_function + ')', {
        filename: this.sourceFile || 'component.jqhtml'
      });
    } catch (error: any) {
      const position = CodeGenerator.syntax_error_position(error, source_mappings, this.sourceContent);
      // Whichever comes first in the template is the real fault: V8 fails at the end
      // of the function for an unclosed {, but at the ':' of `if (a: { }` before the
      // bracket scan reaches the } that does not match.
      const bracket = this.find_unbalanced_code_bracket(node);
      const v8_first = bracket && position.column > 0 &&
        (position.line < bracket.line || (position.line === bracket.line && position.column < bracket.column));
      if (bracket && !v8_first) {
        throw new JQHTMLParseError(
          `Unbalanced bracket error in component "${node.name}": ${bracket.message}`,
          bracket.line,
          bracket.column,
          this.sourceContent,
          this.sourceFile
        );
      }

      const errorDetail = error.message || String(error);

      throw new JQHTMLParseError(
        `JavaScript syntax error in component "${node.name}": ${errorDetail}\n\nCheck for unclosed brackets, missing quotes, or invalid JavaScript syntax.`,
        position.line,
        position.column,
        this.sourceContent,
        this.sourceFile
      );
    }
  }

  /**
   * The template position of a vm.Script SyntaxError. Its stack starts
   * "filename:LINE", then the generated line and a caret under the column. The mapping
   * at or before the caret gives the template position: inside author JavaScript
   * (copied verbatim) the offset from the mapping carries over; otherwise it is the
   * start of the node. Without a usable caret: the line, column 0.
   */
  private static syntax_error_position(error: any, source_mappings: RenderMapping[], source?: string): { line: number, column: number } {
    const stack = typeof error.stack === 'string' ? error.stack.split('\n') : [];
    const line_match = (stack[0] || '').match(/:(\d+)\s*$/);
    if (!line_match) return { line: 1, column: 0 };
    const generated_line = parseInt(line_match[1], 10);
    const caret = (stack[2] || '').indexOf('^');
    if (caret < 0 || !/^\s*\^+\s*$/.test(stack[2])) return { line: generated_line, column: 0 };

    // Line 1 of the checked text has the '(' wrapper in front of the render function
    const generated_column = caret - (generated_line === 1 ? 1 : 0);
    let mapping: RenderMapping | undefined;
    for (const m of source_mappings) {
      if (m.generated.line === generated_line && m.generated.column <= generated_column) mapping = m;
    }
    if (!mapping) return { line: generated_line, column: 0 };

    const line = mapping.original.line;
    let column = mapping.original.column + 1;
    if (mapping.code) column += generated_column - mapping.generated.column;
    const source_line = source ? source.replace(/\r\n?/g, '\n').split('\n')[line - 1] : undefined;
    if (source_line !== undefined) column = Math.min(column, source_line.length + 1);
    return { line, column };
  }

  /**
   * The first bracket the definition's <% %> blocks leave unbalanced, read as one
   * stream of JavaScript in source order (a block may open what a later one closes).
   * <%= %> expressions are self-contained and not part of the stream; <%-- --%> and
   * HTML comments are not code.
   */
  private find_unbalanced_code_bracket(node: ComponentDefinitionNode): { message: string, line: number, column: number } | null {
    if (!this.sourceContent) return null;
    const blank = (m: string) => m.replace(/[^\n]/g, ' ');
    const text = this.sourceContent.replace(/\r\n?/g, '\n')
      .replace(/<%--[\s\S]*?--%>/g, blank)
      .replace(/<!--[\s\S]*?-->/g, blank);
    const line_offsets = [0];
    for (let k = 0; k < text.length; k++) if (text[k] === '\n') line_offsets.push(k + 1);
    const at = (offset: number) => {
      let l = line_offsets.length - 1;
      while (line_offsets[l] > offset) l--;
      return { line: l + 1, column: offset - line_offsets[l] + 1 };
    };
    const describe = (ch: string, offset: number) => {
      const p = at(offset);
      return `${ch} at line ${p.line}, col ${p.column}`;
    };

    const from = line_offsets[node.line - 1] || 0;
    const end_line = node.loc ? node.loc.end.line : line_offsets.length;
    const to = end_line < line_offsets.length ? line_offsets[end_line] : text.length;
    const PAIRS: Record<string, string> = { ')': '(', ']': '[', '}': '{' };
    const open: Array<{ ch: string, offset: number }> = [];
    let problem: { message: string, offset: number } | null = null;

    let i = from;
    while (!problem && (i = text.indexOf('<%', i)) !== -1 && i < to) {
      const rest = text.substring(i + 2, i + 5);
      const is_expression = rest.startsWith('=') || rest.startsWith('!=') || rest.startsWith('br=');
      const close = find_template_close(text, i + 2);
      if (close === -1) break;
      if (!is_expression) {
        scan_js(text.substring(0, close), i + 2, {
          on_code: (k, ch) => {
            if (ch === '(' || ch === '[' || ch === '{') {
              open.push({ ch, offset: k });
            } else if (PAIRS[ch]) {
              const top = open.pop();
              if (!top) {
                problem = { message: `${describe(ch, k)} closes nothing that a <% %> block opened`, offset: k };
              } else if (top.ch !== PAIRS[ch]) {
                problem = { message: `${describe(ch, k)} does not match ${describe(top.ch, top.offset)}`, offset: k };
              }
              if (problem) return true;
            }
            return false;
          }
        });
      }
      i = close + 2;
    }

    if (!problem && open.length > 0) {
      const top = open[open.length - 1];
      problem = { message: `${describe(top.ch, top.offset)} is never closed`, offset: top.offset };
    }
    if (!problem) return null;
    const p = at((problem as { offset: number }).offset);
    return { message: (problem as { message: string }).message, line: p.line, column: p.column };
  }

  /**
   * Generate the function body line by line: element N of the result is the code for
   * source line N (line 1 is the <Define> line itself).
   *
   * Every node is placed on the source line it starts on, and a closing tag on the
   * line of its </tag>, recursively - nested component content and slot bodies
   * included. Placement follows document order, so concatenating the lines keeps the
   * statements in source order, and no fragment contains a newline, so generated line
   * N is always source line N. Each emitted node carries a sourcemap mark (see mark()).
   */
  private generate_function_body_1to1(nodes: ASTNode[]): string[] {
    // The last source line any node reaches: its start, its end (a closing tag, the
    // %> of a multi-line block) - so a closing tag or code line never falls off the end
    let maxLine = 0;
    const findMaxLine = (node: ASTNode) => {
      const last = Math.max(node.line || 0, node.loc ? node.loc.end.line : 0);
      if (last > maxLine) maxLine = last;
      if ((node as any).body) (node as any).body.forEach(findMaxLine);
      if ((node as any).children) (node as any).children.forEach(findMaxLine);
      if ((node as any).consequent) (node as any).consequent.forEach(findMaxLine);
      if ((node as any).alternate) (node as any).alternate.forEach(findMaxLine);
    };
    nodes.forEach(findMaxLine);

    const lines: string[] = [];
    for (let i = 1; i <= maxLine; i++) {
      lines.push('');
    }

    for (const node of nodes) {
      this.place_node(node, lines);
    }

    return lines;
  }

  /** Place one node's code (and its children's) on their source lines. */
  private place_node(node: ASTNode, lines: string[]): void {
    if (!node.line) return;

    const at = (line: number, code: string) => {
      const index = line - 1;
      if (index >= 0 && index < lines.length) {
        lines[index] += code;
      }
    };

    // VALIDATION: Check for content() in <%!= %> blocks - must run before line filtering
    if (node.type === NodeType.EXPRESSION) {
      const expr = node as ExpressionNode;
      let trimmedCode = expr.code.trim();
      if (trimmedCode.endsWith(';')) {
        trimmedCode = trimmedCode.slice(0, -1).trim();
      }
      const isContentCall = trimmedCode === 'content()' ||
        trimmedCode.match(/^content\s*\(/);

      if (isContentCall && !expr.escaped) {
        const error = new JQHTMLParseError(
          `Invalid syntax: content() cannot be used in <%!= %> blocks`,
          expr.line,
          expr.column || 0,
          this.sourceContent,
          this.sourceFile
        );
        error.suggestion =
          `\n\ncontent() is a passthrough function - it passes inner HTML directly to the component.\n` +
          `The concept of "escaping" or "raw" output doesn't apply here.\n\n` +
          `Use <%= content() %> instead:\n\n` +
          `  ✗ Wrong:   <%!= content() %>   ← invalid, makes no sense\n` +
          `  ✓ Correct: <%= content() %>    ← always use this form\n\n` +
          `The same applies to named slots:\n` +
          `  ✓ <%= content('header') %>`;
        throw error;
      }
    }

    const lineIndex = node.line - 1;
    if (lineIndex < 0 || lineIndex >= lines.length) return;

    switch (node.type) {
      case NodeType.HTML_TAG: {
        this.lastOutput = ''; // Reset for non-text output
        const tag = node as HtmlTagNode;

        // Check if this is a raw content tag (textarea, pre)
        if (tag.preserveWhitespace && !tag.selfClosing && tag.children && tag.children.length > 0) {
          // Validate: only TEXT, EXPRESSION, and CODE_BLOCK children allowed in raw content tags
          // HTML tags and components are not allowed (they would break whitespace preservation)
          for (const child of tag.children) {
            if (child.type !== NodeType.TEXT &&
                child.type !== NodeType.EXPRESSION &&
                child.type !== NodeType.CODE_BLOCK) {
              const error = new JQHTMLParseError(
                `Invalid content in <${tag.name}> tag`,
                tag.line,
                tag.column || 0,
                this.sourceContent,
                this.sourceFile
              );
              error.suggestion =
                `\n\nThe content of a <textarea> is text, so HTML tags and components\n` +
                `cannot be nested inside it.\n\n` +
                `Allowed:\n` +
                `  <textarea><%= this.data.value %></textarea>  ← expressions OK\n` +
                `  <textarea>plain text</textarea>              ← plain text OK\n\n` +
                `Not allowed:\n` +
                `  <textarea><div>content</div></textarea>      ← HTML tags not OK\n` +
                `  <textarea><MyComponent /></textarea>         ← components not OK\n\n` +
                `(<pre> has no such restriction - its content is preserved verbatim.)`;
              throw error;
            }
          }

          // Generate rawtag instruction with raw content
          const attrs_obj = this.generate_attributes_with_conditionals(tag.attributes, tag.conditionalAttributes);
          const escapedContent = this.generate_raw_tag_content(tag);
          at(tag.line, `_output.p(${this.mark_node(tag)}{rawtag: [${js_string(tag.name)}, ${attrs_obj}, ${escapedContent}]});`);
          break;
        }

        // Opening tag on its line
        at(tag.line, this.generate_tag_open(tag));

        // Children on theirs
        if (tag.children) {
          tag.children.forEach((child) => this.place_node(child, lines));
        }

        // Closing tag on the line of the </tag>.
        // Void elements get NO closing tag - a stray </br> makes browsers
        // create a second <br> (double line break bug).
        if (!VOID_ELEMENTS.has(tag.name.toLowerCase())) {
          at(this.close_line(tag, tag.close_loc), ' ' + `_output.p(${js_string(`</${tag.name}>`)});`);
        }
        // A space after the tag is not a repeat of a space inside it: an element can be
        // its own box (inline-block, flex item), where the browser keeps both
        this.lastOutput = '';
        break;
      }
      case NodeType.TEXT: {
        const text = node as TextNode;
        // Apply padded trim to preserve intentional whitespace. An HTML comment is one
        // text node (the lexer's scan_html_comment) and is emitted exactly as written.
        const is_comment = text.content.startsWith('<!--') && text.content.endsWith('-->');
        const processed = is_comment ? text.content : this.padded_trim(text.content);

        if (processed) {
          const escaped = this.escape_string(processed);
          const plain = `_output.p(${escaped});`;

          // Optimization: skip consecutive identical space pushes
          if (plain === '_output.p(" ");' && this.lastOutput === '_output.p(" ");') {
            break;
          }

          this.lastOutput = plain; // Track for next comparison
          at(text.line, ' ' + `_output.p(${this.mark_node(text)}${escaped});`);
        } else {
          // Empty text resets tracking so next space won't be skipped
          this.lastOutput = '';
        }
        break;
      }
      case NodeType.CODE_BLOCK: {
        this.lastOutput = ''; // Reset for non-text output
        const codeBlock = node as CodeBlockNode;
        const code = this.generate_code_block(codeBlock);
        if (code) {
          // Each line of the code goes on its own source line, starting from the line
          // the code itself starts on (`<%` may stand alone on the line before it).
          // With preprocessing, empty lines are already marked with /* empty line */.
          // A line that starts inside a string, template literal or comment is copied
          // verbatim - a separator space or a mark would change the literal.
          const first_line = codeBlock.code_loc ? codeBlock.code_loc.line : codeBlock.line;
          const codeLines = code.split('\n');
          const in_code = code_line_starts(code);
          for (let i = 0; i < codeLines.length; i++) {
            const codeLine = codeLines[i];
            if (!in_code[i]) {
              at(first_line + i, codeLine);
              continue;
            }
            const trimmed = codeLine.trim();
            if (!trimmed) continue;
            const indent = codeLine.length - codeLine.trimStart().length;
            // Line 1 of the code starts at the code's own column; every later line
            // is a whole source line
            const column = i === 0 && codeBlock.code_loc ? codeBlock.code_loc.column : indent + 1;
            const mark = trimmed === '/* empty line */' ? '' : this.mark(first_line + i, column, undefined, true);
            at(first_line + i, ' ' + codeLine.slice(0, indent) + mark + codeLine.slice(indent));
          }
        }
        break;
      }
      case NodeType.EXPRESSION: {
        this.lastOutput = ''; // Reset for non-text output
        const expr = node as ExpressionNode;

        // Strip trailing semicolon if present (optional in <%= %> blocks)
        // Note: content() validation happens at the top of place_node()
        let trimmedCode = expr.code.trim();
        if (trimmedCode.endsWith(';')) {
          trimmedCode = trimmedCode.slice(0, -1).trim();
        }

        // The same code carrying its sourcemap marks
        const marked = this.mark_code(expr.code, expr.code_loc, CodeGenerator.expression_name(trimmedCode));
        let markedTrimmed = marked.trim();
        if (markedTrimmed.endsWith(';')) {
          markedTrimmed = markedTrimmed.slice(0, -1).trim();
        }

        // Primitives first: they are nearly every value and print exactly as before.
        // Of objects, a markup buffer (content(), a slot) is spliced and renders in the
        // component that wrote it; any other array prints the fixed text "(Array)" -
        // being a buffer is the only thing that splices, so a data array can never
        // inject markup; anything else goes to the printer chain.
        const print = (primitive: string, mode: string) =>
          `if (result !== undefined && result !== null) { if (typeof result !== 'object') { _output.p(${primitive}); } else if (result instanceof jqhtml.Markup) { _output.p(result); } else if (Array.isArray(result)) { _output.p("(Array)"); } else { _output.p(jqhtml.print_object(result, '${mode}')); } }`;
        let code: string;
        if (trimmedCode === 'content()') {
          // Default slot/content - check _inner_html first
          code = `(() => { if (this.args._inner_html) { _output.p(this.args._inner_html); } else if (typeof content === 'function') { const result = content.call(this); if (result instanceof jqhtml.Markup) { _output.p(result); } } })();`;
        } else if (trimmedCode.match(/^content\s*\(\s*['"]([^'"]+)['"]\s*(?:,\s*(.+?))?\s*\)$/)) {
          // Named slot: content('header') or content('header', data) (function call with string parameter and optional data)
          // Use the standard result pattern for proper handling
          code = `(() => { const result = ${this.expression_code(markedTrimmed)};; if (result instanceof jqhtml.Markup) { _output.p(result); } else if (Array.isArray(result)) { _output.p("(Array)"); } else { _output.p(jqhtml.escape_html(result)); } })();`;
        } else if (expr.nl2br) {
          // <%br= %> - escaped with newlines converted to <br />
          code = `(() => { const result = ${this.expression_code(marked)}; ${print('jqhtml.escape_html_nl2br(result)', 'nl2br')} })();`;
        } else if (expr.escaped) {
          code = `(() => { const result = ${this.expression_code(marked)}; ${print('jqhtml.escape_html(result)', 'escape')} })();`;
        } else {
          code = `(() => { const result = ${this.expression_code(marked)}; ${print('result', 'raw')} })();`;
        }

        // On the line the expression starts on, the wrapper mapped to its <%=
        at(expr.line, ' ' + this.mark_node(expr) + code);
        break;
      }
      case NodeType.COMPONENT_INVOCATION: {
        this.lastOutput = ''; // Reset for non-text output
        const comp = node as ComponentInvocationNode;
        const attrs = this.generate_attributes_with_conditionals(comp.attributes, comp.conditionalAttributes);
        const open = `_output.p(${this.mark_node(comp)}{comp: [${this.comp_name_code(comp)}, ${attrs}`;

        if (comp.selfClosing || comp.children.length === 0) {
          // Simple component without children
          at(comp.line, ` ${open}]});`);
        } else if (Object.keys(this.extract_slots_from_children(comp.children)).length > 0) {
          // Component with slots: an object of slot functions, each slot placed on
          // its own lines. Content outside the slots is whitespace (the parser
          // rejects anything else) and is not emitted.
          at(comp.line, ` ${open}, {`);
          for (const child of comp.children) {
            if (child.type === NodeType.SLOT) {
              this.place_node(child, lines);
            }
          }
          at(this.close_line(comp, comp.close_loc), ' }]});');
          this.lastOutput = '';
        } else {
          // Component with regular content (no slots): an inline content function
          at(comp.line, ` ${open}, function(${this.comp_fn_param(comp)}) { let _output = new jqhtml.Markup(this);`);
          comp.children.forEach((child) => this.place_node(child, lines));
          at(this.close_line(comp, comp.close_loc), '  return _output; }.bind(this)]});');
          this.lastOutput = ''; // the content was another buffer
        }
        break;
      }
      case NodeType.SLOT: {
        // A slot function: an entry of the slots object (a slot-only template's, or
        // the one passed to a component invocation)
        const slot = node as SlotNode;
        const separator = lines[lineIndex].endsWith('{') ? '' : ' '; // `{row: ...`, not `{ row: ...`
        at(slot.line, `${separator}${this.mark_node(slot)}${slot.name}: function(${this.slot_params(slot)}) { const _output = new jqhtml.Markup(this);`);
        this.lastOutput = ''; // a slot is its own buffer
        if (slot.children) {
          slot.children.forEach((child) => this.place_node(child, lines));
        }
        at(this.close_line(slot, slot.close_loc), ' return _output; }.bind(this),');
        this.lastOutput = '';
        break;
      }
      default:
        console.warn(`Unknown node type: ${node.type}`);
    }
  }

  /** The line a node's closing code goes on: its closing tag, else its last child's line. */
  private close_line(node: ASTNode & { children?: ASTNode[] }, close: ClosePosition | undefined): number {
    if (close) return close.line;
    const children = node.children;
    return children && children.length > 0 ? (children[children.length - 1].line || node.line) : node.line;
  }

  // ---------------------------------------------------------------------------
  // Sourcemap marks
  //
  // A mark is an inline comment dropped into the generated code at the position of an
  // emitted node, naming the source position it came from. Codegen keeps building
  // plain strings (merge_output_pushes rewrites whole lines); a mark travels with the
  // code it precedes, and finish_render() reads every mark's final column and removes
  // it. A block comment is transparent to the JS scanner (brackets, statement ends,
  // regex detection), and marks are only ever placed in generated code or at a point
  // of author code that is top-level code - never inside a string, template literal,
  // regex or comment.

  /** A mark for 1-based source `line` and `column`. */
  private mark(line: number, column: number, name?: string, code?: boolean): string {
    this.marks.push({ line, column: Math.max(0, column - 1), name, code });
    return `/*\u0000${this.marks.length - 1}\u0000*/`;
  }

  /** A mark for where a node starts. */
  private mark_node(node: ASTNode): string {
    return this.mark(node.line, node.column);
  }

  /**
   * `code` with a mark before its first character and before the first character of
   * each later source line it was joined from (join_lines_mapped), so a position
   * inside a multi-line expression maps to its own source line. `name` goes on the
   * first mark.
   */
  private mark_code(code: string, loc: CodeLocation | undefined, name?: string): string {
    if (!loc) return code;

    const starts = [0, ...(loc.line_starts || [])];
    const inserts: Array<{ index: number, mark: string }> = [];
    for (let k = 0; k < starts.length; k++) {
      const start = starts[k];
      if (start < 0) continue; // this line starts inside a literal or comment
      let end = code.length;
      for (let j = k + 1; j < starts.length; j++) {
        if (starts[j] >= 0) { end = starts[j]; break; }
      }
      let index = start;
      while (index < end && /[ \t\n\r\f]/.test(code[index])) index++;
      if (index >= end) continue; // nothing on this line
      const line = loc.line + k;
      const column = k === 0 ? loc.column + index : index - start + 1;
      inserts.push({ index, mark: this.mark(line, column, inserts.length === 0 ? name : undefined, true) });
    }

    let result = code;
    for (let i = inserts.length - 1; i >= 0; i--) {
      result = result.slice(0, inserts[i].index) + inserts[i].mark + result.slice(inserts[i].index);
    }
    return result;
  }

  /** The `names` entry for an expression: an identifier or member path, else none. */
  private static expression_name(code: string): string | undefined {
    return /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/.test(code) ? code : undefined;
  }

  /**
   * Merge each line's pushes, then read out and remove the marks: the render
   * function's text and its sourcemap segments (1-based generated line, 0-based
   * column within the render function).
   */
  private finish_render(lines: string[]): { render_function: string, source_mappings: RenderMapping[] } {
    const source_mappings: RenderMapping[] = [];
    const MARK = /\/\*\u0000(\d+)\u0000\*\//g;
    const output = lines.map((line, i) => {
      const merged = this.merge_output_pushes(line || '');
      let result = '';
      let last = 0;
      let match: RegExpExecArray | null;
      MARK.lastIndex = 0;
      while ((match = MARK.exec(merged)) !== null) {
        result += merged.slice(last, match.index);
        last = match.index + match[0].length;
        const mark = this.marks[Number(match[1])];
        source_mappings.push({
          generated: { line: i + 1, column: result.length },
          original: { line: mark.line, column: mark.column },
          name: mark.name,
          ...(mark.code ? { code: true } : {})
        });
      }
      return result + merged.slice(last);
    });
    return { render_function: output.join('\n'), source_mappings };
  }

  /**
   * Padded trim: Collapse internal whitespace but preserve leading/trailing space
   * Examples:
   *   "  hello  " → " hello "
   *   "hello" → "hello"
   *   "  " → " "
   *   "\n\n  \n" → " "
   */
  private padded_trim(text: string): string {
    // HTML whitespace only. \s and String.trim() also match U+00A0, which would
    // collapse an author's non-breaking spaces (&nbsp; typed as the character).
    const has_leading_space = /^[ \t\n\r\f]/.test(text);
    const has_trailing_space = /[ \t\n\r\f]$/.test(text);

    // Trim the text
    let result = text.replace(/^[ \t\n\r\f]+|[ \t\n\r\f]+$/g, '');

    // Add back single space if original had leading/trailing whitespace
    if (has_leading_space) result = ' ' + result;
    if (has_trailing_space) result = result + ' ';

    // Final pass: collapse all whitespace sequences to single space
    return result.replace(/[ \t\n\r\f]+/g, ' ');
  }

  private generate_code_block(node: CodeBlockNode): string {
    // Handle legacy code property for backward compatibility
    if (node.code !== undefined) {
      return node.code;
    }
    
    // Process tokens to transform PHP-style syntax
    if (!node.tokens || node.tokens.length === 0) {
      return '';
    }
    
    // A code block holds the JAVASCRIPT token of its <% %>: the lexer emits nothing else
    // between CODE_START and TAG_END
    return node.tokens.map(token => token.value).join(' ');
  }
  
  /**
   * Build the content string for a raw-content tag (<textarea>, <pre>).
   *
   * Children are concatenated into a single JavaScript expression rather than a
   * literal, so <%= %> interpolation works inside raw tags. Text is emitted as a
   * string literal; expressions are escaped (or not, for <%!= %>) exactly as they
   * would be in normal output. A null or undefined expression contributes nothing
   * rather than the string "undefined".
   */
  /**
   * Merge consecutive _output.p() calls on a single line into one call.
   *
   *   _output.p(" ");_output.p({tag:[..]});_output.p("A");
   *   -> _output.p(" ", {tag:[..]}, "A");
   *
   * Markup.p() takes varargs and its arguments are evaluated left to right, so
   * this is behaviour-preserving; it just trims call overhead.
   *
   * Strictly within one line. Codegen is line-based so that generated line N maps to
   * source line N; moving a statement across a newline would silently invalidate
   * every sourcemap segment after it.
   *
   * Merging happens only at bracket depth 0, which is what keeps nested closures
   * safe: a component's children are emitted inline as
   * `function(C) { let _output = new jqhtml.Markup(this); ... }`, and those inner
   * pushes belong to a different _output binding. They sit inside parentheses, so
   * they are never candidates here. Anything that is not a plain _output.p(...) statement -
   * control flow, an IIFE, a return - ends the run and is emitted untouched.
   */
  private merge_output_pushes(line: string): string {
    const PUSH = '_output.p(';
    if (line.indexOf(PUSH) === -1) {
      return line;
    }

    let result = '';
    let pending: string[] = [];   // argument text of the run being accumulated
    let gap = '';                 // whitespace between the previous statement and this one

    const flush = () => {
      if (pending.length > 0) {
        result += `_output.p(${pending.join(', ')});`;
        pending = [];
      }
    };

    let i = 0;
    while (i < line.length) {
      // Preserve inter-statement whitespace
      if (/\s/.test(line[i])) {
        gap += line[i];
        i++;
        continue;
      }

      if (line.startsWith(PUSH, i)) {
        const args_start = i + PUSH.length;
        const args_end = find_matching_bracket(line, args_start - 1);

        // A complete `_output.p(...);` statement, and nothing else on its tail
        if (args_end !== -1 && line[args_end + 1] === ';') {
          if (pending.length === 0) {
            result += gap;   // whitespace belongs before the merged call
          }
          gap = '';
          pending.push(line.slice(args_start, args_end));
          i = args_end + 2;
          continue;
        }
      }

      // Not a mergeable push: close the run and copy the rest of the statement
      flush();
      result += gap;
      gap = '';

      const stmt_end = find_statement_end(line, i);
      result += line.slice(i, stmt_end);
      i = stmt_end;
    }

    flush();
    return result + gap;
  }

  private generate_raw_tag_content(node: HtmlTagNode): string {
    const parts: string[] = [];

    for (const child of node.children) {
      if (child.type === NodeType.TEXT) {
        parts.push(this.escape_string((child as TextNode).content));
      } else if (child.type === NodeType.EXPRESSION) {
        const expr = child as ExpressionNode;
        const value = this.expression_value(this.mark_code(expr.code, expr.code_loc));
        if (expr.nl2br) {
          parts.push(`jqhtml.escape_html_nl2br(${value} ?? '')`);
        } else if (expr.escaped) {
          parts.push(`jqhtml.escape_html(${value} ?? '')`);
        } else {
          parts.push(`String(${value} ?? '')`);
        }
      } else {
        // CODE_BLOCK and anything else: a raw tag's content is one flat string, so
        // there is nowhere for statements or control flow to push output to.
        const error = new JQHTMLParseError(
          `Invalid content in <${node.name}> tag`,
          node.line,
          node.column || 0,
          this.sourceContent,
          this.sourceFile
        );
        error.suggestion =
          `\n\nThe content of <textarea> and <pre> is a single block of text, so ` +
          `<% %> code blocks cannot be used inside it.\n\n` +
          `Allowed:\n` +
          `  <textarea><%= this.data.value %></textarea>  ← expressions OK\n` +
          `  <textarea>plain text</textarea>              ← plain text OK\n\n` +
          `Build the value in a code block before the tag and interpolate it:\n` +
          `  <% const body = cond ? a : b; %>\n` +
          `  <textarea><%= body %></textarea>`;
        throw error;
      }
    }

    return parts.length > 0 ? parts.join(' + ') : "''";
  }

  private generate_tag_open(node: HtmlTagNode): string {
    // Generate just the opening tag
    const attrs = this.generate_attributes_with_conditionals(node.attributes, node.conditionalAttributes);
    return `_output.p(${this.mark_node(node)}{tag: [${js_string(node.name)}, ${attrs}, ${node.selfClosing || false}]});`;
  }

  /**
   * The component name as it appears in a {comp: [...]} instruction: a string
   * literal for <Name>, or a render-time call for <{expression}> that
   * validates the value with the same rule as a literal tag and throws otherwise.
   */
  private comp_name_code(node: ComponentInvocationNode): string {
    // Parenthesised so <{a, b}> passes ONE argument (the comma expression's value)
    return node.dynamic
      ? `jqhtml.dynamic_component_name(${this.expression_code(this.mark_code(node.expression!, node.expression_loc).trim())})`
      : js_string(node.name);
  }

  /** Parameter name of the inline content function; a dynamic tag has no literal name to use. */
  private comp_fn_param(node: ComponentInvocationNode): string {
    return node.dynamic ? '_dynamic_component' : node.name;
  }

  // Generate attribute object including conditional attributes
  private generate_attributes_with_conditionals(
    attrs: Record<string, any>,
    conditionalAttrs?: import('./ast.js').ConditionalAttributeNode[]
  ): string {
    // If no conditional attributes, use simple object
    if (!conditionalAttrs || conditionalAttrs.length === 0) {
      return this.generate_attributes_object(attrs);
    }

    // We have conditional attributes - need to merge them at runtime
    const baseAttrs = this.generate_attributes_object(attrs);

    // Generate code that conditionally adds attributes
    let result = baseAttrs;

    for (const condAttr of conditionalAttrs) {
      const condAttrsObj = this.generate_attributes_object(condAttr.attributes);
      // Use Object.assign to merge conditional attributes
      result = `Object.assign({}, ${result}, (${this.mark_node(condAttr)}${condAttr.condition}) ? ${condAttrsObj} : {})`;
    }

    return result;
  }

  private generate_attributes_object(attrs: Record<string, any>): string {
    if (Object.keys(attrs).length === 0) {
      return '{}';
    }

    const entries = Object.entries(attrs).flatMap(([key, value]) => {
      // Convert 'tag' to '_tag' for component invocations
      const attrKey = key === 'tag' ? '_tag' : key;

      // Special handling for data-sid attribute (from $sid) - create scoped id
      // NOTE: Parser converts $sid="foo" → data-sid="foo" so we can distinguish from regular id
      // This generates: id="foo:PARENT_CID" data-sid="foo"
      // The :PARENT_CID scoping happens at runtime in instruction-processor.ts
      if (key === 'data-sid') {
        const id_entries: string[] = [];

        if (value && typeof value === 'object' && value.interpolated) {
          // Interpolated $sid like $sid="user<%= index %>"
          const parts = value.parts.map((part: any) => {
            if (part.type === 'text') {
              return this.escape_string(part.value);
            } else {
              // Parenthesise to preserve operator precedence:
              // "row_" + (i > 0 ? 'pos' : 'neg'), not "row_" + i > 0 ? 'pos' : 'neg'
              return this.expression_value(this.mark_code(part.value, part.loc));
            }
          });
          const base_id = parts.join(' + ');
          id_entries.push(`"id": ${base_id} + ":" + this._cid`);
          id_entries.push(`"data-sid": ${base_id}`);
        } else if (value && typeof value === 'object' && value.quoted) {
          // Quoted $sid like $sid="static"
          const base_id = this.escape_string(value.value);
          id_entries.push(`"id": ${base_id} + ":" + this._cid`);
          id_entries.push(`"data-sid": ${base_id}`);
        } else {
          // Simple $sid like $sid="username" or expression like $sid=someVar
          const base_id = this.escape_string(String(value));
          id_entries.push(`"id": ${base_id} + ":" + this._cid`);
          id_entries.push(`"data-sid": ${base_id}`);
        }

        return id_entries;
      }

      // A hand-written id is emitted exactly as written - no cid scoping (only $sid
      // is scoped, above). It takes the same paths as any other attribute, so an
      // interpolated id="x_<%= a || b %>" concatenates its parts like class="" does.

      // Check if this is an interpolated attribute value
      if (value && typeof value === 'object' && value.interpolated) {
        // Build concatenation expression
        const parts = value.parts.map((part: any) => {
          if (part.type === 'text') {
            return this.escape_string(part.value);
          } else {
            // Expression - wrap in parentheses to preserve operator precedence
            // This ensures "a" + (x ? 'b' : 'c') instead of "a" + x ? 'b' : 'c'
            return this.expression_value(this.mark_code(part.value, part.loc));
          }
        });
        return `${js_string(attrKey)}: ${parts.join(' + ')}`;
      }

      // Check if value is marked as quoted
      if (value && typeof value === 'object' && value.quoted) {
        // This was a quoted string in the source - always treat as string
        return `${js_string(attrKey)}: ${this.escape_string(value.value)}`;
      }

      // Check if it's a parenthesized expression: $attr=(expr)
      if (value && typeof value === 'object' && value.expression) {
        // It's an expression - output without quotes
        return `${js_string(attrKey)}: ${this.mark_code(value.value, value.loc)}`;
      }

      // Check if it's a bare identifier: $attr=identifier
      if (value && typeof value === 'object' && value.identifier) {
        // It's an identifier - output as JavaScript expression
        return `${js_string(attrKey)}: ${this.mark_code(value.value, value.loc)}`;
      }
      
      // Check if it's an event handler binding (data-__-on-*)
      if (key.startsWith('data-__-on-')) {
        // Handle based on whether value was quoted or not
        if (typeof value === 'object' && value !== null) {
          if (value.quoted) {
            // Was quoted: @click="handler" -> string literal
            return `${js_string(key)}: ${this.escape_string(value.value)}`;
          } else if (value.identifier || value.expression) {
            // Was unquoted: @click=this.handler -> JavaScript expression
            return `${js_string(key)}: ${value.value}`;
          }
        } else if (typeof value === 'string') {
          // Fallback for simple strings (backwards compatibility)
          return `${js_string(key)}: ${this.escape_string(value)}`;
        }
      }
      
      // Check if it's a data attribute ($foo or :binding)
      if (key.startsWith('data-')) {
        // Handle based on whether value was quoted or not
        if (typeof value === 'object' && value !== null) {
          if (value.quoted) {
            // Was quoted: $foo="bar" -> string literal
            return `${js_string(key)}: ${this.escape_string(value.value)}`;
          } else if (value.identifier || value.expression) {
            // Was unquoted: $foo=this.data.bar -> JavaScript expression
            return `${js_string(key)}: ${value.value}`;
          }
        } else if (typeof value === 'string') {
          // Fallback for simple strings
          return `${js_string(key)}: ${this.escape_string(value)}`;
        }
      }
      
      // Regular attributes
      if (typeof value === 'object' && value !== null) {
        if (value.quoted) {
          // Explicitly quoted value
          return `${js_string(attrKey)}: ${this.escape_string(value.value)}`;
        } else if (value.identifier || value.expression) {
          // Unquoted JavaScript expression
          return `${js_string(attrKey)}: ${value.value}`;
        }
      }
      // Default: treat as string
      return `${js_string(attrKey)}: ${this.escape_string(String(value))}`;
    });
    
    return `{${entries.join(', ')}}`;
  }
  
  /**
   * An interpolated expression's code as one parenthesised JavaScript expression,
   * for a position where an operator follows or precedes it (attribute and raw-tag
   * concatenation). A trailing `;` - accepted after any interpolated expression -
   * is dropped.
   */
  private expression_value(code: string): string {
    return `(${strip_trailing_semicolons(code).trim()})`;
  }

  /**
   * An interpolated expression's code as a single expression where it stands alone
   * (an initializer or a call's only argument): parenthesised when it is a comma
   * expression, so `<%= a, b %>` is the value of `a, b` (b) rather than
   * `const result = a, b;` and `<{a, b}>` passes ONE argument. A trailing `;` is
   * dropped.
   */
  private expression_code(code: string): string {
    const stripped = strip_trailing_semicolons(code);
    return has_top_level_comma(stripped) ? `(${stripped})` : stripped;
  }

  private escape_string(str: string): string {
    // A JavaScript string literal whose runtime value is exactly `str` (js_literal.ts)
    return js_string(str);
  }
  
  private indent(code: string, level: number): string {
    const indent = '  '.repeat(level);
    return code.split('\n').map(line => line ? indent + line : line).join('\n');
  }
  
  /**
   * Parameter list of a slot's function. $params="record, index" names them;
   * otherwise the single parameter is named after the slot, so a slot body can
   * read the value passed by content('row', record) as `row`.
   */
  private slot_params(slot: SlotNode): string {
    return slot.params && slot.params.length ? slot.params.join(', ') : slot.name;
  }

  private extract_slots_from_children(children: ASTNode[]): Record<string, SlotNode> {
    const slots: Record<string, SlotNode> = {};

    for (const child of children) {
      if (child.type === NodeType.SLOT) {
        const slotNode = child as SlotNode;
        slots[slotNode.name] = slotNode;
      }
    }

    return slots;
  }

  /**
   * Serialize attribute object with proper handling of identifiers and expressions
   * Quoted values become strings, identifiers/expressions become raw JavaScript
   */
  private serializeAttributeObject(obj: Record<string, any>): string {
    if (!obj || Object.keys(obj).length === 0) {
      return '{}';
    }

    const entries: string[] = [];
    for (const [key, value] of Object.entries(obj)) {
      // Check if value is a parsed attribute object with type info
      if (value && typeof value === 'object' && (value.identifier || value.expression)) {
        // Identifier or expression - output as raw JavaScript (no quotes)
        entries.push(`${js_string(key)}: ${value.value}`);
      } else if (value && typeof value === 'object' && value.quoted) {
        // Quoted string - output as string literal
        entries.push(`${js_string(key)}: ${js_string(value.value)}`);
      } else {
        // Simple value - output as-is via JSON.stringify
        entries.push(`${js_string(key)}: ${typeof value === 'string' ? js_string(value) : JSON.stringify(value)}`);
      }
    }

    return `{${entries.join(', ')}}`;
  }

  private build_module_code(): string {
    let code = '// Generated by JQHTML v2 Code Generator\n';
    code += '// Parser version: 2.2.56 (with 1:1 sourcemap fixes)\n';
    code += '// Produces v1-compatible instruction arrays\n\n';
    
    // Add html escaping function (assumed to be available in runtime)
    code += '// Runtime should provide: function html(str) { return escapeHtml(str); }\n\n';
    
    // Add component registration
    code += 'const jqhtml_components = new Map();\n\n';
    
    // Add each component
    for (const [name, component] of this.components) {
      code += `// Component: ${name}\n`;
      code += `jqhtml_components.set(${js_string_single(name)}, {\n`;
      code += `  _jqhtml_version: '__PARSER_VERSION__',\n`;  // Version will be replaced during build
      code += `  name: ${js_string_single(name)},\n`;
      code += `  tag: ${js_string_single(component.tagName)},\n`;
      code += `  defaultAttributes: ${this.serializeAttributeObject(component.defaultAttributes)},\n`;

      // Add defineArgs if present ($ attributes on Define tag)
      if (component.defineArgs) {
        code += `  defineArgs: ${this.serializeAttributeObject(component.defineArgs)},\n`;
      }

      // Add extends if present (template inheritance)
      if (component.extends) {
        code += `  extends: ${js_string_single(component.extends)},\n`;
      }

      code += `  render: ${this.indent(component.render_function, 1).trim()},\n`;
      code += `  dependencies: [${component.dependencies.map(d => js_string_single(d)).join(', ')}]\n`;
      code += '});\n\n';
    }
    
    // Add export
    code += 'export { jqhtml_components };\n';
    
    return code;
  }
}

// Helper function for standalone usage
export function generate(ast: ProgramNode, sourceFile?: string, sourceContent?: string): GeneratedCode {
  const generator = new CodeGenerator();
  return generator.generate(ast, sourceFile, sourceContent);
}

/**
 * Add a component's sourcemap segments to `map`, for its render function placed at
 * generated line `render_line` (1-based), starting at column `render_column` of that
 * line. Every render line gets a segment at column 0 - render line N is source line N,
 * so that is (N, 0), and line 1, the function header, maps to the <Define> tag -
 * followed by the segment of each node emitted on it.
 */
export function add_render_mappings(
  map: SourceMapGenerator,
  component: ComponentCode,
  source: string,
  render_line: number,
  render_column: number
): void {
  const line_count = component.render_function.split('\n').length;
  const by_line = new Map<number, RenderMapping[]>();
  for (const m of component.source_mappings) {
    const list = by_line.get(m.generated.line);
    if (list) list.push(m); else by_line.set(m.generated.line, [m]);
  }

  for (let line = 1; line <= line_count; line++) {
    const offset = line === 1 ? render_column : 0;
    const marks = by_line.get(line) || [];
    let previous: { line: number, column: number } | null = null;
    if (!marks.some((m) => m.generated.column + offset === 0)) {
      previous = line === 1 ? component.define_position : { line, column: 0 };
      map.addMapping({
        generated: { line: render_line + line - 1, column: 0 },
        source,
        original: previous
      });
    }
    for (const m of marks) {
      // A segment naming the same source position as the one before it on this line
      // adds nothing (lookups resolve to the earlier one anyway)
      if (!m.name && previous && previous.line === m.original.line && previous.column === m.original.column) {
        continue;
      }
      previous = m.original;
      map.addMapping({
        generated: { line: render_line + line - 1, column: m.generated.column + offset },
        source,
        original: m.original,
        name: m.name
      });
    }
  }
}
