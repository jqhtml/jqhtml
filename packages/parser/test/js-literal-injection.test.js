/**
 * Template-author text can never become executable code in the compiled module.
 *
 * Every piece of author text the compiler emits as data (Define tag=/extends=/other
 * attributes, $ defaults, tag and attribute names and values, text) is built with
 * JSON.stringify (js_literal.ts). These tests compile hostile values, EVALUATE the
 * generated module in a vm context whose `alert` records calls, and assert that
 * nothing ran and the value comes back byte-for-byte.
 *
 * Attribute names are the one place a quote cannot be made inert by escaping alone
 * without also being invalid HTML, so the lexer rejects the characters HTML forbids
 * in attribute names, with a line/column.
 */

import { Lexer, Parser, CodeGenerator, compileTemplate } from '../dist/index.js';
import assert from 'assert';
import { Markup } from './markup-stub.js';
import vm from 'vm';

// Values that would end a single- or double-quoted literal, or (pre-ES2019) a line.
// Text that would end a <script> block is a compile error (template-rules.test.js).
const HOSTILE = [
  "div', evil: alert(1), x: '",
  "P'+alert(2)+'",
  'q"+alert(3)+"',
  "back\\slash\\'+alert(4)+'\\",
  'line\nbreak\tand tab', // (the lexer normalises CR/CRLF to LF before anything else)
  'sep line para',
];

// A literal can only carry `"` inside a single-quoted attribute value and `'` inside
// a double-quoted one; pick whichever quote the value does not contain.
function quote_attr(value) {
  if (!value.includes('"')) return `"${value}"`;
  if (!value.includes("'")) return `'${value}'`;
  throw new Error('test value contains both quote characters');
}

function make_sandbox() {
  const calls = [];
  const sandbox = { alert: (n) => calls.push(n), module: { exports: {} } };
  sandbox.exports = sandbox.module.exports;
  return { sandbox, calls };
}

function eval_cjs(source) {
  const { code } = compileTemplate(source, 'test.jqhtml', { format: 'cjs', sourcemap: false, version: '9.9.9' });
  const { sandbox, calls } = make_sandbox();
  vm.runInNewContext(code, sandbox);
  return { template: sandbox.module.exports, calls, code };
}

// The CodeGenerator's own module (build_module_code) - an ES module; evaluate it as
// a script by dropping the export line.
function eval_codegen_module(source) {
  const ast = new Parser(new Lexer(source).tokenize(), source, 'test.jqhtml').parse();
  const code = new CodeGenerator().generate(ast).code.replace(/^export \{[^}]*\};?$/m, '');
  const { sandbox, calls } = make_sandbox();
  vm.runInNewContext(code + '\n;globalThis.__components = jqhtml_components;', sandbox);
  return { components: sandbox.__components, calls };
}

// Run a compiled template's render function against a stub component.
function render(template, args = {}) {
  const stub = { args, data: {}, _cid: 'CID' };
  const jqhtml = { Markup, escape_html: (s) => String(s), escape_html_nl2br: (s) => String(s), print_object: () => '' };
  const output = template.render.call(stub, stub.data, args, null, jqhtml).instructions;
  return output;
}

describe('Define attributes cannot break out of the generated module', () => {
  for (const value of HOSTILE) {
    const label = JSON.stringify(value);

    it(`tag=${label} is inert and round-trips`, () => {
      const src = `<Define:Probe tag=${quote_attr(value)}><p>x</p></Define:Probe>`;
      const { template, calls } = eval_cjs(src);
      assert.deepStrictEqual(calls, []);
      assert.strictEqual(template.tag, value);
      assert.strictEqual(template.name, 'Probe');

      const { components, calls: calls2 } = eval_codegen_module(src);
      assert.deepStrictEqual(calls2, []);
      assert.strictEqual(components.get('Probe').tag, value);
    });

    it(`extends=${label} is inert and round-trips`, () => {
      const src = `<Define:Probe extends=${quote_attr(value)}><p>x</p></Define:Probe>`;
      const { template, calls } = eval_cjs(src);
      assert.deepStrictEqual(calls, []);
      assert.strictEqual(template.extends, value);

      const { components, calls: calls2 } = eval_codegen_module(src);
      assert.deepStrictEqual(calls2, []);
      assert.strictEqual(components.get('Probe').extends, value);
    });

    it(`default attribute and $ default ${label} are inert and round-trip`, () => {
      const src = `<Define:Probe title=${quote_attr(value)} $label=${quote_attr(value)}><p>x</p></Define:Probe>`;
      const { template, calls } = eval_cjs(src);
      assert.deepStrictEqual(calls, []);
      assert.strictEqual(template.defaultAttributes.title, value);
      assert.strictEqual(template.defineArgs.label, value);

      const { components, calls: calls2 } = eval_codegen_module(src);
      assert.deepStrictEqual(calls2, []);
      assert.strictEqual(components.get('Probe').defaultAttributes.title, value);
      assert.strictEqual(components.get('Probe').defineArgs.label, value);
    });

    it(`element and component attribute values ${label} are inert and round-trip`, () => {
      const src = `<Define:Probe><div title=${quote_attr(value)} $data=${quote_attr(value)}></div><Child title=${quote_attr(value)} $label=${quote_attr(value)} /></Define:Probe>`;
      const { template, calls } = eval_cjs(src);
      const output = render(template);
      assert.deepStrictEqual(calls, []);
      const tag = output.find((i) => i && i.tag);
      assert.strictEqual(tag.tag[1].title, value);
      assert.strictEqual(tag.tag[1].$data, value);
      const comp = output.find((i) => i && i.comp);
      assert.strictEqual(comp.comp[1].title, value);
      assert.strictEqual(comp.comp[1].$label, value);
    });
  }

  it('text content with quotes and backslashes round-trips', () => {
    const text = `he said "hi" and 'bye' \\ \\" \\' done`;
    const { template, calls } = eval_cjs(`<Define:Probe><p>${text}</p></Define:Probe>`);
    const output = render(template);
    assert.deepStrictEqual(calls, []);
    assert.ok(output.includes(text), `expected ${JSON.stringify(text)} in ${JSON.stringify(output)}`);
  });

  it('every component metadata format evaluates without running injected code', () => {
    const src = `<Define:Probe tag="div', evil: alert(1), x: '" extends="P'+alert(2)+'"><p>x</p></Define:Probe>`;
    for (const format of ['cjs', 'iife', 'umd']) {
      const { code } = compileTemplate(src, 'test.jqhtml', { format, sourcemap: true, version: "1'+alert(9)+'" });
      const { sandbox, calls } = make_sandbox();
      vm.runInNewContext(code, sandbox);
      assert.deepStrictEqual(calls, [], `${format} ran injected code`);
    }
  });
});

