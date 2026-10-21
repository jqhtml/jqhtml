/**
 * Two tabs with different cache scopes share one localStorage and must not wipe each
 * other's entries on every write.
 *
 * Entry keys already carry the scope (`jqhtml::<developer_key>::<version>::<cache_key>`), so the scope
 * is validated - and stale jqhtml entries cleared - once, when set_cache_key() runs. A
 * write never re-checks the shared `_jqhtml_cache_key` marker; it used to, and two tabs
 * with different scopes then cleared every jqhtml key on each other's every write.
 *
 * Each "tab" is a separate copy of the runtime: dist/index.js and dist/jqhtml-core.esm.js
 * are independent bundles, so each has its own Jqhtml_Local_Storage statics (its own
 * scope), while both use the one jsdom localStorage - exactly what two tabs share.
 */

import { version, Jqhtml_Local_Storage as Tab_A } from '../dist/index.js';
import { Jqhtml_Local_Storage as Tab_B } from '../dist/jqhtml-core.esm.js';

describe('two cache scopes sharing localStorage', () => {
  beforeEach(() => localStorage.clear());

  it('loads two separate runtime copies (the two simulated tabs)', () => {
    expect(Tab_A).not.toBe(Tab_B);
  });

  it('keeps both scopes\' entries when the tabs write alternately', () => {
    Tab_A.set_cache_key('app_build_1_user_1');
    Tab_B.set_cache_key('app_build_2_user_1');

    for (let i = 0; i < 3; i++) {
      Tab_A.set(`Widget::${i}`, { scope: 'A', i });
      Tab_B.set(`Widget::${i}`, { scope: 'B', i });
    }

    for (let i = 0; i < 3; i++) {
      expect(localStorage.getItem(`jqhtml::Widget::${i}::${version}::app_build_1_user_1`)).not.toBeNull();
      expect(localStorage.getItem(`jqhtml::Widget::${i}::${version}::app_build_2_user_1`)).not.toBeNull();
    }
  });

  it('serves each tab only the entries of its own scope', () => {
    Tab_A.set_cache_key('scope_a');
    Tab_B.set_cache_key('scope_b');

    Tab_A.set('Shared_Name::{}', { owner: 'A' });
    Tab_B.set('Shared_Name::{}', { owner: 'B' });
    Tab_A.set('Only_A::{}', { owner: 'A' });

    expect(Tab_A.get('Shared_Name::{}')).toEqual({ owner: 'A' });
    expect(Tab_B.get('Shared_Name::{}')).toEqual({ owner: 'B' });
    expect(Tab_A.get('Only_A::{}')).toEqual({ owner: 'A' });
    expect(Tab_B.get('Only_A::{}')).toBeNull();
  });

  it('a write leaves the scope marker the last set_cache_key() stamped', () => {
    Tab_A.set_cache_key('scope_a');
    Tab_B.set_cache_key('scope_b');
    const marker = localStorage.getItem('_jqhtml_cache_key');

    Tab_A.set('Widget::{}', { owner: 'A' });

    expect(localStorage.getItem('_jqhtml_cache_key')).toBe(marker);
  });
});

describe('changing the scope', () => {
  beforeEach(() => localStorage.clear());

  it('does not read entries from the previous scope after set_cache_key() switches it', () => {
    Tab_A.set_cache_key('user_1');
    Tab_A.set('Profile::{}', { user: 1 });

    Tab_A.set_cache_key('user_2');

    expect(Tab_A.get('Profile::{}')).toBeNull();
  });

  it('clears the old scope\'s entries once, when the new scope is set', () => {
    Tab_A.set_cache_key('user_1');
    Tab_A.set('Profile::{}', { user: 1 });
    localStorage.setItem('unrelated_library_key', 'keep me');
    expect(localStorage.getItem(`jqhtml::Profile::{}::${version}::user_1`)).not.toBeNull();

    Tab_A.set_cache_key('user_2');

    expect(localStorage.getItem(`jqhtml::Profile::{}::${version}::user_1`)).toBeNull();
    expect(localStorage.getItem('unrelated_library_key')).toBe('keep me');
  });
});
