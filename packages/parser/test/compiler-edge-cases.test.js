/**
 * Compiler text and attribute edge cases, and multi-line expression preprocessing.
 *
 * - <%br= and any <% form other than <%= / <%!= inside an attribute value is a compile
 *   error with a position; interpolated text parts are never re-classified as code.
 * - Text whitespace handling collapses HTML whitespace only, never U+00A0.
 * - A trailing ; is accepted in attribute expressions; a suggestion prints once.
 * - A comma expression is one expression: <%= a, b %> and <{a, b}>.
 * - A slot name must be a JavaScript identifier.
 * - compileTemplate's fallback version is the package version.
 * - Token positions are token START positions.
 * - A multi-line <%= %> / <%br= %> emits no whitespace text, and preprocessing never
 *   touches the contents of strings, template literals or comments.
 */

import { Lexer, Parser, TokenType, compileTemplate, JQHTMLParseError } from '../dist/index.js';
import { join_lines, code_line_starts, strip_trailing_semicolons, has_top_level_comma } from '../dist/js_scanner.js';
import assert from 'assert';
import { Markup } from './markup-stub.js';
import fs from 'fs';
import vm from 'vm';

const PACKAGE_VERSION = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf-8')).version;

function compile(source, options = {}) {
  return compileTemplate(source, 'test.jqhtml', { format: 'cjs', sourcemap: false, version: '1.0.0', ...options }).code;
}

function compile_error(source) {
  try {
    compile(source);
  } catch (e) {
    return e;
  }
  assert.fail('expected the template to fail to compile:\n' + source);
}

function load(source) {
  const sandbox = { module: { exports: {} } };
  vm.runInNewContext(compile(source), sandbox);
  return sandbox.module.exports;
}

// Render against a stub component; `scope` provides free variables used by the template.
function render(source, scope = {}) {
  const template = load(source);
  const calls = [];
  const jqhtml = {
    Markup,
    escape_html: (s) => String(s),
    escape_html_nl2br: (s) => String(s).replace(/\n/g, '<br />'),
    print_object: () => '',
    dynamic_component_name: (...args) => { calls.push(args); return String(args[0]); }
  };
  const stub = { args: {}, data: {}, _cid: 'CID', ...scope };
  const output = template.render.call(stub, stub.data, stub.args, null, jqhtml).instructions;
  return { output, calls, template };
}

// Instruction strings, as a plain array of this realm (the render ran in a vm context)
const strings = (output) => JSON.parse(JSON.stringify(output.filter((i) => typeof i === 'string')));

const tag_attrs = (output, name) => output.find((i) => i && i.tag && i.tag[0] === name).tag[1];

describe('<% forms inside attribute values', () => {
  it('<%br= in an attribute value is an error at the <%br=', () => {
    const e = compile_error('<Define:T>\n  <b title="a<%br= x %>b">z</b>\n</Define:T>');
    assert.strictEqual(e.message.split('\n')[0], '<%br= is not allowed in attribute values; use <%= %>');
    assert.strictEqual(e.line, 2);
    assert.strictEqual(e.column, 14);
  });

  it('<%br= as the whole attribute value is an error, not raw JavaScript', () => {
    const e = compile_error('<Define:T><b title="<%br= x %>">z</b></Define:T>');
    assert.strictEqual(e.message.split('\n')[0], '<%br= is not allowed in attribute values; use <%= %>');
    assert.strictEqual(e.column, 21);
  });

  it('an unknown <% form is an error, not literal text', () => {
    const e = compile_error('<Define:T>\n  <b title="a<%-x%>b">z</b>\n</Define:T>');
    assert.strictEqual(e.message.split('\n')[0],
      'Unknown template tag <%- in attribute value; only <%= %> and <%!= %> are allowed in attribute values');
    assert.strictEqual(e.line, 2);
    assert.strictEqual(e.column, 14);
  });

  it('an unknown <% form as the whole value is an error, not raw JavaScript', () => {
    const e = compile_error('<Define:T><b title="<%foo%>">z</b></Define:T>');
    assert.strictEqual(e.message.split('\n')[0],
      'Unknown template tag <%f in attribute value; only <%= %> and <%!= %> are allowed in attribute values');
  });

  it('a bare <% before the closing quote is an error', () => {
    const e = compile_error('<Define:T><b title="100<%">z</b></Define:T>');
    assert.strictEqual(e.message.split('\n')[0],
      'Unknown template tag <% in attribute value; only <%= %> and <%!= %> are allowed in attribute values');
    assert.strictEqual(e.column, 24);
  });

  it('interpolated text parts are marked and never classified as identifiers or expressions', () => {
    const source = '<Define:T><b title="a(b)<%= c %>"></b></Define:T>';
    const tokens = new Lexer(source).tokenize();
    const text = tokens.find((t) => t.type === TokenType.ATTR_VALUE);
    assert.strictEqual(text.value, 'a(b)');
    assert.strictEqual(text.interpolation_text, true);
    // Leave only the text part: the parser must still treat it as text
    const i = tokens.indexOf(text);
    tokens.splice(i + 1, 3); // <%=, JAVASCRIPT, %>
    const ast = new Parser(tokens, source, 'test.jqhtml').parse();
    const b = ast.body[0].body[0];
    assert.deepStrictEqual(b.attributes.title, { interpolated: true, parts: [{ type: 'text', value: 'a(b)', escaped: true }] });
  });
});

