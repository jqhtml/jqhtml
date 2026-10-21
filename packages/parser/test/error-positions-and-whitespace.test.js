/**
 * Compile errors point at the template position that caused them, with the file name,
 * and whitespace the author wrote is not lost or invented.
 *
 * Previously: lexer errors said `at <unknown>`; a JavaScript syntax error reported
 * column 0; an unclosed { in a <% %> block was reported on a later line at column 0;
 * an unterminated <%= or HTML comment was reported at the end of the file; text of
 * non-breaking spaces between slots was treated as whitespace and dropped; a
 * multi-line HTML comment had its newlines collapsed to spaces.
 */

import { compileTemplate, JQHTMLParseError } from '../dist/index.js';
import assert from 'assert';

function compile(source) {
  return compileTemplate(source, 'test.jqhtml', { format: 'cjs', sourcemap: false, version: '9.9.9' });
}

function compile_error(source) {
  try {
    compile(source);
  } catch (e) {
    return e;
  }
  assert.fail('expected the template to fail to compile:\n' + source);
}

function expect_error(source, first_line, line, column) {
  const e = compile_error(source);
  assert.ok(e instanceof JQHTMLParseError, String(e));
  assert.strictEqual(e.message.split('\n')[0], first_line);
  assert.strictEqual(e.line, line, 'line');
  assert.strictEqual(e.column, column, 'column');
  assert.ok(e.message.includes(`\nat test.jqhtml:${line}:${column}`), e.message);
}

const SYNTAX = (detail) => `JavaScript syntax error in component "T": ${detail}`;
const BRACKET = (detail) => `Unbalanced bracket error in component "T": ${detail}`;

describe('errors name the file', () => {
  it('a lexer error', () => {
    expect_error('<Define:T>\n<div title=a></div>\n</Define:T>', 'Regular HTML attributes must have quoted values.', 2, 12);
  });

  it('the this.innerHTML check, at the match', () => {
    expect_error('<Define:T>\n<p><%=   x + this.innerHTML %></p>\n</Define:T>',
      'Invalid usage: this.innerHTML is not available in JQHTML templates.', 2, 14);
    expect_error('<Define:T>\n<%= a +\n   this.innerHTML %>\n</Define:T>',
      'Invalid usage: this.innerHTML is not available in JQHTML templates.', 3, 4);
  });
});

describe('a JavaScript syntax error is reported at its template column', () => {
  it('in a <%= %> expression, not at the whitespace after <%=', () => {
    expect_error('<Define:T>\n<%=   a + ; %>\n</Define:T>', SYNTAX(`Unexpected token ';'`), 2, 12);
  });

  it('in a <% %> block', () => {
    expect_error('<Define:T>\n  <% let q = 1 2; %>\n</Define:T>', SYNTAX('Unexpected number'), 2, 16);
  });

  it('on a later line of a multi-line expression', () => {
    expect_error('<Define:T>\n<p><%= a +\n     b c %></p>\n</Define:T>', SYNTAX(`Unexpected identifier 'c'`), 3, 8);
  });

  it('in a slot of a slot-only template', () => {
    expect_error('<Define:T>\n<Slot:a><%= a.b( %></Slot:a>\n</Define:T>', SYNTAX(`Unexpected token ';'`), 2, 18);
  });

  it('on the <Define:> line', () => {
    expect_error('<Define:T><%= 1 2 %>\n</Define:T>', SYNTAX('Unexpected number'), 1, 17);
  });
});