describe('Attribute names', () => {
  function compile(src) {
    const ast = new Parser(new Lexer(src).tokenize(), src, 'test.jqhtml').parse();
    return new CodeGenerator().generate(ast).code;
  }

  const bad = [
    { name: 'x":alert(3),"y', char: '"' },
    { name: "x':alert(3),'y", char: "'" },
    { name: 'a/b', char: '/' },
    { name: 'a<b', char: '<' },
    { name: 'a\u0001b', char: '\u0001' },
    { name: 'a\fb', char: '\f' },
    { name: 'a\u007fb', char: '\u007f' },
  ];

  for (const { name, char } of bad) {
    it(`rejects ${JSON.stringify(name)} with the position of ${JSON.stringify(char)}`, () => {
      const src = `<Define:Probe>\n  <div ${name}="1"></div>\n</Define:Probe>`;
      let error;
      try { compile(src); } catch (e) { error = e; }
      assert.ok(error, 'expected a compile error');
      assert.strictEqual(error.name, 'JQHTMLParseError');
      assert.match(error.message, /Invalid character .* in attribute name/);
      assert.strictEqual(error.line, 2);
      assert.strictEqual(error.column, 8 + name.indexOf(char));
    });
  }

  it('rejects a bad name on the Define tag and on a component invocation', () => {
    assert.throws(() => compile(`<Define:Probe x"y="1"></Define:Probe>`), /Invalid character '"' in attribute name/);
    assert.throws(() => compile(`<Define:Probe><Child x"y="1" /></Define:Probe>`), /Invalid character '"' in attribute name/);
  });

  it('a hostile key that reaches codegen anyway is emitted as an inert string key', () => {
    // Defence in depth: the lexer rejects such a name, but codegen must not depend
    // on that. Rename an attribute in the AST and check the key round-trips.
    const src = `<Define:Probe><div title="1"></div></Define:Probe>`;
    const ast = new Parser(new Lexer(src).tokenize(), src, 'test.jqhtml').parse();
    const div = ast.body[0].body.find((n) => n.name === 'div');
    const key = 'x":alert(3),"y\'+alert(4)+\'';
    div.attributes = { [key]: div.attributes.title };
    const code = new CodeGenerator().generate(ast).code.replace(/^export \{[^}]*\};?$/m, '');
    const { sandbox, calls } = make_sandbox();
    vm.runInNewContext(code + '\n;globalThis.__c = jqhtml_components;', sandbox);
    const output = render(sandbox.__c.get('Probe'));
    assert.deepStrictEqual(calls, []);
    assert.deepStrictEqual(Object.keys(output.find((i) => i && i.tag).tag[1]), [key]);
  });

  it('accepts the attribute names templates legitimately use', () => {
    const code = compile(
      `<Define:Probe><div x-on:click="go()" :class="c" @click.prevent=this.go ` +
      `aria-label="L" data-foo.bar="1" $item_2="v" v1="x"></div></Define:Probe>`
    );
    for (const key of ['"x-on:click"', '"data-bind-class"', '"data-__-on-click.prevent"', '"$item_2"', '"aria-label"', '"data-foo.bar"', '"v1"']) {
      assert.ok(code.includes(key), `expected ${key} in ${code}`);
    }
  });
});

describe('Interpolated id', () => {
  it('id="x_<%= a || b %>" concatenates its parts, unscoped', () => {
    const src = `<Define:Probe><div id="x_<%= this.args.a || 'fallback' %>"></div></Define:Probe>`;
    const { template, code } = eval_cjs(src);
    assert.ok(code.includes(`"id": "x_" + (this.args.a || 'fallback')`), code);
    const id_of = (args) => render(template, args).find((i) => i && i.tag).tag[1].id;
    assert.strictEqual(id_of({ a: 'one' }), 'x_one');
    assert.strictEqual(id_of({}), 'x_fallback');
  });

  it('a static id is still emitted exactly as written', () => {
    const { template } = eval_cjs(`<Define:Probe><div id="plain"></div></Define:Probe>`);
    assert.strictEqual(render(template).find((i) => i && i.tag).tag[1].id, 'plain');
  });
});
