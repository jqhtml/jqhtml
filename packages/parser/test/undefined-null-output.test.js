/**
 * Unit tests for undefined/null expression output handling.
 *
 * Behavior: When an output expression like <%= expr %>, <%!= expr %>, or
 * <%br= expr %> evaluates to `undefined` or `null`, nothing is pushed to
 * the output (no literal "undefined" or "null" text).
 */

import { Lexer, Parser, CodeGenerator } from '../dist/index.js';
import assert from 'assert';
import { Markup } from './markup-stub.js';

function compile(template) {
  const lexer = new Lexer(template);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens, template, 'test.jqhtml');
  const ast = parser.parse();
  const generator = new CodeGenerator();
  return generator.generate(ast);
}

// Execute a compiled expression wrapper against a stubbed _output, using a
// supplied `value` as the result of the expression.
function runExpressionWrapper(generatedCode, value) {
  // The wrappers reference `jqhtml.escape_html` / `jqhtml.escape_html_nl2br`.
  // Capture every push so we can assert exactly what would have rendered.
  const _output = new Markup(null);
  const jqhtml = {
    Markup,
    escape_html: (s) => `ESC:${s}`,
    escape_html_nl2br: (s) => `ESC_BR:${s}`,
  };
  // Pull the wrapper IIFE out of the generated function body. It's a single
  // statement of the form `(() => { const result = <expr>; ... })();`.
  const match = generatedCode.match(/\(\(\) => \{ const result = [^;]+;[\s\S]*?\}\)\(\);/);
  assert.ok(match, 'expected an expression wrapper in generated code');
  let wrapper = match[0];
  // Replace `const result = <expr>` with our injected value so we control it.
  wrapper = wrapper.replace(/const result = [^;]+;/, `const result = __INJECTED__;`);
  const fn = new Function('_output', 'jqhtml', '__INJECTED__', wrapper);
  fn(_output, jqhtml, value);
  return _output.instructions;
}

describe('Undefined/null expression output', () => {

  describe('Generated code shape', () => {
    it('guards escaped <%= %> against undefined and null', () => {
      const result = compile(`<Define:Test>\n  <div><%= this.data.value %></div>\n</Define:Test>`);
      assert.ok(
        result.code.includes('result !== undefined && result !== null'),
        'escaped output wrapper should guard against undefined and null'
      );
      assert.ok(
        result.code.includes('jqhtml.escape_html(result)'),
        'escaped output wrapper should still call jqhtml.escape_html for defined values'
      );
    });

    it('guards unescaped <%!= %> against undefined and null', () => {
      const result = compile(`<Define:Test>\n  <div><%!= this.data.html %></div>\n</Define:Test>`);
      // unescaped path pushes result directly; ensure the guard is in front of it
      assert.ok(
        /result !== undefined && result !== null\) \{ if \(typeof result !== 'object'\) \{ _output\.p\(result\); \}.*jqhtml\.print_object\(result, 'raw'\)/.test(result.code),
        'unescaped output wrapper should guard the raw push'
      );
    });

    it('guards nl2br <%br= %> against undefined and null', () => {
      const result = compile(`<Define:Test>\n  <div><%br= this.data.text %></div>\n</Define:Test>`);
      assert.ok(
        /result !== undefined && result !== null\) \{ if \(typeof result !== 'object'\) \{ _output\.p\(jqhtml\.escape_html_nl2br\(result\)\); \}.*jqhtml\.print_object\(result, 'nl2br'\)/.test(result.code),
        'nl2br output wrapper should guard the escape_html_nl2br push'
      );
    });
  });

  describe('Runtime behavior — escaped <%= %>', () => {
    const code = compile(`<Define:Test>\n  <div><%= this.data.value %></div>\n</Define:Test>`).code;

    it('pushes nothing when expression is undefined', () => {
      assert.deepStrictEqual(runExpressionWrapper(code, undefined), []);
    });

    it('pushes nothing when expression is null', () => {
      assert.deepStrictEqual(runExpressionWrapper(code, null), []);
    });

    it('pushes escaped value when expression is a string', () => {
      assert.deepStrictEqual(runExpressionWrapper(code, 'hello'), ['ESC:hello']);
    });

    it('pushes escaped value when expression is 0 (not falsy-skipped)', () => {
      assert.deepStrictEqual(runExpressionWrapper(code, 0), ['ESC:0']);
    });

    it('pushes escaped value when expression is empty string', () => {
      assert.deepStrictEqual(runExpressionWrapper(code, ''), ['ESC:']);
    });

    it('pushes escaped value when expression is false', () => {
      assert.deepStrictEqual(runExpressionWrapper(code, false), ['ESC:false']);
    });
  });

  describe('Runtime behavior — unescaped <%!= %>', () => {
    const code = compile(`<Define:Test>\n  <div><%!= this.data.html %></div>\n</Define:Test>`).code;

    it('pushes nothing when expression is undefined', () => {
      assert.deepStrictEqual(runExpressionWrapper(code, undefined), []);
    });

    it('pushes nothing when expression is null', () => {
      assert.deepStrictEqual(runExpressionWrapper(code, null), []);
    });

    it('pushes raw value when expression is a string', () => {
      assert.deepStrictEqual(runExpressionWrapper(code, '<b>x</b>'), ['<b>x</b>']);
    });

    it('pushes raw value when expression is 0', () => {
      assert.deepStrictEqual(runExpressionWrapper(code, 0), [0]);
    });
  });

  describe('Runtime behavior — nl2br <%br= %>', () => {
    const code = compile(`<Define:Test>\n  <div><%br= this.data.text %></div>\n</Define:Test>`).code;

    it('pushes nothing when expression is undefined', () => {
      assert.deepStrictEqual(runExpressionWrapper(code, undefined), []);
    });

    it('pushes nothing when expression is null', () => {
      assert.deepStrictEqual(runExpressionWrapper(code, null), []);
    });

    it('pushes escape_html_nl2br value when expression is a string', () => {
      assert.deepStrictEqual(runExpressionWrapper(code, 'a\nb'), ['ESC_BR:a\nb']);
    });
  });

  describe('Arrays print "(Array)"; a markup buffer is spliced', () => {
    it('escaped path: array result prints the fixed text (Array)', () => {
      const code = compile(`<Define:Test>\n  <div><%= this.data.parts %></div>\n</Define:Test>`).code;
      assert.deepStrictEqual(runExpressionWrapper(code, ['<img src=x onerror=alert(1)>', 'b']), ['(Array)']);
    });

    it('escaped path: an array shaped like the old [instructions, ctx] tuple prints (Array)', () => {
      const code = compile(`<Define:Test>\n  <div><%= this.data.parts %></div>\n</Define:Test>`).code;
      assert.deepStrictEqual(runExpressionWrapper(code, [['x', 'y'], { ctx: true }]), ['(Array)']);
    });

    it('escaped path: a markup buffer is pushed as itself, to render in its definer', () => {
      // A buffer is what a template, content or slot function returns. It is
      // not spread flat: the runtime renders its instructions in its definer,
      // the component that wrote them, so handler `this` matches <%= %> and $sid.
      const code = compile(`<Define:Test>\n  <div><%= this.data.parts %></div>\n</Define:Test>`).code;
      const markup = new Markup({ ctx: true });
      markup.p('x', 'y');
      const output = runExpressionWrapper(code, markup);
      assert.strictEqual(output.length, 1);
      assert.strictEqual(output[0], markup);
    });
  });
});

console.log('Undefined/null output unit tests defined');
