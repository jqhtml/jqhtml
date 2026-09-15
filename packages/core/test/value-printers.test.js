/**
 * Value printers: the object branch of interpolation.
 *
 * print_object() is what compiled templates call for a non-null, non-array
 * object at <%= %>, <%!= %> or <%br= %>. The primitive/array gate lives in the
 * generated code and is tested in packages/parser (object-printer-gate.test.js);
 * here we pin the chain semantics, the three return shapes, escaping per mode,
 * and every throw condition. The registry is module-global, so the "nothing
 * registered" case runs first and later tests build on the printers it adds.
 */

import { add_object_printer, print_object, get_object_printers, dynamic_component_name } from '../dist/index.js';

class Money { constructor(cents) { this.cents = cents; } }
class Rich_Text { constructor(html) { this.html = html; } }
class Mystery {}

describe('print_object with no printers registered', () => {
  it('throws naming the constructor', () => {
    expect(() => print_object(new Money(5), 'escape')).toThrow(/Cannot interpolate a Money object: no object printers are registered/);
    expect(() => print_object({}, 'escape')).toThrow(/Cannot interpolate a Object object/);
  });

  it('refuses a primitive: that branch belongs to the generated code', () => {
    expect(() => print_object('text', 'escape')).toThrow(TypeError);
    expect(() => print_object(null, 'escape')).toThrow(TypeError);
  });

  it('add_object_printer rejects a non-function', () => {
    expect(() => add_object_printer('nope')).toThrow(/expects a function/);
  });
});

describe('printer chain', () => {
  const calls = [];
  beforeAll(() => {
    add_object_printer((v) => { calls.push('money'); return v instanceof Money ? `$${(v.cents / 100).toFixed(2)}` : undefined; });
    add_object_printer((v) => { calls.push('rich'); return v instanceof Rich_Text ? { component: { name: 'Rich_Text_Display', args: { value: v.html }, attrs: { class: 'rich' } } } : undefined; });
    add_object_printer((v) => { calls.push('bad-shape'); return v && v.shape === 'bad' ? 42 : undefined; });
    add_object_printer((v) => { calls.push('bad-name'); return v && v.shape === 'bad-name' ? { component: { name: 'lower_case' } } : undefined; });
    add_object_printer((v) => { calls.push('dollar-key'); return v && v.shape === 'dollar' ? { component: { name: 'X', args: { $id: 1 } } } : undefined; });
    add_object_printer((v) => { calls.push('mystery'); return v instanceof Mystery ? 'handled by the last printer' : undefined; });
  });
  beforeEach(() => { calls.length = 0; });

  it('registers in order', () => {
    expect(get_object_printers()).toHaveLength(6);
  });

  it('first non-undefined wins and later printers are not called', () => {
    expect(print_object(new Money(1234), 'raw')).toBe('$12.34');
    expect(calls).toEqual(['money']);
  });

  it('a printer returning undefined falls through to the next', () => {
    expect(print_object(new Mystery(), 'raw')).toBe('handled by the last printer');
    expect(calls).toEqual(['money', 'rich', 'bad-shape', 'bad-name', 'dollar-key', 'mystery']);
  });

  it('all printers declining throws, naming the constructor and the chain size', () => {
    expect(() => print_object(new Date(0), 'escape')).toThrow(/Cannot interpolate a Date object: none of the 6 registered object printer\(s\) handled it/);
  });

  it('a printer returning an invalid shape throws naming its chain position', () => {
    expect(() => print_object({ shape: 'bad' }, 'escape')).toThrow(/Object printer #3 of 6 returned number 42/);
  });

  it('a descriptor with an invalid component name throws naming the printer', () => {
    expect(() => print_object({ shape: 'bad-name' }, 'escape')).toThrow(/Object printer #4 returned a descriptor whose component name 'lower_case' is invalid/);
  });

  it('a descriptor args key carrying the $ sigil is rejected', () => {
    expect(() => print_object({ shape: 'dollar' }, 'escape')).toThrow(/args key '\$id' - the \$ sigil is template syntax/);
  });
});

describe('string results follow the construct', () => {
  beforeAll(() => {
    add_object_printer((v) => (v && v.text !== undefined ? v.text : undefined));
  });

  it('<%= %> escapes', () => {
    expect(print_object({ text: '<b>&</b>\nline' }, 'escape')).toBe('&lt;b&gt;&amp;&lt;/b&gt;\nline');
  });

  it('<%!= %> does not escape', () => {
    expect(print_object({ text: '<b>&</b>' }, 'raw')).toBe('<b>&</b>');
  });

  it('<%br= %> escapes and converts newlines', () => {
    expect(print_object({ text: '<i>\nx' }, 'nl2br')).toBe('&lt;i&gt;<br />x');
  });
});

describe('descriptor results become component instructions', () => {
  it('args become $-prefixed props and attrs stay plain, regardless of mode', () => {
    const rich = new Rich_Text('<p>hi</p>');
    for (const mode of ['escape', 'raw', 'nl2br']) {
      expect(print_object(rich, mode)).toEqual({ comp: ['Rich_Text_Display', { class: 'rich', $value: '<p>hi</p>' }] });
    }
  });

  it('a descriptor with only a name mounts with no props', () => {
    add_object_printer((v) => (v && v.bare ? { component: { name: '_Framework_Widget' } } : undefined));
    expect(print_object({ bare: true }, 'escape')).toEqual({ comp: ['_Framework_Widget', {}] });
  });

  it('a descriptor never carries content: the instruction has exactly two elements', () => {
    expect(print_object(new Rich_Text('x'), 'escape').comp).toHaveLength(2);
  });
});

describe('dynamic_component_name', () => {
  it('accepts a literal-valid name, with or without the underscore prefix', () => {
    expect(dynamic_component_name('Foo')).toBe('Foo');
    expect(dynamic_component_name('_Foo')).toBe('_Foo');
    expect(dynamic_component_name('User_Card_2')).toBe('User_Card_2');
  });

  it('rejects an empty string, a non-string, a lowercase initial and disallowed characters', () => {
    expect(() => dynamic_component_name('')).toThrow(/evaluated to an empty string/);
    expect(() => dynamic_component_name(undefined)).toThrow(/evaluated to undefined/);
    expect(() => dynamic_component_name(null)).toThrow(/evaluated to null/);
    expect(() => dynamic_component_name(7)).toThrow(/evaluated to number/);
    expect(() => dynamic_component_name('foo')).toThrow(/'foo', which is not a valid component name/);
    expect(() => dynamic_component_name('__Foo')).toThrow(/not a valid component name/);
    expect(() => dynamic_component_name('Foo-Bar')).toThrow(/not a valid component name/);
    expect(() => dynamic_component_name('Foo Bar')).toThrow(/not a valid component name/);
  });
});
