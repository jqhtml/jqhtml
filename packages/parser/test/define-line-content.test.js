/**
 * Markup written on the <Define> line itself must compile.
 *
 * The 1:1 line mapper used to buffer body lines from source line 2, so anything
 * sharing line 1 with the opening tag - the whole body of a one-line component
 * such as <Define:Badge tag="span">new</Define:Badge> - was silently dropped and
 * the component rendered empty. Line 1 now maps to the render header line.
 */

import { Lexer, Parser, CodeGenerator } from '../dist/index.js';
import assert from 'assert';

function compile(template) {
  const tokens = new Lexer(template).tokenize();
  const ast = new Parser(tokens, template, 'test.jqhtml').parse();
  return new CodeGenerator().generate(ast).code;
}

const render_line = (code) => code.split('\n').find((l) => l.includes('render: function render('));

describe('content on the <Define> line', () => {
  it('a one-line text component keeps its text', () => {
    const line = render_line(compile('<Define:Badge tag="span" class="badge">new</Define:Badge>'));
    assert.ok(line.includes('_output.push("new")'), line);
  });

  it('a one-line component with tags, interpolation and a child component', () => {
    const line = render_line(compile(`<Define:Row><td><%= this.args.v %></td><Cell $x=1 /></Define:Row>`));
    assert.ok(line.includes('{tag: ["td", {}, false]}'), line);
    assert.ok(line.includes('this.args.v'), line);
    assert.ok(line.includes('_output.push("</td>")'), line);
    assert.ok(line.includes('{comp: ["Cell", {"$x": 1}]}'), line);
  });

  it('a one-line slot-only component keeps its slot body', () => {
    const line = render_line(compile(`<Define:Grid_Users><Slot:row><td><%= row.id %></td></Slot:row></Define:Grid_Users>`));
    assert.ok(line.includes('row: function(row)'), line);
    assert.ok(line.includes('row.id'), line);
    assert.ok(line.includes('return [_output, this]; }.bind(this)'), line);
  });

  it('markup on the Define line followed by more lines keeps every line in place', () => {
    const code = compile(`<Define:Two><b>one</b>\n<i>two</i>\n</Define:Two>`);
    const lines = code.split('\n');
    const first = lines.findIndex((l) => l.includes('render: function render('));
    assert.ok(lines[first].includes('_output.push("one")'), lines[first]);
    assert.ok(lines[first + 1].includes('_output.push(" ", {tag: ["i", {}, false]}, "two", "</i>")'), lines[first + 1]);
  });

  it('a multi-line component is unchanged: the header line carries no body', () => {
    const line = render_line(compile(`<Define:Plain>\n<b>x</b>\n</Define:Plain>`));
    assert.ok(line.trim().endsWith('const that = this;'), line);
  });
});
