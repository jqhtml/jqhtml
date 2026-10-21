/**
 * Sourcemap positions: line AND column.
 *
 * Render line N is template line N - every node, including nested component content
 * and slot bodies, is generated on the line it is written on - and every emitted node
 * (tag, text, expression, code line, attribute value, component, slot) has its own
 * segment from its generated column to its template line and column. The map was
 * line-level at column 0 and one line early (body line N mapped to template line N-1),
 * and nested content, multi-line dynamic tags and multi-line attribute expressions
 * drifted the lines after them.
 *
 * The cases (test-regression/sourcemap-cases.js) are shared with the sourcemap suite;
 * their expected positions come from searching the template text, not from codegen.
 */

import assert from 'assert';
import { Markup } from './markup-stub.js';
import { SourceMapConsumer } from 'source-map';
import { compileTemplate } from '../dist/compiler.js';
import { Lexer, Parser, CodeGenerator } from '../dist/index.js';
import { SOURCEMAP_CASES, check_case } from '../test-regression/sourcemap-cases.js';

function inline_map(code) {
  const match = code.match(/sourceMappingURL=data:application\/json;charset=utf-8;base64,([A-Za-z0-9+/=]+)$/);
  assert.ok(match, 'compiled output should carry an inline sourcemap');
  return JSON.parse(Buffer.from(match[1], 'base64').toString());
}

/** Run a compiled iife template's render function and return its instruction array. */
function render(template, data = {}) {
  const { code } = compileTemplate(template, 'run.jqhtml', { format: 'iife', sourcemap: false });
  const name = code.match(/var (template_\w+)/)[1];
  const def = new Function(`${code}\nreturn ${name};`)();
  const jqhtml = { Markup, escape_html: (v) => String(v), escape_html_nl2br: (v) => String(v), print_object: () => '', dynamic_component_name: (n) => n };
  const output = def.render.call({ _cid: 'c1', args: {}, data }, data, {}, null, jqhtml).instructions;
  return output;
}

describe('Sourcemap positions (line and column)', () => {
  for (const c of SOURCEMAP_CASES) {
    describe(c.name, () => {
      for (const format of ['iife', 'esm', 'cjs', 'umd']) {
        it(`maps every probe to its template line and column (${format})`, async () => {
          for (const r of await check_case(c, format)) {
            const where = `${JSON.stringify(r.probe.gen)} in ${c.name} (${format})`;
            assert.deepStrictEqual(r.actual, r.expected, `${where} maps to the wrong position`);
            assert.strictEqual(r.source, r.filename, `${where} names the wrong source`);
            assert.ok(r.name_ok, `${where} has the wrong names entry`);
            assert.ok(r.generated_line_ok, `${where} is generated on render line ${r.generated_line}`);
          }
        });
      }
    });
  }

  it('maps every generated line, and no more', () => {
    for (const c of SOURCEMAP_CASES) {
      for (const format of ['iife', 'esm', 'cjs', 'umd']) {
        const { code } = compileTemplate(c.source.join('\n'), 'x.jqhtml', { format, sourcemap: true });
        const lines = code.replace(/\n\/\/# sourceMappingURL=.*$/, '').split('\n').length;
        assert.strictEqual(inline_map(code).mappings.split(';').length, lines, `${c.name} (${format})`);
      }
    }
  });

  it('records the expression text as the names entry of an identifier expression', () => {
    const { code } = compileTemplate('<Define:N><%= this.data.title %> <%= a + b %></Define:N>', 'n.jqhtml', { format: 'iife', sourcemap: true });
    assert.deepStrictEqual(inline_map(code).names, ['this.data.title']);
  });

  it('maps a column of a render function compiled with generateWithSourceMap', async () => {
    const source = '<Define:G>\n  <p><%= one %> <%= two %></p>\n</Define:G>\n';
    const ast = new Parser(new Lexer(source).tokenize(), source, 'g.jqhtml').parse();
    const { render_function } = new CodeGenerator().generateWithSourceMap(ast, 'g.jqhtml', source).components.get('G');
    const lines = render_function.replace(/\n\/\/# sourceMappingURL=.*$/, '').split('\n');
    const consumer = await new SourceMapConsumer(inline_map(render_function));
    const original = consumer.originalPositionFor({ line: 2, column: lines[1].indexOf('two') });
    consumer.destroy();
    assert.deepStrictEqual({ line: original.line, column: original.column }, { line: 2, column: source.split('\n')[1].indexOf('two') });
  });

  it('emits a closing tag after a multi-line code block that is the last child', () => {
    // The closing tag was placed on the code block's FIRST line, inside the `if`, so
    // with q false the </div> was never output
    const output = render('<Define:Close_After_Code>\n  <div><% if (this.data.q) {\n    void 0; } %></div>\n</Define:Close_After_Code>\n', { q: false });
    assert.ok(output.includes('</div>'), JSON.stringify(output));
  });

  it('keeps a multi-line dynamic tag expression on one generated line', () => {
    const source = '<Define:Dyn>\n  <{this.data.a ||\n    this.data.b} />\n  <i>x</i>\n</Define:Dyn>\n';
    const { code } = compileTemplate(source, 'dyn.jqhtml', { format: 'iife', sourcemap: false });
    assert.ok(code.includes('jqhtml.dynamic_component_name(this.data.a ||     this.data.b)'), code);
    const output = render(source, { a: 'Panel_A' });
    assert.deepStrictEqual(output.filter((i) => i && (i.tag || i.comp)).map((i) => (i.tag || i.comp)[0]), ['Panel_A', 'i']);
  });
});
