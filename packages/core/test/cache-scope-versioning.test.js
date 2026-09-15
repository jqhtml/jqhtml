/**
 * The persisted cache scope is versioned by the core version.
 *
 * Cache key SHAPE is a function of the library (see cache-key-serializer.ts), so a release
 * that changes it must invalidate everything stored under the old shape. Rather than add an
 * invalidation path, the core version is folded into the SCOPE MARKER that _validate_scope()
 * already compares - it clears every jqhtml key when that value changes.
 *
 * The per-entry storage key format (`jqhtml::<cache_key>::<developer_key>`) is deliberately
 * NOT versioned: repeating the version in every key would bloat storage and break tooling
 * that reads the layout.
 */

import jqhtml, { version, Jqhtml_Local_Storage } from '../dist/index.js';

const SCOPE_MARKER_KEY = '_jqhtml_cache_key';

describe('cache scope versioning', () => {
  beforeEach(() => localStorage.clear());

  it('stores the scope marker prefixed with the core version', () => {
    jqhtml.set_cache_key('myapp_user_1');
    expect(localStorage.getItem(SCOPE_MARKER_KEY)).toBe(`${version}::myapp_user_1`);
  });

  it('keeps the developer key intact inside the marker', () => {
    jqhtml.set_cache_key('build_abc_user_42');
    expect(localStorage.getItem(SCOPE_MARKER_KEY)).toContain('build_abc_user_42');
  });

  it('clears jqhtml entries when the stored scope is from another version', () => {
    // Simulate a previous release having written entries under an older shape
    localStorage.setItem(SCOPE_MARKER_KEY, '0.0.1::myapp_user_1');
    localStorage.setItem('jqhtml::Some_Component::myapp_user_1', '{"stale":true}');
    localStorage.setItem('unrelated_library_key', 'keep me');

    jqhtml.set_cache_key('myapp_user_1');

    expect(localStorage.getItem('jqhtml::Some_Component::myapp_user_1')).toBeNull();
    expect(localStorage.getItem(SCOPE_MARKER_KEY)).toBe(`${version}::myapp_user_1`);
  });

  it('leaves other libraries\' keys alone when clearing', () => {
    localStorage.setItem(SCOPE_MARKER_KEY, '0.0.1::myapp_user_1');
    localStorage.setItem('unrelated_library_key', 'keep me');

    jqhtml.set_cache_key('myapp_user_1');

    expect(localStorage.getItem('unrelated_library_key')).toBe('keep me');
  });

  it('does not clear when the same version and developer key are reused', () => {
    jqhtml.set_cache_key('myapp_user_1');
    localStorage.setItem('jqhtml::Some_Component::myapp_user_1', '{"fresh":true}');

    jqhtml.set_cache_key('myapp_user_1');

    expect(localStorage.getItem('jqhtml::Some_Component::myapp_user_1')).toBe('{"fresh":true}');
  });
});

/**
 * Bug 16: the quota-exceeded recovery in _set_item() re-stamped the marker key with the
 * RAW developer key instead of the scope marker. _validate_scope() runs before every write
 * and compares against `${version}::${key}`, so the next set() saw a scope change and wiped
 * every jqhtml entry a SECOND time - losing everything the retry had just re-cached.
 */
describe('quota-exceeded recovery keeps the cache scope', () => {
  // jsdom's localStorage is a Proxy, so assigning `localStorage.setItem` stores an ITEM
  // called "setItem" instead of replacing the method. Patch the prototype the proxy
  // forwards to.
  const storage_proto = Object.getPrototypeOf(localStorage);
  const real_set_item = storage_proto.setItem;

  beforeEach(() => localStorage.clear());
  afterEach(() => { storage_proto.setItem = real_set_item; });

  /** Make the next write of `target_key` (and only that one) throw a quota error. */
  const throw_quota_once_on = (target_key) => {
    let armed = true;
    storage_proto.setItem = function (key, value) {
      if (armed && key === target_key) {
        armed = false;
        const error = new Error('quota');
        error.name = 'QuotaExceededError';
        throw error;
      }
      return real_set_item.call(this, key, value);
    };
  };

  it('re-stamps the scope marker so the next write does not wipe the cache again', () => {
    jqhtml.set_cache_key('quota_app_v1');

    const scoped_key = `jqhtml::First::quota_app_v1`;
    throw_quota_once_on(scoped_key);

    Jqhtml_Local_Storage.set('First', { n: 1 });

    // The recovery path must leave the marker in scope-marker form.
    expect(localStorage.getItem('_jqhtml_cache_key')).toBe(`${version}::quota_app_v1`);

    // Written between the two set() calls: a second wipe would take it with it.
    Jqhtml_Local_Storage.set('Survivor', { keep: true });

    Jqhtml_Local_Storage.set('Second', { n: 2 });

    expect(Jqhtml_Local_Storage.get('Survivor')).toEqual({ keep: true });
    expect(Jqhtml_Local_Storage.get('Second')).toEqual({ n: 2 });
    expect(localStorage.getItem('_jqhtml_cache_key')).toBe(`${version}::quota_app_v1`);
  });
});

/**
 * remove() must scope its key exactly as get()/set() do.
 *
 * Every caller hands these three methods a DEVELOPER key (`<Component>::<args>`), and
 * _build_key() turns it into `jqhtml::<key>::<developer_key>`. A remove() that skipped
 * that step would delete nothing and leave the entry for the next get() to serve - which
 * is what the debug overlay's cache drop relies on not happening.
 */
describe('remove() uses the same key scoping as get()/set()', () => {
  beforeEach(() => localStorage.clear());

  it('deletes the entry set() wrote under the same developer key', () => {
    jqhtml.set_cache_key('myapp_user_1');
    Jqhtml_Local_Storage.set('Some_Component::{}', { rows: 1 });

    expect(localStorage.getItem('jqhtml::Some_Component::{}::myapp_user_1')).not.toBeNull();
    expect(Jqhtml_Local_Storage.get('Some_Component::{}')).toEqual({ rows: 1 });

    Jqhtml_Local_Storage.remove('Some_Component::{}');

    expect(localStorage.getItem('jqhtml::Some_Component::{}::myapp_user_1')).toBeNull();
    expect(Jqhtml_Local_Storage.get('Some_Component::{}')).toBeNull();
  });

  it('removes the html snapshot entry independently of the data entry', () => {
    jqhtml.set_cache_key('myapp_user_1');
    Jqhtml_Local_Storage.set('Some_Component::{}', { rows: 1 });
    Jqhtml_Local_Storage.set('Some_Component::{}::html', '<div></div>');

    Jqhtml_Local_Storage.remove('Some_Component::{}::html');

    expect(Jqhtml_Local_Storage.get('Some_Component::{}::html')).toBeNull();
    expect(Jqhtml_Local_Storage.get('Some_Component::{}')).toEqual({ rows: 1 });
  });

  it('leaves entries from another cache scope alone', () => {
    jqhtml.set_cache_key('myapp_user_1');
    localStorage.setItem('jqhtml::Some_Component::{}::other_scope', '{"keep":true}');
    Jqhtml_Local_Storage.set('Some_Component::{}', { rows: 1 });

    Jqhtml_Local_Storage.remove('Some_Component::{}');

    expect(localStorage.getItem('jqhtml::Some_Component::{}::other_scope')).toBe('{"keep":true}');
  });
});