describe('non-breaking spaces in text', () => {
  it('U+00A0 is not collapsed or trimmed as whitespace', () => {
    const { output } = render('<Define:T><p>a  b </p><p> c  \t d\n</p></Define:T>');
    assert.ok(output.includes('a  b '), JSON.stringify(output));
    assert.ok(output.includes(' c d '), JSON.stringify(output));
  });
});

describe('trailing semicolons and suggestions', () => {
  it('title="<%= x; %>" compiles like the body form', () => {
    const { output } = render('<Define:T><b title="<%= this.v; %>" data-x="a<%= this.v;; %>b"><%= this.v; %></b></Define:T>', { v: 'V' });
    assert.strictEqual(tag_attrs(output, 'b').title, 'V');
    assert.strictEqual(tag_attrs(output, 'b')['data-x'], 'aVb');
    assert.ok(output.includes('V'));
  });

  it('a trailing ; inside a string or after a comment is handled', () => {
    assert.strictEqual(strip_trailing_semicolons(' x; /* c */ '), ' x /* c */ ');
    assert.strictEqual(strip_trailing_semicolons("'a;'"), "'a;'");
    assert.strictEqual(strip_trailing_semicolons('x;;'), 'x');
  });

  it('an automatic suggestion appears once in the message', () => {
    const e = compile_error('<Define:T>\n<Card>\n<Slot:x>\n</Define:T>');
    const suggestion = 'Did you mean to use a self-closing slot?';
    assert.strictEqual(e.message.split(suggestion).length - 1, 1, e.message);
    const e2 = compile_error('<Define:T>\n<p>x</p>\n');
    const s2 = 'Did you forget the closing </Define:ComponentName> tag?';
    assert.strictEqual(e2.message.split(s2).length - 1, 1, e2.message);
  });

  it('a suggestion assigned after construction replaces the automatic one in the message', () => {
    const e = new JQHTMLParseError('Unclosed slot: x', 1, 1, 'a', 'f.jqhtml');
    e.suggestion = '\nCUSTOM';
    assert.ok(e.message.endsWith('\nCUSTOM'), e.message);
    assert.ok(!e.message.includes('self-closing slot'), e.message);
  });
});

describe('comma expressions', () => {
  it('<%= a, b %> renders the value of the comma expression', () => {
    const { output } = render('<Define:T><b><%= this.a, this.b %></b><%!= 1, "<i>" %><%br= 0, "x\\ny" %></Define:T>', { a: 'A', b: 'B' });
    assert.deepStrictEqual(strings(output), ['B', '</b>', '<i>', 'x<br />y']);
  });

  it('a comma expression in an attribute', () => {
    const { output } = render('<Define:T><b title="<%= 1, 2 %>" class="c<%= 1, 2 %>"></b></Define:T>');
    assert.strictEqual(tag_attrs(output, 'b').title, 2);
    assert.strictEqual(tag_attrs(output, 'b').class, 'c2');
  });

  it('<{a, b}> passes ONE argument to dynamic_component_name', () => {
    const { calls } = render('<Define:T><{this.a, this.b} /></Define:T>', { a: 'A', b: 'B' });
    assert.deepStrictEqual(calls, [['B']]);
  });

  it('a comma inside brackets or a literal is not a comma expression', () => {
    assert.strictEqual(has_top_level_comma('f(a, b)'), false);
    assert.strictEqual(has_top_level_comma("'a, b'"), false);
    assert.strictEqual(has_top_level_comma('a, b'), true);
    assert.ok(compile('<Define:T><{this.pick(1, 2)} /></Define:T>').includes('jqhtml.dynamic_component_name(this.pick(1, 2))'));
  });
});

describe('slot names', () => {
  it('a slot name starting with a digit is rejected', () => {
    const e = compile_error('<Define:T>\n<Card><Slot:1row>x</Slot:1row></Card>\n</Define:T>');
    assert.strictEqual(e.message.split('\n')[0],
      'Syntax error: Slot name "1row" is not a valid JavaScript identifier: a slot name must start with a letter or underscore');
    assert.strictEqual(e.line, 2);
    assert.strictEqual(e.column, 13);
  });
});

describe('version stamp', () => {
  it('compileTemplate without a version uses the package version', () => {
    const code = compileTemplate('<Define:T><p>x</p></Define:T>', 't.jqhtml', { format: 'cjs', sourcemap: false }).code;
    assert.ok(code.includes(`_jqhtml_version: '${PACKAGE_VERSION}'`), code);
    assert.ok(!code.includes('__PARSER_VERSION__'));
  });
});

