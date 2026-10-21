/**
 * Parse errors for unclosed and mismatched structure, AST node positions, and
 * ErrorCollector.
 *
 * Ported from the standalone scripts test/test-error-handling.js, test/test-ast-positions.js
 * and tests/integration/test-error-reporting.js, which jest never ran: they used the
 * retired `<% if (x): %> ... <% endif; %>` and `<#slot>` syntax and printed results
 * without asserting them. The cases strict-tags.test.js and compiler-edge-cases.test.js
 * already cover (stray closing tags, <b></i>, token positions) are not repeated here.
 */

import { parse, compileTemplate, JQHTMLParseError, ErrorCollector } from '../dist/index.js';
import assert from 'assert';

function parse_error(source) {
  try {
    parse(source, 'test.jqhtml');
  } catch (e) {
    return e;
  }
  assert.fail('expected the template to fail to parse:\n' + source);
}

function expect_error(source, first_line, line, column) {
  const e = parse_error(source);
  assert.ok(e instanceof JQHTMLParseError, 'a JQHTMLParseError, got ' + (e && e.constructor && e.constructor.name));
  assert.strictEqual(e.message.split('\n')[0], first_line);
  assert.deepStrictEqual([e.line, e.column], [line, column]);
  assert.strictEqual(e.filename, 'test.jqhtml');
}

describe('unclosed and mismatched structure', () => {
  it('a <Define:> that is never closed names the component at its opening tag', () => {
    expect_error('<Define:User_Card>\n  <div class="card">\n    <h2><%= this.data.name %></h2>\n  </div>',
      'Unclosed component definition: User_Card', 1, 9);
  });

  it('a </Define:> closing a different name is a mismatch at the closing tag', () => {
    expect_error('<Define:User_Card>\n  <div>Content</div>\n</Define:Admin_Card>',
      'Mismatched tags: expected </Define:User_Card>, found </Define:Admin_Card>', 3, 10);
  });

  it('an HTML element left open when the definition closes is reported at the element', () => {
    expect_error('<Define:Page>\n  <div class="container">\n    <h1>Welcome</h1>\n    <p>never closed\n</Define:Page>',
      'Unclosed tag: p (line 4, col 5); </Define:Page> (line 5, col 1) closes an enclosing element first', 4, 5);
  });

  it('a component invocation left open is reported at the invocation', () => {
    expect_error('<Define:Test>\n  <div>\n    <My_Component>\n      <p>Content</p>\n  </div>\n</Define:Test>',
      'Unclosed component: My_Component (line 3, col 5); </div> (line 5, col 3) closes an enclosing element first', 3, 5);
  });

  it('a <Slot:> left open is reported at the slot', () => {
    expect_error('<Define:Card>\n  <Box>\n  <Slot:header>\n    <h1>Title</h1>\n  </Box>\n</Define:Card>',
      'Unclosed slot: header (line 3, col 3); </Box> (line 5, col 3) closes an enclosing element first', 3, 3);
  });

  it('a slot closed with a different slot name is a mismatch', () => {
    expect_error('<Define:Card>\n  <Box>\n  <Slot:header>\n    <h1>Title</h1>\n  </Slot:footer>\n  </Box>\n</Define:Card>',
      'Mismatched tags: expected </header>, found </footer>', 5, 10);
  });

  it('loose content beside <Slot:> children is rejected', () => {
    expect_error('<Define:Test>\n  <Box>\n    <Slot:header><h1>H</h1></Slot:header>\n    <p>loose</p>\n  </Box>\n</Define:Test>',
      'Syntax error: Mixed content not allowed: when using slots, all content must be inside <Slot:slotname> tags', 2, 3);
  });

  it('an expression with no closing %> is reported where it opens', () => {
    const e = parse_error('<Define:Test>\n  <%= this.data.value\n  <p>Next content</p>\n</Define:Test>');
    assert.ok(e instanceof JQHTMLParseError);
    assert.strictEqual(e.message.split('\n')[0], 'Syntax error: Unterminated <%= expression - expected %>');
    assert.strictEqual(e.line, 2);
    assert.strictEqual(e.column, 3);
  });

  it('a code block that opens { and never closes it fails to compile', () => {
    let error = null;
    try {
      compileTemplate('<Define:Test>\n  <% if (x) { %>\n    <p>a</p>\n</Define:Test>', 'test.jqhtml', { format: 'iife', sourcemap: false });
    } catch (e) {
      error = e;
    }
    assert.ok(error instanceof JQHTMLParseError, 'compileTemplate must reject it');
    assert.strictEqual(error.message.split('\n')[0],
      'Unbalanced bracket error in component "Test": { at line 2, col 13 is never closed');
    assert.strictEqual(error.line, 2);
    assert.strictEqual(error.column, 13);
  });

  it('a well-formed template with brace control flow parses', () => {
    const ast = parse(`<Define:User_Card>
  <div class="card">
    <% if (this.data.active) { %>
      <span class="badge">Active</span>
    <% } %>
    <h2><%= this.data.name %></h2>
    <% for (const tag of this.data.tags) { %>
      <span class="tag"><%= tag %></span>
    <% } %>
  </div>
</Define:User_Card>`, 'valid.jqhtml');
    assert.strictEqual(ast.body[0].type, 'ComponentDefinition');
    assert.strictEqual(ast.body[0].name, 'User_Card');
  });
});

