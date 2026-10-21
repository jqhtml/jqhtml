/**
 * Three template rules the compiler enforces:
 *
 * - No script text. A template compiles to JavaScript that may be inlined in an HTML
 *   <script> block, so `<script` or `</script` anywhere it is emitted is a compile
 *   error, and so is tag="script"/"style" on a <Define:> or a component.
 * - Plain attributes take quoted values, on every tag, <Define:> included. A
 *   parenthesised value used to skip that rule: <div title=(x)> evaluated x and
 *   <Define:X title=(x)> stored the text "x". Only $ and @ attributes take JavaScript.
 * - A <%= %> or <%!= %> expression inside a quoted attribute value stays on one line;
 *   a $ arg that needs more uses the bracketed form, $arg=( ... ).
 */

import { compileTemplate } from '../dist/index.js';
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

describe('script text is a compile error', () => {
  const SCRIPT = (text) => `${text} is not allowed in a JQHTML template.`;
  const cases = [
    ['a <script> element', '<Define:T>\n  <script>run()</script>\n</Define:T>', '<script', 2, 3],
    ['an upper-case element', '<Define:T>\n<SCRIPT></SCRIPT>\n</Define:T>', '<SCRIPT', 2, 1],
    ['a stray closing tag in text', '<Define:T>\n  a </script> b\n</Define:T>', '</script', 2, 5],
    ['an attribute value', '<Define:T>\n<div title="x </Script> y"></div>\n</Define:T>', '</Script', 2, 15],
    ['a $ arg', '<Define:T>\n<Y $a="</script>" />\n</Define:T>', '</script', 2, 8],
    ['a string in a <% %> block', '<Define:T>\n<% let s = "</script>"; %>\n</Define:T>', '</script', 2, 13],
    ['a string in a <%= %> expression', '<Define:T>\n<%= "<script>" %>\n</Define:T>', '<script', 2, 6],
    ['an HTML comment inside the definition', '<Define:T>\n<!-- </script> -->\n</Define:T>', '</script', 2, 6],
    ['a <Define:> attribute', '<Define:T title="</script>">\n</Define:T>', '</script', 1, 18],
  ];
  for (const [label, source, text, line, column] of cases) {
    it(label, () => {
      const e = compile_error(source);
      assert.ok(e.message.startsWith(SCRIPT(text)), e.message.split('\n')[0]);
      assert.strictEqual(e.line, line);
      assert.strictEqual(e.column, column);
    });
  }

  it('the error suggests splitting a string that must contain the text', () => {
    const e = compile_error('<Define:T>\n<% let s = "</script>"; %>\n</Define:T>');
    assert.ok(e.message.includes(`'<' + '/script>'`), e.message);
  });

  it('a <%-- --%> comment is never emitted, so it may mention </script>', () => {
    compile('<%-- docs: no <script> here --%>\n<Define:T>\n  <%-- </script> --%>\n  <p>x</p>\n</Define:T>');
  });

  it('the word script, and a split string, compile', () => {
    const { code } = compile(`<Define:T>\n<p>a script b</p>\n<%= '<' + '/script>' %>\n</Define:T>`);
    assert.ok(!/<\/?script/i.test(code));
  });

  for (const [label, source, line, column] of [
    ['tag="script" on <Define:>', '<Define:T\n  tag="script">\n</Define:T>', 2, 3],
    ['tag="STYLE" on <Define:>', '<Define:T tag="STYLE">\n</Define:T>', 1, 11],
    ['tag="script" on a component', '<Define:T>\n  <Y tag="script" />\n</Define:T>', 2, 4],
    ['tag="style" on <Redrawable>', '<Define:T>\n<Redrawable tag=" style "></Redrawable>\n</Define:T>', 2, 2],
  ]) {
    it(`${label} is a compile error`, () => {
      const e = compile_error(source);
      assert.match(e.message.split('\n')[0], /^Syntax error: tag="\s*(script|style|STYLE)\s*" is not allowed: <script> and <style> elements cannot appear in JQHTML templates$/);
      assert.strictEqual(e.line, line);
      assert.strictEqual(e.column, column);
    });
  }

  it('tag="script" on a plain HTML element is only an attribute', () => {
    compile('<Define:T>\n<div tag="script"></div>\n</Define:T>');
  });

  it('a <style> element is still a compile error', () => {
    const e = compile_error('<Define:T>\n<style>p{}</style>\n</Define:T>');
    assert.match(e.message.split('\n')[0], /^Syntax error: <style> tags are not allowed/);
  });
});

