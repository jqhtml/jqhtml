/**
 * Unit tests for the component registry.
 *
 * The registry is two Maps plus name-resolution rules: which class serves a
 * component name, which template serves it, and how inheritance is walked when
 * neither is registered directly. All DOM-free bookkeeping.
 *
 * Registry state is module-global. Jest gives each test FILE a fresh module
 * registry, but tests within this file share it - so every test uses a distinct
 * component name.
 */

import { jest } from '@jest/globals';
import {
  register_component,
  register_template,
  register,
  get_component_class,
  get_template,
  get_template_by_class,
  has_component,
  get_component_names,
  get_registered_templates,
  list_components,
  Jqhtml_Component,
} from '../dist/index.js';

const make_template = (name, extra = {}) => ({
  name,
  tag: 'div',
  render: function () { return [[], this]; },
  ...extra,
});

describe('register_component', () => {
  it('registers a class under an explicit name', () => {
    class R_Explicit {}
    register_component('R_Explicit', R_Explicit);
    expect(has_component('R_Explicit')).toBe(true);
    expect(get_component_class('R_Explicit')).toBe(R_Explicit);
  });

  it('registers a class under its own name when called with one argument', () => {
    class R_Implicit {}
    register_component(R_Implicit);
    expect(get_component_class('R_Implicit')).toBe(R_Implicit);
  });

  it('rejects a name that does not start with a capital letter', () => {
    class R_Bad {}
    expect(() => register_component('lowercase_name', R_Bad)).toThrow(/must start with a capital letter/);
  });

  it('rejects registration by name with no class', () => {
    expect(() => register_component('R_NoClass')).toThrow(/Component class is required/);
  });

  it('rejects an anonymous class when no name is given', () => {
    expect(() => register_component(class {})).toThrow(/must have a name/);
  });

  it('rejects a template whose name does not match the component name', () => {
    class R_Mismatch {}
    expect(() => register_component('R_Mismatch', R_Mismatch, make_template('R_Other')))
      .toThrow(/must match component name/);
  });
});

describe('register_template', () => {
  it('returns true on first registration', () => {
    expect(register_template(make_template('R_Tpl_One'))).toBe(true);
    expect(get_template('R_Tpl_One').name).toBe('R_Tpl_One');
  });

  it('returns false and keeps the original on duplicate registration', () => {
    const first = make_template('R_Tpl_Dup');
    register_template(first);
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(register_template(make_template('R_Tpl_Dup'))).toBe(false);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
    // First registration wins - the duplicate did not overwrite it.
    expect(get_template('R_Tpl_Dup')).toBe(first);
  });

  it('rejects a template with no name', () => {
    expect(() => register_template(make_template(undefined))).toThrow(/must have a name/);
  });

  it('rejects a lowercase template name', () => {
    expect(() => register_template(make_template('lowercase'))).toThrow(/must start with a capital letter/);
  });

  it('attaches tag and defaultAttributes metadata to an already-registered class', () => {
    class R_Meta {}
    register_component('R_Meta', R_Meta);
    register_template(make_template('R_Meta', { tag: 'span', defaultAttributes: { role: 'note' } }));
    expect(R_Meta._jqhtml_metadata).toEqual({ tag: 'span', defaultAttributes: { role: 'note' } });
  });
});

describe('get_template - fallback behaviour', () => {
  it('falls back to the default div template for an unknown name', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const tpl = get_template('R_Never_Registered');
    warn.mockRestore();
    expect(tpl.tag).toBe('div');
    expect(tpl.name).toBe('Jqhtml_Component');
  });

  it('warns only once per unknown component name', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    get_template('R_Warn_Once');
    get_template('R_Warn_Once');
    get_template('R_Warn_Once');
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('does not warn for the internal Redrawable component', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    get_template('Redrawable');
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('get_component_class - extends chain', () => {
  it('returns undefined when nothing is registered', () => {
    expect(get_component_class('R_Absent')).toBeUndefined();
  });

  it('resolves a class from the parent named in extends', () => {
    class R_Parent {}
    register_component('R_Parent', R_Parent);
    register_template(make_template('R_Kid', { extends: 'R_Parent' }));
    expect(get_component_class('R_Kid')).toBe(R_Parent);
  });

  it('walks a multi-level extends chain', () => {
    class R_Grand {}
    register_component('R_Grand', R_Grand);
    register_template(make_template('R_Mid', { extends: 'R_Grand' }));
    register_template(make_template('R_Leaf', { extends: 'R_Mid' }));
    expect(get_component_class('R_Leaf')).toBe(R_Grand);
  });

  it('does not hang on a circular extends chain', () => {
    register_template(make_template('R_Loop_A', { extends: 'R_Loop_B' }));
    register_template(make_template('R_Loop_B', { extends: 'R_Loop_A' }));
    expect(get_component_class('R_Loop_A')).toBeUndefined();
  });
});

describe('get_template_by_class', () => {
  it('prefers a static template property on the class', () => {
    const own = make_template('R_Static_Tpl');
    class R_Static { static template = own; }
    expect(get_template_by_class(R_Static)).toBe(own);
  });

  it('finds a template registered under the class name', () => {
    class R_ByName {}
    register_template(make_template('R_ByName'));
    expect(get_template_by_class(R_ByName).name).toBe('R_ByName');
  });

  it('walks up the prototype chain to an ancestor template', () => {
    class R_Ancestor {}
    register_template(make_template('R_Ancestor'));
    class R_Descendant extends R_Ancestor {}
    expect(get_template_by_class(R_Descendant).name).toBe('R_Ancestor');
  });

  it('falls back to the default template when nothing matches', () => {
    class R_Orphan {}
    expect(get_template_by_class(R_Orphan).name).toBe('Jqhtml_Component');
  });
});

describe('register - unified router', () => {
  it('routes a compiled template by its __jqhtml_template marker', () => {
    register(Object.assign(make_template('R_Routed_Tpl'), { __jqhtml_template: true }));
    expect(get_registered_templates()).toContain('R_Routed_Tpl');
  });

  it('routes a Jqhtml_Component subclass by its class name', () => {
    class R_Routed_Class extends Jqhtml_Component {}
    register(R_Routed_Class);
    expect(get_component_class('R_Routed_Class')).toBe(R_Routed_Class);
  });

  it('prefers static component_name over the class name (survives minification)', () => {
    class R_Mangled extends Jqhtml_Component {
      static component_name = 'R_Real_Name';
    }
    register(R_Mangled);
    expect(get_component_class('R_Real_Name')).toBe(R_Mangled);
    expect(has_component('R_Mangled')).toBe(false);
  });

  it('rejects a plain object with a helpful error', () => {
    expect(() => register({ name: 'R_Plain' })).toThrow(/requires a compiled JQHTML template or a component class/);
  });

  it('rejects a class lacking the component marker', () => {
    expect(() => register(class R_Unmarked {})).toThrow(/requires a compiled JQHTML template or a component class/);
  });
});

describe('registry introspection', () => {
  it('lists registered component names', () => {
    class R_Listed {}
    register_component('R_Listed', R_Listed);
    expect(get_component_names()).toContain('R_Listed');
  });

  it('reports class and template presence per component', () => {
    class R_Both {}
    register_component('R_Both', R_Both);
    register_template(make_template('R_Both'));
    register_template(make_template('R_TplOnly'));

    const listing = list_components();
    expect(listing['R_Both']).toEqual({ has_class: true, has_template: true });
    expect(listing['R_TplOnly']).toEqual({ has_class: false, has_template: true });
  });
});
