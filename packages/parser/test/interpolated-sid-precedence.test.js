/**
 * Interpolated $sid keeps operator precedence.
 *
 * $sid="row_<%= expr %>" is concatenated into the scoped id ("row_" + expr + ":" + cid).
 * The expression must be parenthesised, otherwise `"row_" + i > 0 ? 'pos' : 'neg'`
 * parses as `("row_" + i > 0) ? 'pos' : ('neg' + ":" + cid)` and always yields 'neg:<cid>'.
 */

import { Lexer, Parser, CodeGenerator } from '../dist/index.js';
import assert from 'assert';
import { Markup } from './markup-stub.js';

function compile(template) {
  const ast = new Parser(new Lexer(template).tokenize(), template, 'test.jqhtml').parse();
  return new CodeGenerator().generate(ast).code;
}

// Compile <div $sid="..."> inside a component and run its render function against a
// stub component, returning the attributes object of the first tag instruction.
function render_sid_attrs(sid_value, args) {
  const code = compile(`<Define:Test><div $sid="${sid_value}"></div></Define:Test>`);
  const match = code.match(/render: (function render\([\s\S]*?\}),\n/);
  assert.ok(match, 'expected a render function in generated code');
  const render = new Function(`return (${match[1]});`)();
  const output = render.call({ args, data: {}, _cid: 'CID' }, {}, args, null, { Markup }).instructions;
  const tag = output.find((i) => i && i.tag);
  return { code, attrs: tag.tag[1] };
}

const cases = [
  {
    name: 'ternary',
    sid: "row_<%= this.args.i > 0 ? 'pos' : 'neg' %>",
    emitted: `"row_" + (this.args.i > 0 ? 'pos' : 'neg')`,
    runs: [[{ i: 1 }, 'row_pos'], [{ i: -1 }, 'row_neg']],
  },
  {
    name: '||',
    sid: "row_<%= this.args.name || 'none' %>",
    emitted: `"row_" + (this.args.name || 'none')`,
    runs: [[{ name: 'a' }, 'row_a'], [{ name: '' }, 'row_none']],
  },
  {
    name: '+ (numeric addition)',
    sid: 'row_<%= this.args.i + 1 %>_x',
    emitted: `"row_" + (this.args.i + 1) + "_x"`,
    runs: [[{ i: 1 }, 'row_2_x']],
  },
];

describe('Interpolated $sid operator precedence', () => {
  for (const c of cases) {
    it(`parenthesises a ${c.name} expression`, () => {
      const { code } = render_sid_attrs(c.sid, c.runs[0][0]);
      assert.ok(code.includes(`"data-sid": ${c.emitted}`), `data-sid should be ${c.emitted}\n${code}`);
      assert.ok(code.includes(`"id": ${c.emitted} + ":" + this._cid`), `id should be ${c.emitted} + ":" + this._cid`);
    });

    for (const [args, expected] of c.runs) {
      it(`evaluates a ${c.name} expression with ${JSON.stringify(args)} to ${expected}`, () => {
        const { attrs } = render_sid_attrs(c.sid, args);
        assert.strictEqual(attrs['data-sid'], expected);
        assert.strictEqual(attrs.id, `${expected}:CID`);
      });
    }
  }
});