describe('an unbalanced bracket in <% %> blocks is reported where it is', () => {
  it('an unclosed {', () => {
    expect_error('<Define:T>\n  <% if (x) { %>\n    <p>a</p>\n</Define:T>', BRACKET('{ at line 2, col 13 is never closed'), 2, 13);
  });

  it('the outer of two { when the inner one is closed', () => {
    expect_error('<Define:T>\n<% if (a) { %>\n<% if (b) { %>x<% } %>\n</Define:T>', BRACKET('{ at line 2, col 11 is never closed'), 2, 11);
  });

  it('an unclosed ( across blocks', () => {
    expect_error('<Define:T>\n<% items.forEach(x => { %>\n<p>a</p>\n<% } %>\n</Define:T>',
      BRACKET('( at line 2, col 17 is never closed'), 2, 17);
  });

  it('a } that closes nothing', () => {
    expect_error('<Define:T>\n<p>a</p>\n<% } %>\n</Define:T>', BRACKET('} at line 3, col 4 closes nothing that a <% %> block opened'), 3, 4);
  });

  it('a closer that does not match', () => {
    expect_error('<Define:T>\n<% if (a) { %>x<% ) %>\n</Define:T>', BRACKET(') at line 2, col 19 does not match { at line 2, col 11'), 2, 19);
  });

  it('a syntax error before the bracket goes wrong is reported instead', () => {
    // `if (a:` - V8 stops at the ':'; the scan would only notice at the later }
    expect_error('<Define:T>\n<% if (a: %>\n  <p>x</p>\n<% } %>\n</Define:T>', SYNTAX(`Unexpected token ':'`), 2, 9);
  });

  it('brackets in strings, comments and <%-- --%> comments do not count', () => {
    compile('<Define:T>\n<%-- <% { --%>\n<!-- <% ( -->\n<% let s = "{(["; /* { */ if (s) { %>x<% } %>\n</Define:T>');
  });
});

describe('an unterminated construct is reported where it opens', () => {
  it('<%=', () => {
    expect_error('<Define:T>\n<p><%= a </p>\n<p>x</p>\n</Define:T>', 'Syntax error: Unterminated <%= expression - expected %>', 2, 4);
  });

  it('<%!=', () => {
    expect_error('<Define:T>\n  <%!= a\n</Define:T>', 'Syntax error: Unterminated <%!= expression - expected %>', 2, 3);
  });

  it('<%= in an attribute value', () => {
    expect_error('<Define:T>\n<p title="<%= a"></p>\n</Define:T>', 'Syntax error: Unterminated <%= expression - expected %>', 2, 11);
  });

  it('an HTML comment', () => {
    expect_error('<Define:T>\n  <!-- a\n  <p>x</p>\n</Define:T>', 'Unterminated HTML comment - expected -->', 2, 3);
  });
});

describe('whitespace', () => {
  const MIXED_DEFINE = (line, col) => `Syntax error: Mixed content not allowed in <Define:T>: a template with slots overrides ` +
    `its parent's, so all content must be inside <Slot:slotname> tags (non-slot content at line ${line}, col ${col})`;

  it('non-breaking spaces between slots of a slot-only template are content', () => {
    expect_error('<Define:T>\n<Slot:a>x</Slot:a>  <Slot:b>y</Slot:b>\n</Define:T>', MIXED_DEFINE(2, 19), 2, 19);
  });

  it('non-breaking spaces between slots of an invocation are content', () => {
    expect_error('<Define:T>\n<Y><Slot:a>x</Slot:a> <Slot:b>y</Slot:b></Y>\n</Define:T>',
      'Syntax error: Mixed content not allowed: when using slots, all content must be inside <Slot:slotname> tags', 2, 1);
  });

  it('other content beside the slots of a <Define:> is the same error', () => {
    expect_error('<Define:T>\n<Slot:a>x</Slot:a>\n<% let q = 1; %>\n</Define:T>', MIXED_DEFINE(3, 1), 3, 1);
  });

  it('ordinary whitespace between slots keeps the template slot-only', () => {
    assert.ok(compile('<Define:T>\n<Slot:a>x</Slot:a> \t\n <Slot:b>y</Slot:b>\n</Define:T>').code.includes('_slots'));
  });

  it('an HTML comment keeps its newlines and spacing', () => {
    const { code } = compile('<Define:T>\n<!-- a\n     b  c -->\n<p>x</p>\n</Define:T>');
    assert.ok(code.includes('"<!-- a\\n     b  c -->"'), code);
  });

  it('a multi-line dynamic tag keeps later lines on their own source line', () => {
    const { code } = compile('<Define:T>\n<{a ||\n b} />\n<p>L4</p>\n</Define:T>');
    const lines = code.split('\n');
    const first = lines.findIndex((l) => l.includes('function render('));
    assert.ok(lines[first + 1].includes('dynamic_component_name(a ||  b)'), lines[first + 1]);
    assert.ok(lines[first + 3].includes('"L4"'), lines[first + 3]);
  });
});
