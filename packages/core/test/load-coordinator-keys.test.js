/**
 * Unit tests for Load_Coordinator.generate_invocation_key().
 *
 * This is the function that decides whether two component invocations are "the
 * same request" - it drives load deduplication, the localStorage cache key, and
 * SSR preload matching. It is pure (no DOM, no I/O), so it unit-tests cleanly.
 *
 * Key format: `${component_name}::${JSON.stringify(filtered_sorted_args)}`
 * A null key means "not cacheable"; uncacheable_property names the arg that
 * caused it, for debugging.
 */

import { Load_Coordinator } from '../dist/index.js';

const key_for = (name, args) => Load_Coordinator.generate_invocation_key(name, args);

describe('generate_invocation_key - key format', () => {
  it('produces Name::{} for empty args', () => {
    expect(key_for('My_Component', {})).toEqual({ key: 'My_Component::{}' });
  });

  it('serializes primitive args as JSON', () => {
    const { key } = key_for('C', { a: 'x', b: 2, z: true, n: null });
    expect(key).toBe('C::{"a":"x","b":2,"n":null,"z":true}');
  });

  it('drops undefined values (JSON.stringify semantics)', () => {
    const { key } = key_for('C', { a: 1, u: undefined });
    expect(key).toBe('C::{"a":1}');
  });
});

describe('generate_invocation_key - determinism', () => {
  it('is independent of argument insertion order', () => {
    // This is the whole point: two components written with args in a different
    // order must still dedupe against each other.
    expect(key_for('C', { a: 'x', b: 2 }).key).toBe(key_for('C', { b: 2, a: 'x' }).key);
  });

  it('distinguishes different component names with identical args', () => {
    expect(key_for('A', { id: 1 }).key).not.toBe(key_for('B', { id: 1 }).key);
  });

  it('distinguishes different arg values', () => {
    expect(key_for('C', { id: 1 }).key).not.toBe(key_for('C', { id: 2 }).key);
  });

  it('distinguishes string "1" from number 1', () => {
    expect(key_for('C', { id: '1' }).key).not.toBe(key_for('C', { id: 1 }).key);
  });
});

describe('generate_invocation_key - excluded properties', () => {
  it('ignores underscore-prefixed internal args', () => {
    // _load_only, _load_render_only, _inner_html etc. must not affect identity.
    expect(key_for('C', { a: 1, _internal: 'anything' }).key).toBe(key_for('C', { a: 1 }).key);
  });

  it('ignores use_cached_data', () => {
    expect(key_for('C', { a: 1, use_cached_data: true }).key).toBe(key_for('C', { a: 1 }).key);
  });
});

describe('generate_invocation_key - objects and functions', () => {
  it('marks a plain object arg uncacheable and names it', () => {
    // NOTE: these call generate_invocation_key WITHOUT options - the DEDUPLICATION path,
    // which stays strict by design. The CACHE path opts into content serialization and
    // accepts plain data; see cache-key-serialization.test.js.
    expect(key_for('C', { model: {} }))
      .toEqual({ key: null, uncacheable_property: 'model', uncacheable_reason: 'object' });
  });

  it('marks a bare function arg uncacheable', () => {
    expect(key_for('C', { on_click: function () {} })).toEqual({
      key: null,
      uncacheable_property: 'on_click',
      uncacheable_reason: 'function',
    });
  });

  it('marks arrays uncacheable on the dedup path', () => {
    // Arrays ARE keyable by content for the cache; deduplication deliberately does not
    // opt in, so an array arg still means "load independently" here.
    expect(key_for('C', { items: [1, 2] })).toEqual({
      key: null,
      uncacheable_property: 'items',
      uncacheable_reason: 'object',
    });
  });

  it('uses the _jqhtml_cache_id property when present', () => {
    const { key } = key_for('C', { model: { _jqhtml_cache_id: 'ID7' } });
    expect(key).toBe('C::{"model":"__JQHTML_CACHE_ID__:ID7"}');
  });

  it('uses the jqhtml_cache_id() method when the property is absent', () => {
    const { key } = key_for('C', { model: { jqhtml_cache_id: () => 42 } });
    expect(key).toBe('C::{"model":"__JQHTML_CACHE_ID__:42"}');
  });

  it('accepts a cache id on a function arg', () => {
    const handler = () => {};
    handler._jqhtml_cache_id = 'F1';
    expect(key_for('C', { handler }).key).toBe('C::{"handler":"__JQHTML_CACHE_ID__:F1"}');
  });

  it('treats a throwing jqhtml_cache_id() as uncacheable rather than propagating', () => {
    const model = { jqhtml_cache_id: () => { throw new Error('boom'); } };
    expect(key_for('C', { model }))
      .toEqual({ key: null, uncacheable_property: 'model', uncacheable_reason: 'cache-id-threw' });
  });

  it('reports only the FIRST uncacheable property', () => {
    // Args are walked in sorted order, so 'aaa' is reached before 'zzz'.
    expect(key_for('C', { zzz: {}, aaa: {} }).uncacheable_property).toBe('aaa');
  });
});

describe('generate_invocation_key - exotic types', () => {
  it('marks symbol args uncacheable', () => {
    expect(key_for('C', { s: Symbol('s') }))
      .toEqual({ key: null, uncacheable_property: 's', uncacheable_reason: 'symbol' });
  });

  it('marks bigint args uncacheable', () => {
    expect(key_for('C', { g: 10n }))
      .toEqual({ key: null, uncacheable_property: 'g', uncacheable_reason: 'bigint' });
  });
});
