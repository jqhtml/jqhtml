/**
 * Template-level tests for JS regions: trailing // comments, regex literals and
 * %> inside literals, through the whole lexer -> parser -> codegen pipeline.
 *
 * Each case was a defect of the compiler's former per-site scanners, which
 * disagreed on comments, regexes and template literals:
 * - a // comment in <%= %> was scanned past its own line and swallowed later markup
 * - a ' or " inside a regex literal opened a phantom string
 * - /\// was read as a // comment
 * - a trailing // comment in <% %> commented out the generated code that followed
 *   on the same line (codegen joins a source line's nodes onto one line)
 *
 * The rule: a // comment runs to the end of its line, so a %> inside it never
 * closes the tag, and a compile error names each such %> that looks like a close.
 */

import { Lexer, Parser, CodeGenerator, compileTemplate, parse } from '../dist/index.js';
import assert from 'assert';
import { Markup } from './markup-stub.js';

function compile(template) {
  const lexer = new Lexer(template);
  const parser = new Parser(lexer.tokenize(), template, 'test.jqhtml');
  return new CodeGenerator().generate(parser.parse());
}

const jqhtml = {
  Markup,
  escape_html: v => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
  print_object: v => JSON.stringify(v)
};

// Compile one component and render it to an HTML string (args available as this.args)
function render(body, args = {}) {
  const result = compile(`<Define:T>\n${body}\n</Define:T>`);
  const component = result.components.get('T');
  const fn = new Function('return ' + component.render_function)();
  const output = fn.call({ args, data: {}, _cid: 'c1' }, {}, args, null, jqhtml).instructions;
  return output.map(item => {
    if (typeof item === 'string') return item;
    if (item && item.tag) return `<${item.tag[0]}>`;
    throw new Error('unexpected instruction ' + JSON.stringify(item));
  }).join('').trim();
}

describe('A // comment runs to the end of its line in <%= %>', () => {
  it('a %> inside the comment does not close the expression; the next line does', () => {
    const html = render(`<b><%= this.args.a // label %> not a close\n%></b>\n<p><%= 1 %></p>`, { a: 'A' });
    assert.strictEqual(html.replace(/\s+</g, '<'), '<b>A</b><p>1</p>');
  });

  it('inside an attribute interpolation it hides the %>, and the expression may not continue on the next line', () => {
    assert.throws(() => compile(`<Define:T>\n<b title="<%= this.args.a // c %>\n%>">x</b>\n</Define:T>`),
      (e) => /must be on one line/.test(e.message) && /use \/\* \*\/ instead/.test(e.message));
  });

  it('a /* */ comment works inside an attribute interpolation', () => {
    const result = compile(`<Define:T>\n<b title="<%= this.args.a /* c */ %>">x</b>\n</Define:T>`);
    assert.ok(result.components.get('T').render_function.includes('this.args.a'));
  });

  it('applies to <%!= %>', () => {
    const html = render(`<b><%!= this.args.a // raw %>\n%></b>`, { a: '<i>A</i>' });
    assert.strictEqual(html.replace(/\s+</g, '<'), '<b><i>A</i></b>');
  });
});

describe('A // comment runs to the end of its line in <% %>', () => {
  it('<% foo(); // <% blah %> does not close on that line', () => {
    assert.strictEqual(render(`<% let a = 1; // <% blahadf %>\n%><b><%= a %></b>`), '<b>1</b>');
  });

  it('<% foo(); // hello %> does not close on that line', () => {
    assert.strictEqual(render(`<% let a = 2; // hello %>\n%><b><%= a %></b>`), '<b>2</b>');
  });

  it('a comment line inside a multi-line block may mention <% %>', () => {
    assert.strictEqual(
      render(`<%\n  // never put <% %> control-flow\n  let n = 3;\n%><b><%= n %></b>`),
      '<b>3</b>'
    );
  });

  it('closing on the next line keeps the markup that follows', () => {
    assert.strictEqual(render(`<% let x = 1; // note\n%> <b>hi</b>`), '<b>hi</b>');
  });

  it('a commented closing brace closes its block on the next line', () => {
    assert.strictEqual(render(`<span><% if (true) { %>a<% } // end\n%></span>`), '<span>a</span>');
  });

  it('a quote in the comment does not open a string', () => {
    assert.strictEqual(render(`<% let x = 2; // don't\n%>\n<b><%= x %></b>`), '<b>2</b>');
  });

  it('strips a trailing comment in the middle of a multi-line block', () => {
    const code = compile(`<Define:T>\n<%\n  let x = 1; // first's\n  let y = 2;\n%>\n</Define:T>`)
      .components.get('T').render_function;
    assert.ok(code.includes('let x = 1;') && code.includes('let y = 2;'));
    assert.ok(!code.includes("first's"));
  });

  it('keeps // inside strings, templates and regexes', () => {
    const html = render(
      `<% const u = "http://a" + \`//b\` + /\\/\\//.source; %><i><%= u %></i>`
    );
    assert.strictEqual(html, '<i>http://a//b\\/\\/</i>');
  });

  it('// followed by %> inside a string is not a comment', () => {
    assert.strictEqual(render(`<% const u = 'http://a %> b'; %><i><%= u %></i>`), '<i>http://a %&gt; b</i>');
  });

  it('closes a conditional attribute with a commented } on the next line', () => {
    const code = compile(
      `<Define:T>\n<b <% if (this.args.on) { %>class="on"<% } // end\n%>>x</b>\n</Define:T>`
    ).components.get('T').render_function;
    assert.ok(code.includes('class'));
  });
});

