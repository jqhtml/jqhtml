/**
 * Slot functions and content() splices.
 *
 * A slot body or default content is compiled as a closure over the component
 * whose template contains it (the definer). It returns a markup buffer created
 * as `new jqhtml.Markup(this)`, which carries the definer, and the buffer is
 * spliced into the receiving component's stream as itself so the runtime can
 * render it - handler attributes, id= scoping, instantiator() - in the
 * definer, the same `this` that <%= %> and $sid already resolve against.
 *
 * <Slot:name $params="a, b"> names the parameters the slot function receives
 * from content('name', a, b). Without it the single parameter is named after
 * the slot.
 */

import { Lexer, Parser, CodeGenerator } from '../dist/index.js';
import assert from 'assert';

function compile(template) {
  const tokens = new Lexer(template).tokenize();
  const ast = new Parser(tokens, template, 'test.jqhtml').parse();
  return new CodeGenerator().generate(ast).code;
}

const wrap = (body) => `<Define:Test>\n${body}\n</Define:Test>`;

describe('content() splices carry the definer context', () => {
  it('default content is pushed as its markup buffer', () => {
    const code = compile(wrap(`<div><%= content() %></div>`));
    assert.ok(code.includes(`const result = content.call(this); if (result instanceof jqhtml.Markup) { _output.p(result); }`), code);
  });

  it('named slot content is pushed as its markup buffer', () => {
    const code = compile(wrap(`<div><%= content('header') %></div>`));
    assert.ok(code.includes(`if (result instanceof jqhtml.Markup) { _output.p(result); }`), code);
  });

  it('named slot content with arguments forwards them untouched', () => {
    const code = compile(wrap(`<div><%= content('row', record, i) %></div>`));
    assert.ok(code.includes(`const result = content('row', record, i);`), code);
    assert.ok(code.includes(`if (result instanceof jqhtml.Markup) { _output.p(result); }`), code);
  });

  it('any markup buffer from an expression is spliced the same way; any other array prints (Array)', () => {
    for (const open of ['<%=', '<%!=', '<%br=']) {
      const code = compile(wrap(`<div>${open} this.args.render_fn() %></div>`));
      assert.ok(code.includes(`if (result instanceof jqhtml.Markup) { _output.p(result); } else if (Array.isArray(result)) { _output.p("(Array)"); }`), `${open}: ${code}`);
    }
  });
});

describe('slot function parameters', () => {
  it('an undeclared slot takes one parameter named after the slot', () => {
    const code = compile(wrap(`<Grid><Slot:row><td><%= row.id %></td></Slot:row></Grid>`));
    assert.ok(code.includes(`row: function(row) {`), code);
  });

  it('$params names the parameters', () => {
    const code = compile(wrap(`<Grid><Slot:row $params="record, index"><td><%= index %>:<%= record.id %></td></Slot:row></Grid>`));
    assert.ok(code.includes(`row: function(record, index) {`), code);
    assert.ok(!code.includes(`function(row)`), code);
  });

  it('$params on a self-closing slot', () => {
    const code = compile(wrap(`<Grid><Slot:row $params="record" /></Grid>`));
    assert.ok(code.includes(`row: function(record) {`), code);
  });

  it('$params applies in multi-line (1:1 line mapped) slot bodies', () => {
    const code = compile(wrap(`<Grid>\n  <Slot:row $params="record, index">\n    <td><%= record.id %></td>\n    <td><%= index %></td>\n  </Slot:row>\n</Grid>`));
    assert.ok(code.includes(`row: function(record, index) {`), code);
  });

  it('every slot function returns its own markup buffer, bound to the definer', () => {
    const code = compile(wrap(`<Grid><Slot:row $params="record"><td><%= record.id %></td></Slot:row></Grid>`));
    assert.ok(code.includes(`row: function(record) { const _output = new jqhtml.Markup(this);`), code);
    assert.ok(code.includes(`return _output; }.bind(this)`), code);
  });
});

describe('slot attribute validation', () => {
  const throws = (body, pattern) => {
    assert.throws(() => compile(wrap(body)), (err) => {
      assert.ok(pattern.test(err.message), `message was: ${err.message}`);
      return true;
    });
  };

  it('rejects attributes other than $params', () => {
    throws(`<Grid><Slot:row class="x"><td>a</td></Slot:row></Grid>`, /does not accept the attribute "class"/);
  });

  it('rejects an unquoted $params', () => {
    throws(`<Grid><Slot:row $params=record><td>a</td></Slot:row></Grid>`, /must be a quoted list/);
  });

  it('rejects an empty $params', () => {
    throws(`<Grid><Slot:row $params=" , "><td>a</td></Slot:row></Grid>`, /is empty/);
  });

  it('rejects a name that is not an identifier', () => {
    throws(`<Grid><Slot:row $params="1st"><td>a</td></Slot:row></Grid>`, /not a valid JavaScript identifier/);
  });

  it('rejects a reserved word', () => {
    throws(`<Grid><Slot:row $params="record, class"><td>a</td></Slot:row></Grid>`, /reserved word/);
  });

  it('rejects duplicate names', () => {
    throws(`<Grid><Slot:row $params="a, a"><td>a</td></Slot:row></Grid>`, /duplicate/);
  });
});
