/**
 * init(jQuery, config): the integration entry point.
 *
 * init() applies the integration config (the same thing configure() does) and installs
 * the jQuery plugin (.component(), the val() override, the $(component) unwrap) on the
 * jQuery it is given, or on window.jQuery when none is given. Core installs the plugin
 * on its own at import time only when window.jQuery already exists; here it does not
 * (jest.setup.js gives a window but no jQuery), so the plugin is absent until init().
 *
 * Module state (config, window.$) is shared by the tests in this file, so they run in
 * order and each states what it expects from the previous one.
 */

import fs from 'fs';
import { createRequire } from 'module';
import { init, get_config, configure, Jqhtml_Component } from '../dist/index.js';

const require = createRequire(import.meta.url);
const jquery_source = fs.readFileSync(require.resolve('jquery'), 'utf8');

// A new, unpatched jQuery on each call. Its UMD wrapper takes the CommonJS branch and
// binds to the jsdom window installed by jest.setup.js.
function fresh_jquery() {
  const module = { exports: {} };
  new Function('module', 'exports', 'window', jquery_source)(module, module.exports, window);
  return module.exports;
}

describe('init(jQuery, config)', () => {
  afterAll(() => configure({ mode: 'development' }));

  it('starts with no plugin and development mode', () => {
    expect(window.jQuery).toBeUndefined();
    expect(get_config().mode).toBe('development');
  });

  it('throws when no jQuery is passed and none is global', () => {
    expect(() => init()).toThrow(/jQuery is required for JQHTML/);
  });

  it('throws when the value passed is not jQuery', () => {
    expect(() => init({})).toThrow(/jQuery is required for JQHTML/);
  });

  it('applies the config and installs the plugin on the jQuery passed in', () => {
    const jq = fresh_jquery();
    expect(typeof jq.fn.component).toBe('undefined');

    init(jq, { mode: 'production' });

    expect(get_config()).toEqual({ mode: 'production', warn_uncacheable_args: false, debug_attributes: false });
    expect(typeof jq.fn.component).toBe('function');
    // The plugin replaces the globals with a wrapper sharing jq's prototype and fn.
    expect(window.$).toBe(window.jQuery);
    expect(window.jQuery.fn).toBe(jq.fn);
    const el = window.$('<div></div>');
    expect(el.component()).toBeNull();
  });

  it('the installed $() unwraps a component instance to its root element', () => {
    const fake = Object.create(Jqhtml_Component.prototype);
    const root = window.$('<span></span>');
    Object.defineProperty(fake, '$', { value: root });
    expect(window.$(fake)).toBe(root);
  });

  it('with no config leaves the current config alone', () => {
    init(fresh_jquery());
    expect(get_config().mode).toBe('production');
  });

  it('flags in the config override the mode default', () => {
    init(fresh_jquery(), { mode: 'production', debug_attributes: true });
    expect(get_config()).toEqual({ mode: 'production', warn_uncacheable_args: false, debug_attributes: true });
  });

  it('with no jQuery argument uses window.jQuery', () => {
    const jq = fresh_jquery();
    window.jQuery = jq;
    init(undefined, { mode: 'development' });
    expect(get_config().mode).toBe('development');
    expect(typeof jq.fn.component).toBe('function');
    expect(window.$).toBe(window.jQuery);
    expect(window.jQuery).not.toBe(jq);
  });

  it('rejects an unknown mode before touching jQuery', () => {
    const jq = fresh_jquery();
    expect(() => init(jq, { mode: 'staging' })).toThrow(/Unknown mode 'staging'/);
    expect(typeof jq.fn.component).toBe('undefined');
  });
  it('installs the jQuery wrappers once, however often it is called', () => {
    const jq = fresh_jquery();
    // Counts the jqhtml cleanData wrappers one call passes through: each wrapper asks
    // the element whether it is a Component.
    const cleanData_layers = () => {
      let n = 0;
      jq.cleanData([{ nodeType: 1, classList: { contains() { n++; return false; } } }]);
      return n;
    };
    init(jq);
    const installed = { html: jq.fn.html, on: jq.fn.on, find: jq.fn.find, val: jq.fn.val, component: jq.fn.component };
    expect(cleanData_layers()).toBe(1);

    init(jq, { mode: 'production' });   // config still applies
    init(window.jQuery);                // the $ wrapper shares jq.fn
    expect(get_config().mode).toBe('production');
    expect(cleanData_layers()).toBe(1);
    expect({ html: jq.fn.html, on: jq.fn.on, find: jq.fn.find, val: jq.fn.val, component: jq.fn.component }).toEqual(installed);
    configure({ mode: 'development' });
  });
});