describe('Errors name the %> a // comment hid', () => {
  const fail = src => {
    try {
      compileTemplate(src, 't.jqhtml', { format: 'esm', sourcemap: false });
    } catch (error) {
      return error.message;
    }
    assert.fail('expected a compile error');
  };
  const note = (line, close_column, column) =>
    `The %> on line ${line}, column ${close_column} is inside a // comment ` +
    `(line ${line}, column ${column}), which runs to the end of the line, so it does not close the tag. ` +
    'Close the tag on a new line, or use /* */ for the comment.';

  it('an unclosed <% %> block', () => {
    const message = fail(`<Define:T>\n<% let x = 1; // note %> <b>hi</b>\n</Define:T>`);
    assert.ok(message.startsWith('Syntax error: Unterminated code block'), message);
    assert.ok(message.includes(note(2, 23, 15)), message);
  });

  it('a block that a later %> closes into invalid JavaScript', () => {
    const message = fail(`<Define:T>\n<% let x = 1; // note %> <b>hi</b>\n<% if (x) { %>y<% } %>\n</Define:T>`);
    assert.ok(message.startsWith('JavaScript syntax error'), message);
    assert.ok(message.includes(note(2, 23, 15)), message);
  });

  it('an unclosed <%= %> expression', () => {
    const message = fail(`<Define:T>\n<b><%= this.args.a // label %></b>\n</Define:T>`);
    assert.ok(message.includes(note(2, 29, 20)), message);
  });

  it('a commented } that leaves the tag open', () => {
    const message = fail(`<Define:T>\n<span><% if (true) { %>a<% } // end %></span>\n</Define:T>`);
    assert.ok(message.includes(note(2, 37, 30)), message);
  });

  it('a comment line that only mentions %> mid-sentence is not blamed', () => {
    const message = fail(`<Define:T>\n<%\n  // never put <% %> here\n  let n = (;\n%>\n</Define:T>`);
    assert.ok(!message.includes('inside a // comment'), message);
  });

  it('the parse() entry point adds the note too', () => {
    assert.throws(() => parse(`<Define:T>\n<% let x = 1; // note %> <b>hi</b>\n</Define:T>`),
      error => error.message.includes(note(2, 23, 15)));
  });
});

describe('Regex literals in template code', () => {
  it("<% %> with a ' in a regex", () => {
    assert.strictEqual(render(`<% const s = "a'b".replace(/'/g, ''); %><b><%= s %></b>`), '<b>ab</b>');
  });

  it('<%= %> with a " in a regex', () => {
    assert.strictEqual(render(`<b><%= 'a"b'.replace(/"/g, '') %></b>`), '<b>ab</b>');
  });

  it('<%= %> with an escaped / in a regex', () => {
    assert.strictEqual(render(`<b><%= 'a/b'.replace(/\\//g, ' > ') %></b>`), '<b>a &gt; b</b>');
  });

  it('%> inside a regex does not close the block', () => {
    assert.strictEqual(render(`<b><%= /%>/.test('%>') %></b>`), '<b>true</b>');
  });

  it('a multi-line expression with a regex and a trailing comment', () => {
    // (the newlines of a multi-line expression land after its %> as whitespace)
    const html = render(`<b><%= 'x/y'\n  .replace(/\\//g, '-') // slash\n%></b>`);
    assert.strictEqual(html.replace(/\s+</g, '<'), '<b>x-y</b>');
  });

  it('$attr=(...) with a ) inside a regex', () => {
    const code = compile(`<Define:T>\n<Child $v=('a)b'.replace(/\\)/g, '')) />\n</Define:T>`)
      .components.get('T').render_function;
    assert.ok(code.includes(`"$v": 'a)b'.replace(/\\)/g, '')}`), code);
  });

  it('<{expr}> with a } inside a string', () => {
    const code = compile(`<Define:T>\n<{ this.args.on ? '}' : 'Child' } />\n</Define:T>`)
      .components.get('T').render_function;
    assert.ok(code.includes(`this.args.on ? '}' : 'Child'`), code);
  });
});
