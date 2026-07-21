// Ad-hoc runner so the undefined-null tests can execute without jest's ESM hassle.
// Mirrors the jest-style file but uses minimal describe/it/assert.
import { Lexer, Parser, CodeGenerator } from '../dist/index.js';
import assert from 'assert';

let failed = 0;
let passed = 0;
const stack = [];

function describe(name, fn) {
  stack.push(name);
  fn();
  stack.pop();
}

function it(name, fn) {
  const label = [...stack, name].join(' › ');
  try {
    fn();
    console.log(`  ✓ ${label}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${label}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

function compile(template) {
  const lexer = new Lexer(template);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens, template, 'test.jqhtml');
  const ast = parser.parse();
  const generator = new CodeGenerator();
  return generator.generate(ast);
}

function runExpressionWrapper(generatedCode, value) {
  const _output = [];
  const jqhtml = {
    escape_html: (s) => `ESC:${s}`,
    escape_html_nl2br: (s) => `ESC_BR:${s}`,
  };
  const match = generatedCode.match(/\(\(\) => \{ const result = [^;]+;[\s\S]*?\}\)\(\);/);
  assert.ok(match, 'expected an expression wrapper in generated code');
  let wrapper = match[0];
  wrapper = wrapper.replace(/const result = [^;]+;/, `const result = __INJECTED__;`);
  const fn = new Function('_output', 'jqhtml', '__INJECTED__', wrapper);
  fn(_output, jqhtml, value);
  return _output;
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
      assert.ok(
        /result !== undefined && result !== null\) \{ _output\.push\(result\)/.test(result.code),
        'unescaped output wrapper should guard the raw push'
      );
    });

    it('guards nl2br <%br= %> against undefined and null', () => {
      const result = compile(`<Define:Test>\n  <div><%br= this.data.text %></div>\n</Define:Test>`);
      assert.ok(
        /result !== undefined && result !== null\) \{ _output\.push\(jqhtml\.escape_html_nl2br/.test(result.code),
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

  describe('Arrays still flow through unchanged', () => {
    it('escaped path: array result is spread into output', () => {
      const code = compile(`<Define:Test>\n  <div><%= this.data.parts %></div>\n</Define:Test>`).code;
      assert.deepStrictEqual(runExpressionWrapper(code, ['a', 'b']), ['a', 'b']);
    });

    it('escaped path: [instructions, ctx] tuple spreads instructions only', () => {
      const code = compile(`<Define:Test>\n  <div><%= this.data.parts %></div>\n</Define:Test>`).code;
      assert.deepStrictEqual(
        runExpressionWrapper(code, [['x', 'y'], { ctx: true }]),
        ['x', 'y']
      );
    });
  });
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
