/**
 * Unit tests for content-based cache key generation.
 *
 * Plain-data object args are keyed by deterministic CONTENT so that a
 * `{contact_id: 12}` rebuilt on every render still hits the same cache entry.
 * Anything that cannot be expressed exactly is DECLINED with a reason - never
 * silently dropped, because a dropped discriminator is a false cache hit.
 *
 * Deduplication deliberately does NOT opt in: a deduplicated follower skips
 * on_load() entirely with no revalidation, so a wrong key there is permanently
 * wrong data. These tests pin that asymmetry.
 */

import { Load_Coordinator } from '../dist/index.js';

const CACHE = { allow_content_serialization: true };
const key = (args) => Load_Coordinator.generate_invocation_key('C', args, CACHE).key;
const result = (args) => Load_Coordinator.generate_invocation_key('C', args, CACHE);
const dedup = (args) => Load_Coordinator.generate_invocation_key('C', args);

describe('content keying - equal content, equal key', () => {
  it('is insensitive to key order at the top level of a nested object', () => {
    expect(key({ p: { a: 1, b: 2 } })).toBe(key({ p: { b: 2, a: 1 } }));
  });

  it('sorts keys RECURSIVELY, not just at the top', () => {
    expect(key({ p: { x: { a: 1, b: 2 } } })).toBe(key({ p: { x: { b: 2, a: 1 } } }));
  });

  it('is stable across freshly-constructed equal values', () => {
    const build = () => ({ scope: { a: { b: [1, { c: 2 }] } } });
    expect(key(build())).toBe(key(build()));
  });

  it('keys a realistic scoping-params object', () => {
    const build = () => ({ params: { parent_type: 'Contact_Model', parent_id: 12 } });
    expect(key(build())).toBe(key(build()));
    expect(key(build())).not.toBeNull();
  });

  it('keys an array of ids', () => {
    expect(key({ ids: [1, 2, 3] })).toBe(key({ ids: [1, 2, 3] }));
    expect(key({ ids: [1, 2, 3] })).not.toBeNull();
  });
});

describe('content keying - different content, different key', () => {
  it('distinguishes values', () => {
    expect(key({ p: { a: 1 } })).not.toBe(key({ p: { a: 2 } }));
  });

  it('preserves array order', () => {
    expect(key({ p: [1, 2] })).not.toBe(key({ p: [2, 1] }));
  });

  it('distinguishes shapes: object vs array vs string', () => {
    const a = key({ p: { a: 1 } });
    const b = key({ p: [1] });
    const c = key({ p: '1' });
    expect(new Set([a, b, c]).size).toBe(3);
  });

  it('distinguishes number 1 from string "1" nested', () => {
    expect(key({ p: { a: 1 } })).not.toBe(key({ p: { a: '1' } }));
  });

  it('distinguishes an absent key from an explicitly undefined one', () => {
    expect(key({ p: { a: 1 } })).not.toBe(key({ p: { a: 1, b: undefined } }));
  });

  it('cannot be spoofed by string content that mimics the encoding', () => {
    // Length-prefixing is what makes this safe.
    expect(key({ p: { a: 'b', c: 'd' } })).not.toBe(key({ p: { 'a=b,c': 'd' } }));
  });
});

describe('declines rather than risking a false hit', () => {
  const declines = (value, reason) => {
    const r = result({ p: value });
    expect(r.key).toBeNull();
    expect(r.uncacheable_property).toBe('p');
    expect(r.uncacheable_reason).toBe(reason);
  };

  it('declines a function anywhere in the value', () => {
    declines({ a: 1, cb: () => {} }, 'function');
  });

  it('does NOT let two objects differing only by a callback collide', () => {
    // The false-cache-hit guard. JSON.stringify would render both as {"a":1}.
    const one = result({ p: { a: 1, cb: () => 'x' } });
    const two = result({ p: { a: 1, cb: () => 'y' } });
    expect(one.key).toBeNull();
    expect(two.key).toBeNull();
  });

  it('declines a symbol and a bigint', () => {
    declines({ s: Symbol('x') }, 'symbol');
    declines({ g: 10n }, 'bigint');
  });

  it('declines a DOM node', () => {
    declines({ el: document.createElement('div') }, 'dom-node');
  });

  it('declines a jQuery-shaped object', () => {
    declines({ $el: { jquery: '3.7.0', length: 1 } }, 'jquery');
  });

  it('declines a circular reference without overflowing the stack', () => {
    const circular = { a: 1 };
    circular.self = circular;
    declines(circular, 'circular');
  });

  it('declines a class instance (two classes with equal fields would collide)', () => {
    class Contact_Model { constructor() { this.id = 1; } }
    declines(new Contact_Model(), 'non-plain-object');
  });

  it('declines Map, Set and RegExp', () => {
    declines(new Map([['a', 1]]), 'non-plain-object');
    declines(new Set([1]), 'non-plain-object');
    declines(/x/, 'non-plain-object');
  });

  it('declines an invalid Date but accepts a valid one', () => {
    declines(new Date('nonsense'), 'invalid-date');
    expect(key({ p: new Date('2020-01-02T03:04:05Z') })).not.toBeNull();
  });

  it('declines a value over the size cap, visibly', () => {
    declines({ blob: 'x'.repeat(600) }, 'too-large');
  });

  it('declines a throwing getter rather than guessing', () => {
    const r = result({ p: { get boom() { throw new Error('nope'); } } });
    expect(r.key).toBeNull();
    expect(r.uncacheable_reason).toBe('unserializable');
  });

  it('reports only the FIRST offending property', () => {
    expect(result({ zzz: () => {}, aaa: () => {} }).uncacheable_property).toBe('aaa');
  });
});

describe('author-supplied ids still take precedence', () => {
  it('prefers _jqhtml_cache_id over content serialization', () => {
    const k = key({ p: { _jqhtml_cache_id: 'ID7', a: 1 } });
    expect(k).toContain('__JQHTML_CACHE_ID__:ID7');
    expect(k).not.toContain('__JQHTML_CONTENT__');
  });

  it('prefers jqhtml_cache_id() over content serialization', () => {
    const k = key({ p: { jqhtml_cache_id: () => 42, a: 1 } });
    expect(k).toContain('__JQHTML_CACHE_ID__:42');
  });

  it('still declines when jqhtml_cache_id() throws', () => {
    const r = result({ p: { jqhtml_cache_id() { throw new Error('x'); } } });
    expect(r.key).toBeNull();
    expect(r.uncacheable_reason).toBe('cache-id-threw');
  });
});

describe('deduplication stays conservative (no content keying)', () => {
  it('still refuses a plain object arg that the cache now accepts', () => {
    const args = { params: { parent_id: 12 } };
    expect(key(args)).not.toBeNull();        // cache: keyed
    expect(dedup(args).key).toBeNull();      // dedup: not keyed
  });

  it('reports a reason on the dedup path too', () => {
    expect(dedup({ params: { a: 1 } }).uncacheable_reason).toBe('object');
  });

  it('still deduplicates primitive-only args', () => {
    expect(dedup({ page: 1, filter: 'open' }).key).not.toBeNull();
  });

  it('still honours an author-supplied id for dedup', () => {
    expect(dedup({ m: { _jqhtml_cache_id: 'ID1' } }).key).not.toBeNull();
  });
});

describe('excluded args are unchanged', () => {
  it('ignores underscore-prefixed args and use_cached_data', () => {
    expect(key({ p: { a: 1 }, _internal: {}, use_cached_data: true }))
      .toBe(key({ p: { a: 1 } }));
  });
});
