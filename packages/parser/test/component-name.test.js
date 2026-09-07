/**
 * Component naming rule: an optional SINGLE leading underscore, then a capital
 * letter, then letters, digits and underscores. The underscore prefix is a
 * namespace reserved for framework-provided components (_Root_Layout) so they
 * cannot collide with application components.
 *
 * The rule lives in ONE place (src/component-name.ts) and decides both the
 * tag-vs-component split in a template and <Define:> name validation.
 */

import { Lexer, Parser, CodeGenerator, NodeType, is_component_name, COMPONENT_NAME_PATTERN } from '../dist/index.js';
import assert from 'assert';

function parse(template) {
  const tokens = new Lexer(template).tokenize();
  return new Parser(tokens, template, 'test.jqhtml').parse();
}

function compile(template) {
  return new CodeGenerator().generate(parse(template)).code;
}

const wrap = (body, name = 'Test') => `<Define:${name}>\n${body}\n</Define:${name}>`;
const body_of = (template) =>
  parse(template).body[0].body.filter((n) => !(n.type === NodeType.TEXT && /^\s*$/.test(n.value ?? '')));

describe('is_component_name', () => {
  it('accepts a capital-first name with and without one leading underscore', () => {
    for (const name of ['Foo', 'User_Card', 'A1', '_Foo', '_Root_Layout', '_A']) {
      assert.strictEqual(is_component_name(name), true, name);
    }
  });

  it('rejects lower-case names, two or more leading underscores, and a bare underscore', () => {
    for (const name of ['foo', '_foo', '__Foo', '___Foo', '_', '_1', '', 'Foo-bar', 'Foo:x']) {
      assert.strictEqual(is_component_name(name), false, name);
    }
  });

  it('exposes the pattern itself', () => {
    assert.strictEqual(COMPONENT_NAME_PATTERN.source, '^_?[A-Z][A-Za-z0-9_]*$');
  });
});

describe('<_Foo> in a template', () => {
  it('open/close is a component invocation', () => {
    const [node] = body_of(wrap(`<_Foo>hello</_Foo>`));
    assert.strictEqual(node.type, NodeType.COMPONENT_INVOCATION);
    assert.strictEqual(node.name, '_Foo');
    assert.strictEqual(node.selfClosing, false);
    assert.ok(compile(wrap(`<_Foo>hello</_Foo>`)).includes(`{comp: ["_Foo"`));
  });

  it('self-closing is a component invocation, never a void HTML element', () => {
    const [node] = body_of(wrap(`<_Foo />`));
    assert.strictEqual(node.type, NodeType.COMPONENT_INVOCATION);
    assert.strictEqual(node.name, '_Foo');
    assert.strictEqual(node.selfClosing, true);
    const code = compile(wrap(`<_Foo />`));
    assert.ok(code.includes(`{comp: ["_Foo"`), code);
    assert.ok(!code.includes(`{tag: ["_Foo"`), 'emitted as an HTML tag');
  });

  it('nests: <_Outer><_Inner/></_Outer>', () => {
    const [outer] = body_of(wrap(`<_Outer><_Inner/></_Outer>`));
    assert.strictEqual(outer.type, NodeType.COMPONENT_INVOCATION);
    assert.strictEqual(outer.name, '_Outer');
    const inner = outer.children.find((n) => n.type === NodeType.COMPONENT_INVOCATION);
    assert.strictEqual(inner.name, '_Inner');
    assert.strictEqual(inner.selfClosing, true);
  });

  it('is accepted inside an ordinary component and vice versa', () => {
    const [plain] = body_of(wrap(`<Panel><_Foo/></Panel>`));
    assert.strictEqual(plain.name, 'Panel');
    assert.strictEqual(plain.children.find((n) => n.type === NodeType.COMPONENT_INVOCATION).name, '_Foo');

    const [prefixed] = body_of(wrap(`<_Foo><Panel/></_Foo>`));
    assert.strictEqual(prefixed.name, '_Foo');
    assert.strictEqual(prefixed.children.find((n) => n.type === NodeType.COMPONENT_INVOCATION).name, 'Panel');
  });

  it('carries $ args and content like any component', () => {
    const code = compile(wrap(`<_Foo $id=7 class="x"><b>c</b></_Foo>`));
    assert.ok(code.includes(`{comp: ["_Foo"`), code);
    assert.ok(code.includes(`"$id": 7`) || code.includes(`"$id":7`), code);
  });

  it('mismatched close tag is still an error', () => {
    assert.throws(() => parse(wrap(`<_Foo></Foo>`)), /_Foo|Foo/);
  });
});

describe('<Define:_Foo>', () => {
  it('defines a component named _Foo', () => {
    const ast = parse(wrap(`<div/>`, '_Foo'));
    assert.strictEqual(ast.body[0].name, '_Foo');
    assert.ok(compile(wrap(`<div/>`, '_Foo')).includes(`jqhtml_components.set('_Foo'`));
  });

  it('rejects __Foo with the naming error', () => {
    assert.throws(
      () => parse(wrap(`x`, '__Foo')),
      /Component name '__Foo' must start with a capital letter, optionally preceded by a single underscore/
    );
  });

  it('rejects _foo with the naming error', () => {
    assert.throws(
      () => parse(wrap(`x`, '_foo')),
      /Component name '_foo' must start with a capital letter, optionally preceded by a single underscore/
    );
  });

  it('still rejects a plain lower-case name', () => {
    assert.throws(() => parse(wrap(`x`, 'foo')), /must start with a capital letter/);
  });
});

describe('names that are NOT components', () => {
  it('<_foo> is an HTML element, not an error', () => {
    const [node] = body_of(wrap(`<_foo>t</_foo>`));
    assert.strictEqual(node.type, NodeType.HTML_TAG);
    assert.strictEqual(node.name, '_foo');
    assert.ok(compile(wrap(`<_foo>t</_foo>`)).includes(`{tag: ["_foo"`));
  });

  it('<__Foo> is not a component (it stays literal text, as before)', () => {
    for (const node of body_of(wrap(`<__Foo>t</__Foo>`))) {
      assert.notStrictEqual(node.type, NodeType.COMPONENT_INVOCATION);
    }
    const code = compile(wrap(`<__Foo>t</__Foo>`));
    assert.ok(!code.includes(`{comp: ["__Foo"`), code);
    assert.ok(code.includes(`<__Foo>t</__Foo>`), code);
  });

  it('a lower-case tag is still an HTML element', () => {
    const [node] = body_of(wrap(`<div>t</div>`));
    assert.strictEqual(node.type, NodeType.HTML_TAG);
  });

  it('a stray "<_" in text that is not a tag does not break lexing', () => {
    const code = compile(wrap(`a <_ b`));
    assert.ok(code.includes('a <_ b'), code);
  });
});
