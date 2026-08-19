/**
 * Guards on the shape of what @jqhtml/core actually exports.
 *
 * These are cheap tripwires, not behaviour tests: a rollup config change or a
 * refactor that silently drops an export breaks every consumer at import time,
 * and nothing else in the suite would notice.
 */

import jqhtml, * as core from '../dist/index.js';
import {
  get_captured_data,
  start_data_capture,
  stop_data_capture,
  set_preload_data,
  clear_preload_data,
} from '../dist/index.js';

describe('named exports', () => {
  const expected_functions = [
    'boot',
    'register',
    'register_component',
    'register_template',
    'get_component_class',
    'get_template',
    'get_template_by_class',
    'has_component',
    'get_component_names',
    'get_registered_templates',
    'list_components',
    'create_component',
    'escape_html',
    'escape_html_nl2br',
    'process_instructions',
    'render_template',
    'register_cache_class',
    'start_data_capture',
    'get_captured_data',
    'stop_data_capture',
    'set_preload_data',
    'clear_preload_data',
    'init',
  ];

  it.each(expected_functions)('exports %s as a function', (name) => {
    expect(typeof core[name]).toBe('function');
  });

  it('exports the component and manager classes', () => {
    expect(typeof core.Jqhtml_Component).toBe('function');
    expect(typeof core.LifecycleManager).toBe('function');
    expect(typeof core.Load_Coordinator).toBe('function');
    expect(typeof core.Jqhtml_Local_Storage).toBe('function');
  });

  it('exposes Jqhtml_Component subclasses to the unified register()', () => {
    // register() detects classes via this inherited static marker.
    class Probe extends core.Jqhtml_Component {}
    expect(Probe.__jqhtml_component).toBe(true);
  });
});

describe('default export', () => {
  it('is the jqhtml object', () => {
    expect(typeof jqhtml).toBe('object');
    expect(typeof jqhtml.boot).toBe('function');
    expect(typeof jqhtml.register).toBe('function');
    expect(typeof jqhtml.set_cache_key).toBe('function');
  });
});

describe('version', () => {
  it('had its build-time placeholder substituted', () => {
    // Catches a broken rollup replace step, which would otherwise ship the
    // literal token to npm.
    expect(core.version).not.toBe('__VERSION__');
  });

  it('is a 2.x version - JQHTML v2 stays v2 forever', () => {
    expect(core.version).toMatch(/^2\.\d+\.\d+$/);
  });
});

describe('tombstone', () => {
  // Protected easter egg - see "Protected Code - DO NOT REMOVE" in CLAUDE.md.
  // The build script already fails without it; this fails louder and earlier.
  it('is still on the jqhtml object', () => {
    expect(jqhtml.tombstone).toBe('pepperoni and cheese');
  });
});

describe('preload API guards', () => {
  afterEach(() => {
    stop_data_capture();
    clear_preload_data();
  });

  it('reports no captured data before capture starts', () => {
    expect(get_captured_data()).toEqual([]);
  });

  it('treats start_data_capture() as idempotent', () => {
    start_data_capture();
    start_data_capture();
    expect(get_captured_data()).toEqual([]);
  });

  it('treats null and empty preload payloads as a no-op', () => {
    expect(() => set_preload_data(null)).not.toThrow();
    expect(() => set_preload_data([])).not.toThrow();
  });

  it('allows clear_preload_data() with nothing loaded', () => {
    expect(() => clear_preload_data()).not.toThrow();
  });
});
