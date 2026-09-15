/**
 * Dynamic component tags: <{expression} ... /> and <{expression}>...</{expression}>.
 *
 * The expression is evaluated at render time; the compiler's only duties are
 * the syntax, emitting jqhtml.dynamic_component_name(expr) in the component
 * instruction (the runtime validates the value with the literal-tag rule), and
 * the textual closing-tag match - trimmed, internal whitespace collapsed,
 * never evaluated.
 */

import { Lexer, Parser, CodeGenerator, NodeType, TokenType } from '../dist/index.js';
import assert from 'assert';

function parse(template) {
  return new Parser(new Lexer(template).tokenize(), template, 'test.jqhtml').parse();
}
function compile(template) {
  return new CodeGenerator().generate(parse(template)).code;
}
const wrap = (body) => `<Define:Test>\n${body}\n</Define:Test>`;
const first_node = (body) => parse(wrap(body)).body[0].body.find((n) => n.type !== NodeType.TEXT);

describe('lexer', () => {
  it('emits TAG_OPEN + DYNAMIC_TAG_NAME carrying the raw expression, then attributes', () => {
    const tokens = new Lexer(`<{this.data.editor} $field="x" />`).tokenize().map((t) => [t.type, t.value]);
    assert.deepStrictEqual(tokens.slice(0, 2), [[TokenType.TAG_OPEN, '<'], [TokenType.DYNAMIC_TAG_NAME, 'this.data.editor']]);
    assert.ok(tokens.some(([type]) => type === TokenType.ATTR_NAME));
    assert.ok(tokens.some(([type]) => type === TokenType.SELF_CLOSING));
  });

  it('emits TAG_CLOSE + DYNAMIC_TAG_NAME + GT for the closing form', () => {
    const tokens = new Lexer(`</{ this.data.editor }>`).tokenize().map((t) => [t.type, t.value]);
    assert.deepStrictEqual(tokens.slice(0, 3), [[TokenType.TAG_CLOSE, '</'], [TokenType.DYNAMIC_TAG_NAME, ' this.data.editor '], [TokenType.GT, '>']]);
  });

  it('a > inside the expression does not terminate the tag; braces and strings nest', () => {
    const tokens = new Lexer(`<{a > b ? 'X' : names['}'] + \`\${x}\`}>`).tokenize();
    assert.strictEqual(tokens[1].type, TokenType.DYNAMIC_TAG_NAME);
    assert.strictEqual(tokens[1].value, `a > b ? 'X' : names['}'] + \`\${x}\``);
    assert.strictEqual(tokens[2].type, TokenType.GT);
  });

  it('an unterminated expression is a parse error', () => {
    assert.throws(() => new Lexer(`<{this.x`).tokenize(), /Unterminated dynamic component tag/);
  });
});

describe('parser', () => {
  it('<{expr} /> is a self-closing, dynamic component invocation', () => {
    const node = first_node(`<{this.data.editor} $field="title" />`);
    assert.strictEqual(node.type, NodeType.COMPONENT_INVOCATION);
    assert.strictEqual(node.dynamic, true);
    assert.strictEqual(node.expression, 'this.data.editor');
    assert.strictEqual(node.selfClosing, true);
    assert.deepStrictEqual(node.attributes.$field, { quoted: true, value: 'title' });
  });

  it('<{expr}>...</{expr}> keeps its children as ordinary content', () => {
    const node = first_node(`<{this.data.wrapper}><b>x</b><Inner /></{this.data.wrapper}>`);
    assert.strictEqual(node.dynamic, true);
    assert.strictEqual(node.selfClosing, false);
    assert.deepStrictEqual(node.children.map((c) => c.type), [NodeType.HTML_TAG, NodeType.COMPONENT_INVOCATION]);
  });

  it('whitespace variance between opening and closing expressions still matches', () => {
    const node = first_node(`<{ a  >  b ?\n 'X' : 'Y' }>t</{a > b ? 'X' : 'Y'}>`);
    assert.strictEqual(node.dynamic, true);
    assert.strictEqual(node.name, "a > b ? 'X' : 'Y'");
  });

  it('a closing-tag mismatch is a compile error naming both expressions and both lines', () => {
    assert.throws(
      () => parse(`<Define:Test>\n<{this.x}>\n  body\n</{this.y}>\n</Define:Test>`),
      (e) => /<\{this\.x\}> opened on line 2 is closed by <\/\{this\.y\}> on line 4/.test(e.message)
    );
  });

  it('a missing closing tag is an unclosed error naming the expression', () => {
    assert.throws(() => parse(wrap(`<{this.x}>body`)), /Unclosed component: \{this\.x\}/);
  });

  it('an empty expression is rejected', () => {
    assert.throws(() => parse(wrap(`<{}>x</{}>`)), /empty expression/);
    assert.throws(() => parse(wrap(`<{ } />`)), /empty expression/);
  });

  it('nests inside literal components and vice versa', () => {
    const outer = first_node(`<Panel><{this.a}><{this.b} /></{this.a}></Panel>`);
    const dyn = outer.children.find((c) => c.type === NodeType.COMPONENT_INVOCATION);
    assert.strictEqual(dyn.dynamic, true);
    assert.strictEqual(dyn.children.find((c) => c.type === NodeType.COMPONENT_INVOCATION).expression, 'this.b');
  });
});

describe('codegen', () => {
  it('self-closing: the instruction name is a validated render-time expression', () => {
    const code = compile(wrap(`<{this.data.editor} $field="t" class="c" />`));
    assert.ok(code.includes(`{comp: [jqhtml.dynamic_component_name(this.data.editor), {"$field": "t", "class": "c"}]}`), code);
  });

  it('paired: content is compiled as an inline content function, as for a literal tag', () => {
    const code = compile(wrap(`<{this.data.wrapper}>\n<b>x</b>\n</{this.data.wrapper}>`));
    assert.ok(code.includes(`{comp: [jqhtml.dynamic_component_name(this.data.wrapper), {}, function(_dynamic_component) { let _output = [];`), code);
    assert.ok(code.includes(`return [_output, this]; }.bind(this)]});`), code);
  });

  it('paired with slots: slot functions are attached exactly as for a literal tag', () => {
    const code = compile(wrap(`<{this.data.grid}><Slot:row $params="r"><td><%= r.id %></td></Slot:row></{this.data.grid}>`));
    assert.ok(code.includes(`{comp: [jqhtml.dynamic_component_name(this.data.grid), {}, {row: function(r) {`), code);
  });

  it('a comparison inside the expression reaches the generated code intact', () => {
    const code = compile(wrap(`<{this.n > 1 ? 'A' : 'B'} />`));
    assert.ok(code.includes(`jqhtml.dynamic_component_name(this.n > 1 ? 'A' : 'B')`), code);
  });

  it('a literal tag is unchanged', () => {
    const code = compile(wrap(`<User_Card $id=1 />`));
    assert.ok(code.includes(`{comp: ["User_Card", {"$id": 1}]}`), code);
    assert.ok(!code.includes('dynamic_component_name'), code);
  });
});
