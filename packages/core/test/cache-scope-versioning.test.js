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

import jqhtml, { version } from '../dist/index.js';

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