describe('token positions', () => {
  it('every token records its start line and column', () => {
    const tokens = new Lexer('<div title="x">\n  hi <%= a %></div>').tokenize();
    const at = (type, value) => {
      const t = tokens.find((k) => k.type === type && (value === undefined || k.value === value));
      return [t.line, t.column, t.loc.start.line, t.loc.start.column, t.loc.end.line, t.loc.end.column];
    };
    assert.deepStrictEqual(at(TokenType.TAG_OPEN), [1, 1, 1, 1, 1, 2]);
    assert.deepStrictEqual(at(TokenType.TAG_NAME, 'div'), [1, 2, 1, 2, 1, 5]);
    assert.deepStrictEqual(at(TokenType.ATTR_NAME), [1, 6, 1, 6, 1, 11]);
    assert.deepStrictEqual(at(TokenType.ATTR_VALUE), [1, 12, 1, 12, 1, 15]);
    assert.deepStrictEqual(at(TokenType.GT), [1, 15, 1, 15, 1, 16]);
    assert.deepStrictEqual(at(TokenType.NEWLINE), [1, 16, 1, 16, 2, 1]);
    assert.deepStrictEqual(at(TokenType.TEXT), [2, 1, 2, 1, 2, 6]);
    assert.deepStrictEqual(at(TokenType.EXPRESSION_START), [2, 6, 2, 6, 2, 9]);
    assert.deepStrictEqual(at(TokenType.TAG_END), [2, 12, 2, 12, 2, 14]);
    assert.deepStrictEqual(at(TokenType.TAG_CLOSE), [2, 14, 2, 14, 2, 16]);
  });

  it('a parser error points at the start of the offending token', () => {
    const e = compile_error('<Define:bad_name></Define:bad_name>');
    assert.strictEqual(e.column, 9);
    const e2 = compile_error('<Define:T>\n  <div><%= this.innerHTML %></div></Define:T>');
    assert.deepStrictEqual([e2.line, e2.column], [2, 12]);  // the t of this.innerHTML, not the space after <%=
  });

  it('a strict-tag error after a code block with blank lines keeps its position', () => {
    const e = compile_error('<Define:T>\n<% let a = 1;\n\n\nlet b = 2; %>\n<b></i>\n</Define:T>');
    assert.strictEqual(e.message.split('\n')[0], 'Closing </i> does not match open <b> (line 6, col 4); <b> was opened at line 6, col 1');
    assert.deepStrictEqual([e.line, e.column], [6, 4]);
  });

  it('positions after a multi-line HTML comment are not shifted', () => {
    const e = compile_error('<Define:T>\n<!-- a\nb -->\n  <p title=foo></p></Define:T>');
    assert.strictEqual(e.message.split('\n')[0], 'Regular HTML attributes must have quoted values.');
    assert.deepStrictEqual([e.line, e.column], [4, 12]);
  });
});

describe('multi-line expressions', () => {
  it('a multi-line <%= %> emits no whitespace text after it', () => {
    const { output } = render("<Define:T><b><%= 'x'\n%></b><i><%!= 'y'\n\n%></i><u><%br= 'z'\n%></u></Define:T>");
    assert.deepStrictEqual(strings(output), ['x', '</b>', 'y', '</i>', 'z', '</u>']);
  });

  it('a multi-line <%= %> in an attribute value is a compile error', () => {
    assert.throws(() => render("<Define:T><b title=\"<%= 'y'\n  %>\"></b></Define:T>"),
      /A <%= %> expression in an attribute value must be on one line/);
  });

  it('a template literal spanning lines in <%= %> keeps its newlines', () => {
    const { output } = render('<Define:T><b><%= `a\n\n  b` %></b></Define:T>');
    assert.ok(output.includes('a\n\n  b'), JSON.stringify(output));
  });

  it('keeps one generated line per source line', () => {
    const source = "<Define:T>\n<b><%= 'x' +\n  'y'\n%></b>\n<%br= 'a'\n\n%>\n</Define:T>";
    const { template } = render(source);
    assert.strictEqual(template.render.toString().split('\n').length, source.split('\n').length);
  });

  it('a template literal with blank and whitespace-only lines in <% %> is intact', () => {
    const literal = 'one\n\n  two\n    \nthree';
    const { output } = render('<Define:T>\n<% const s = `' + literal + '`; %><b><%= s %></b>\n</Define:T>');
    assert.ok(output.includes(literal), JSON.stringify(output));
  });

  it('a block comment with a blank line in <% %> is not broken by a placeholder', () => {
    const { output } = render('<Define:T>\n<% /* a\n\n b */ const s = 1; %><b><%= s %></b>\n</Define:T>');
    assert.ok(output.includes('1'), JSON.stringify(output));
  });
});

describe('scanner helpers', () => {
  it('join_lines keeps literal values and joins code', () => {
    assert.strictEqual(join_lines('a +\n b'), 'a +  b');
    assert.strictEqual(join_lines('`x\ny`'), '`x\\ny`');
    assert.strictEqual(join_lines("'x\\\ny'"), "'xy'");
    assert.strictEqual(join_lines('`${a +\n b}`'), '`${a +  b}`');
  });

  it('code_line_starts marks lines inside literals and comments', () => {
    assert.deepStrictEqual(code_line_starts('a\n`b\n\nc`\nd'), [true, true, false, false, true]);
    assert.deepStrictEqual(code_line_starts('/* a\nb */\nc'), [true, false, true]);
  });
});
