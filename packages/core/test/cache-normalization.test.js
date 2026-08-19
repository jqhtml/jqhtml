/**
 * Unit tests for Jqhtml_Local_Storage.normalize_for_cache() and
 * register_cache_class().
 *
 * In data cache mode the framework pushes this.data through serialize/
 * deserialize immediately after on_load(), so a component sees identical data
 * whether it came from the network or from cache ("hot/cold parity"). The
 * consequence developers trip over: an ES6 class instance that was never
 * registered comes back as a plain object with its methods gone.
 *
 * The browser test tests/data_cache_unregistered_class covers this end to end;
 * these tests pin the normalization function itself.
 */

import { Jqhtml_Local_Storage, register_cache_class } from '../dist/index.js';

const normalize = (v) => Jqhtml_Local_Storage.normalize_for_cache(v);

describe('normalize_for_cache - plain values', () => {
  it('passes primitives through', () => {
    expect(normalize(42)).toBe(42);
    expect(normalize('text')).toBe('text');
    expect(normalize(true)).toBe(true);
    expect(normalize(null)).toBe(null);
  });

  it('preserves plain objects including nesting', () => {
    expect(normalize({ a: 1, b: { c: 2 } })).toEqual({ a: 1, b: { c: 2 } });
  });

  it('preserves arrays and their contents', () => {
    expect(normalize([1, 'x', { y: 2 }])).toEqual([1, 'x', { y: 2 }]);
  });

  it('preserves Date objects as Dates, not ISO strings', () => {
    // The serializer revives dates, so a component reading this.data after a
    // cache round trip still gets a real Date it can call methods on.
    const result = normalize({ d: new Date('2020-01-02T03:04:05Z') });
    expect(result.d instanceof Date).toBe(true);
    expect(result.d.toISOString()).toBe('2020-01-02T03:04:05.000Z');
  });
});

describe('normalize_for_cache - unregistered classes', () => {
  class Unregistered_Model {
    constructor() { this.id = 1; this.label = 'x'; }
    describe() { return 'method survived'; }
  }

  it('keeps the properties', () => {
    expect(normalize(new Unregistered_Model())).toEqual({ id: 1, label: 'x' });
  });

  it('degrades the instance to a plain object', () => {
    const result = normalize(new Unregistered_Model());
    expect(result instanceof Unregistered_Model).toBe(false);
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
  });

  it('loses the prototype methods', () => {
    // This is the failure developers hit: it works on a cache miss (real
    // instance) and breaks on a cache hit (plain object).
    expect(normalize(new Unregistered_Model()).describe).toBeUndefined();
  });
});

describe('normalize_for_cache - registered classes', () => {
  class Registered_Model {
    constructor() { this.id = 2; }
    describe() { return 'method survived'; }
  }
  register_cache_class(Registered_Model);

  it('restores the instance', () => {
    expect(normalize(new Registered_Model()) instanceof Registered_Model).toBe(true);
  });

  it('keeps the prototype methods callable', () => {
    expect(normalize(new Registered_Model()).describe()).toBe('method survived');
  });

  it('keeps the property values', () => {
    expect(normalize(new Registered_Model()).id).toBe(2);
  });
});
