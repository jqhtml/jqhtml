/**
 * The typeof gate in front of the object-printer chain.
 *
 * <%= %>, <%!= %> and <%br= %> compile to a wrapper that routes ONLY a non-null,
 * non-array object that is not a markup buffer to jqhtml.print_object(value,
 * mode). Primitives go down the exact path they always did, a markup buffer is
 * spliced, any other array prints "(Array)", and null/undefined print nothing. These tests execute the
 * generated render function against a recording stand-in for the runtime.
 */

import { Lexer, Parser, CodeGenerator } from '../dist/index.js';
import assert from 'assert';
import { Markup } from './markup-stub.js';

function render(body, value) {
  const template = `<Define:Test>\n<%= this.data.v %>\n</Define:Test>`.replace('<%= this.data.v %>', body);
  const code = new CodeGenerator().generate(new Parser(new Lexer(template).tokenize(), template, 'test.jqhtml').parse()).code;
  const components = new Function(code.replace('export { jqhtml_components };', 'return jqhtml_components;'))();
  const calls = [];
  const fake = {
    Markup,
    escape_html: (s) => { calls.push(['escape_html', s]); return `E(${s})`; },
    escape_html_nl2br: (s) => { calls.push(['escape_html_nl2br', s]); return `N(${s})`; },
    print_object: (o, mode) => { calls.push(['print_object', o, mode]); return `P(${mode})`; },
  };
  const ctx = { _cid: 'c1', data: { v: value }, args: {} };
  const output = components.get('Test').render.call(ctx, ctx.data, ctx.args, null, fake).instructions;
  return { calls, output: output.filter((x) => x !== ' ') };
}

const PRIMITIVES = [['string', 'hi'], ['number', 7], ['boolean', true], ['zero', 0], ['empty string', '']];

describe('primitives never enter the chain', () => {
  for (const [label, value] of PRIMITIVES) {
    it(`<%= %> with a ${label} calls escape_html only`, () => {
      const { calls } = render('<%= this.data.v %>', value);
      assert.deepStrictEqual(calls, [['escape_html', value]]);
    });
  }

  it('<%!= %> with a string pushes it directly and calls nothing', () => {
    const { calls, output } = render('<%!= this.data.v %>', '<b>');
    assert.deepStrictEqual(calls, []);
    assert.deepStrictEqual(output, ['<b>']);
  });

  it('<%br= %> with a string calls escape_html_nl2br only', () => {
    const { calls } = render('<%br= this.data.v %>', 'a\nb');
    assert.deepStrictEqual(calls, [['escape_html_nl2br', 'a\nb']]);
  });

  it('null and undefined print nothing and call nothing', () => {
    for (const value of [null, undefined]) {
      for (const form of ['<%= this.data.v %>', '<%!= this.data.v %>', '<%br= this.data.v %>']) {
        const { calls, output } = render(form, value);
        assert.deepStrictEqual(calls, [], form);
        assert.deepStrictEqual(output, [], form);
      }
    }
  });
});

describe('arrays print "(Array)"; a markup buffer is spliced', () => {
  it('a plain array prints the fixed text (Array) in every construct, and calls nothing', () => {
    for (const form of ['<%= this.data.v %>', '<%!= this.data.v %>', '<%br= this.data.v %>']) {
      const { calls, output } = render(form, ['<b>x</b>', 'y']);
      assert.deepStrictEqual(calls, [], form);
      assert.deepStrictEqual(output, ['(Array)'], form);
    }
  });

  it('an array shaped like the old [instructions, context] tuple prints (Array)', () => {
    const { calls, output } = render('<%= this.data.v %>', [['x'], { ctx: true }]);
    assert.deepStrictEqual(calls, []);
    assert.deepStrictEqual(output, ['(Array)']);
  });

  it('a markup buffer is pushed as itself in every construct, and calls nothing', () => {
    for (const form of ['<%= this.data.v %>', '<%!= this.data.v %>', '<%br= this.data.v %>']) {
      const markup = new Markup({ ctx: true });
      markup.p('x');
      const { calls, output } = render(form, markup);
      assert.deepStrictEqual(calls, [], form);
      assert.strictEqual(output.length, 1, form);
      assert.strictEqual(output[0], markup, form);
    }
  });
});

describe('objects go to print_object with the construct\'s mode', () => {
  class Money { constructor() { this.cents = 1; } }

  it('<%= %> -> escape', () => {
    const value = new Money();
    const { calls, output } = render('<%= this.data.v %>', value);
    assert.deepStrictEqual(calls, [['print_object', value, 'escape']]);
    assert.deepStrictEqual(output, ['P(escape)']);
  });

  it('<%!= %> -> raw', () => {
    const { calls } = render('<%!= this.data.v %>', {});
    assert.deepStrictEqual(calls.map((c) => [c[0], c[2]]), [['print_object', 'raw']]);
  });

  it('<%br= %> -> nl2br', () => {
    const { calls } = render('<%br= this.data.v %>', {});
    assert.deepStrictEqual(calls.map((c) => [c[0], c[2]]), [['print_object', 'nl2br']]);
  });

  it('whatever print_object returns is pushed as-is (a descriptor instruction included)', () => {
    const template = `<Define:Test>\n<%= this.data.v %>\n</Define:Test>`;
    const code = new CodeGenerator().generate(new Parser(new Lexer(template).tokenize(), template, 'test.jqhtml').parse()).code;
    const components = new Function(code.replace('export { jqhtml_components };', 'return jqhtml_components;'))();
    const instruction = { comp: ['Rich_Text_Display', { $value: 'x' }] };
    const fake = { Markup, escape_html: () => 'no', print_object: () => instruction };
    const ctx = { _cid: 'c1', data: { v: {} }, args: {} };
    const output = components.get('Test').render.call(ctx, ctx.data, ctx.args, null, fake).instructions;
    assert.ok(output.includes(instruction));
  });
});

describe('attribute position does not consult printers', () => {
  it('title="<%= obj %>" compiles through the attribute path with no print_object call', () => {
    const template = `<Define:Test>\n<p title="<%= this.data.v %>">x</p>\n</Define:Test>`;
    const code = new CodeGenerator().generate(new Parser(new Lexer(template).tokenize(), template, 'test.jqhtml').parse()).code;
    assert.ok(!code.includes('print_object'), code);
    const components = new Function(code.replace('export { jqhtml_components };', 'return jqhtml_components;'))();
    const value = { toString: () => 'coerced' };
    const calls = [];
    const fake = { Markup, escape_html: (s) => s, print_object: (o) => { calls.push(o); return 'printed'; } };
    const ctx = { _cid: 'c1', data: { v: value }, args: {} };
    const output = components.get('Test').render.call(ctx, ctx.data, ctx.args, null, fake).instructions;
    assert.deepStrictEqual(calls, []);
    const tag = output.find((x) => x && x.tag);
    assert.strictEqual(String(tag.tag[1].title), 'coerced');
  });
});