describe('AST node positions', () => {
  const source = '<Define:T>\n  <div>Hello</div>\n  <%= this.data.v %>\n  <% let a = 1; %>\n    <span>y</span>\n  <Child $x=1 />\n</Define:T>';
  const definition = parse(source).body[0];
  const first = (type) => definition.body.find((n) => n.type === type);
  const at = (node) => [node.line, node.column, node.loc.start.line, node.loc.start.column, node.start];

  it('the definition starts at line 1, column 1', () => {
    assert.deepStrictEqual([definition.type, definition.line, definition.column], ['ComponentDefinition', 1, 1]);
  });

  it('each node records its line, column, loc and source offset', () => {
    const tags = definition.body.filter((n) => n.type === 'HtmlTag');
    const offset = (text) => source.indexOf(text);
    assert.deepStrictEqual(at(tags[0]), [2, 3, 2, 3, offset('<div>')]);
    assert.deepStrictEqual(at(first('Expression')), [3, 3, 3, 3, offset('<%=')]);
    assert.deepStrictEqual(at(first('CodeBlock')), [4, 3, 4, 3, offset('<% let')]);
    assert.deepStrictEqual(at(tags[1]), [5, 5, 5, 5, offset('<span>')]);
    assert.deepStrictEqual(at(first('ComponentInvocation')), [6, 3, 6, 3, offset('<Child')]);
  });

  it('the offsets index the node in the source', () => {
    assert.strictEqual(source.slice(first('Expression').start, first('Expression').end), '<%= this.data.v %>');
    assert.strictEqual(source.slice(first('ComponentInvocation').start, first('ComponentInvocation').end), '<Child $x=1 />');
  });
});

describe('ErrorCollector', () => {
  const error = (message, line) => new JQHTMLParseError(message, line, 1, 'a\nb\nc', 'collector.jqhtml');

  it('collects errors up to its limit', () => {
    const collector = new ErrorCollector(2);
    assert.strictEqual(collector.hasErrors(), false);
    collector.add(error('first', 1));
    collector.add(error('second', 2));
    collector.add(error('third', 3));
    assert.strictEqual(collector.hasErrors(), true);
    assert.deepStrictEqual(collector.getErrors().map((e) => e.line), [1, 2]);
  });

  it('throwIfErrors() does nothing when empty, rethrows a single error, and combines several', () => {
    const collector = new ErrorCollector();
    collector.throwIfErrors();
    const only = error('only', 1);
    collector.add(only);
    assert.throws(() => collector.throwIfErrors(), (e) => e === only);
    collector.add(error('another', 2));
    assert.throws(() => collector.throwIfErrors(), /^Error: Found 2 errors:\n\nError 1: only/);
  });
});