describe('plain attribute values must be quoted on every tag', () => {
  const QUOTED = 'Regular HTML attributes must have quoted values.';
  for (const [label, source, line, column] of [
    ['a parenthesised value on <Define:>', '<Define:T title=(a + b)>\n</Define:T>', 1, 17],
    ['a parenthesised value on an HTML tag', '<Define:T>\n<div title=(a + b)></div>\n</Define:T>', 2, 12],
    ['a parenthesised value on a component', '<Define:T>\n<Y title=(a) />\n</Define:T>', 2, 10],
    ['a bare value on <Define:>', '<Define:T title=a>\n</Define:T>', 1, 17],
    ['a bare value on an HTML tag', '<Define:T>\n<div title=a></div>\n</Define:T>', 2, 12],
  ]) {
    it(`${label} is a compile error`, () => {
      const e = compile_error(source);
      assert.strictEqual(e.message.split('\n')[0], QUOTED);
      assert.strictEqual(e.line, line);
      assert.strictEqual(e.column, column);
    });
  }

  it('the suggestion shows the parenthesised form as the wrong one', () => {
    const e = compile_error('<Define:T title=(a)>\n</Define:T>');
    assert.ok(e.message.includes('✗ Wrong:   title=(expression)'), e.message);
  });

  it('$ and @ attributes still take a parenthesised JavaScript value', () => {
    const { code } = compile('<Define:T $size=(1 + 2)>\n<Y $mode=(a ? "x" : "y") />\n<b @click=(e => go(e))></b>\n</Define:T>');
    assert.ok(code.includes('1 + 2'));
    assert.ok(code.includes('a ? "x" : "y"'));
    assert.ok(code.includes('e => go(e)'));
  });

  it('a quoted value on <Define:> is the default attribute string', () => {
    const { code } = compile('<Define:T title="a + b">\n</Define:T>');
    assert.ok(code.includes('"title": "a + b"') || code.includes('"title":"a + b"'), code);
  });
});

describe('a <%= %> expression in a quoted attribute value stays on one line', () => {
  const ONE_LINE = (open) => `A ${open} %> expression in an attribute value must be on one line`;
  const cases = [
    ['a regular attribute', '<Define:T>\n<b title="<%= a +\n  b %>">x</b>\n</Define:T>', '<%=', 2, 11],
    ['a $ arg', '<Define:T>\n  <Y $options="<%= JSON.stringify([\n    1,\n  ]) %>" />\n</Define:T>', '<%=', 2, 16],
    ['an unescaped <%!= %>', '<Define:T>\n<b data-x="a <%!= b\n%> c">x</b>\n</Define:T>', '<%!=', 2, 14],
    ['a conditional attribute', '<Define:T>\n<b <% if (y) { %>title="<%= a\n%>"<% } %>>x</b>\n</Define:T>', '<%=', 2, 25],
  ];
  for (const [label, source, open, line, column] of cases) {
    it(label, () => {
      const e = compile_error(source);
      assert.ok(e.message.startsWith(ONE_LINE(open)), e.message.split('\n')[0]);
      assert.strictEqual(e.line, line);
      assert.strictEqual(e.column, column);
    });
  }

  it('a $ arg is shown the bracketed form, which may span lines', () => {
    const e = compile_error('<Define:T>\n<Y $options="<%= f(\n1) %>" />\n</Define:T>');
    assert.ok(e.message.includes('✓ Correct: $options=(JSON.stringify(['), e.message);
    const { code } = compile('<Define:T>\n<Y $options=(f(\n1)) />\n</Define:T>');
    assert.ok(/"\$options": f\(\s*1\)/.test(code), code);
  });

  it('a regular attribute is shown a <% %> block', () => {
    const e = compile_error('<Define:T>\n<b title="<%= a\n%>">x</b>\n</Define:T>');
    assert.ok(e.message.includes('<% const full_name = this.data.first + this.data.last; %>'), e.message);
  });

  it('literal text in the value may still span lines, and so may content expressions', () => {
    compile('<Define:T>\n<b title="a\nb <%= x %> c\nd">x</b>\n<p><%= x +\n  y %></p>\n</Define:T>');
  });

  it('an expression with no %> is still reported as unterminated', () => {
    const e = compile_error('<Define:T>\n<b title="<%= a\n">x</b>\n</Define:T>');
    assert.ok(/Unterminated <%= expression/.test(e.message), e.message.split('\n')[0]);
  });
});
