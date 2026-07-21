/**
 * Cache_Entry_Size_Cap_Test - drives Size_Cap_Component through a two-phase load
 * (small payload, then a >1MB payload under the SAME cache key) and inspects raw
 * localStorage to verify Jqhtml_Local_Storage.set()'s 1MB entry-size cap
 * (packages/core/src/local-storage.ts ~622-640):
 *
 *   - Serialized values over 1MB are silently skipped (never written)
 *   - Writing an oversized value under a key that already holds a smaller cached
 *     entry REMOVES that existing entry (set() cannot "update" it, so it clears it)
 *
 * Runs identically in all 3 cache modes (none/data/html) with mode-conditional
 * assertions, since the two caching code paths in component-cache.ts feed
 * Jqhtml_Local_Storage.set() different values:
 *   - data mode  -> set(cache_key, this.data)              (caps on this.data size)
 *   - html mode  -> set(cache_key + '::html', rendered_html) (caps on rendered HTML size)
 * Size_Cap_Component deliberately never renders this.data.payload into the DOM, so in
 * html mode the cached HTML stays tiny even when this.data.payload is >1MB - proving
 * the cap keys off the value actually handed to set(), not off this.data itself.
 */
window.__CACHE_CAP_PHASE__ = 'small';
window.__CACHE_CAP_BIG_SIZE__ = 1200000; // > 1MB (1,048,576 bytes) of 'x' characters

const CACHE_KEY_FRAGMENT = 'cache_entry_size_cap_fixed_key';

class Cache_Entry_Size_Cap_Test extends Jqhtml_Component {
  on_create() {
    this.state.test_results = [];
  }

  async on_ready() {
    // Guard against re-entrant on_ready() from any re-renders triggered below
    if (this.state.testing) return;
    this.state.testing = true;

    const cache_mode = window.__JQHTML_TEST_CACHE_MODE__ || 'none';

    console.log('========================================');
    console.log('CACHE ENTRY SIZE CAP TEST');
    console.log(`Current cache mode: ${cache_mode}`);
    console.log('========================================');

    await this.run_test(cache_mode);
    this.display_results();
  }

  add_result(description, passed) {
    this.state.test_results.push({ description, passed });
    console.log(`${passed ? 'PASS' : 'FAIL'}: ${description}`);
  }

  // Scan raw localStorage for keys JQHTML wrote for Size_Cap_Component.
  // Keys are namespaced as `jqhtml::<developer_key>::<app_cache_key>`
  // (see local-storage.ts _build_key()); html-mode keys get an extra `::html` segment.
  find_cache_keys() {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('jqhtml::') && k.includes(CACHE_KEY_FRAGMENT)) {
        keys.push(k);
      }
    }
    return keys;
  }

  async run_test(cache_mode) {
    const $mount = this.$sid('mount_point');

    // ---- PHASE 1: small on_load() payload ----
    console.log('\n--- PHASE 1: small on_load() payload ---');
    window.__CACHE_CAP_PHASE__ = 'small';

    const $child = $('<div>').appendTo($mount);
    $child.component('Size_Cap_Component', {});
    const child = $child.component();
    await child.ready();

    this.add_result('Phase 1: component loaded with tag "small"', child.data.tag === 'small');

    const keys_after_small = this.find_cache_keys();
    console.log('localStorage jqhtml:: keys after small load:', keys_after_small);

    if (cache_mode === 'none') {
      this.add_result(
        'none mode: no jqhtml:: cache keys after small load (caching disabled entirely)',
        keys_after_small.length === 0
      );
    } else if (cache_mode === 'data') {
      this.add_result(
        'data mode: small entry WAS cached (well under the 1MB cap)',
        keys_after_small.length > 0
      );
    } else if (cache_mode === 'html') {
      this.add_result(
        'html mode: small entry WAS cached (rendered HTML well under the 1MB cap)',
        keys_after_small.length > 0
      );
    }

    // ---- PHASE 2: >1MB on_load() payload, SAME cache key (fixed cache_id()) ----
    console.log('\n--- PHASE 2: >1MB on_load() payload (same cache key) ---');
    window.__CACHE_CAP_PHASE__ = 'big';
    await child.reload();

    this.add_result('Phase 2: component loaded with tag "big"', child.data.tag === 'big');
    this.add_result(
      'Phase 2: this.data.length reflects the >1MB payload',
      child.data.length === window.__CACHE_CAP_BIG_SIZE__
    );

    const keys_after_big = this.find_cache_keys();
    console.log('localStorage jqhtml:: keys after big load:', keys_after_big);

    if (cache_mode === 'none') {
      this.add_result(
        'none mode: still no jqhtml:: cache keys after big load',
        keys_after_big.length === 0
      );
    } else if (cache_mode === 'data') {
      // this.data (containing the >1MB payload) is what data mode hands to set().
      // set() sees size_mb > 1, skips storing, AND removes the existing entry under
      // that key since it can no longer be kept up to date (local-storage.ts ~633-638).
      this.add_result(
        'data mode: oversized this.data write REMOVED the previously-cached small entry',
        keys_after_big.length === 0
      );
    } else if (cache_mode === 'html') {
      // The rendered HTML never includes this.data.payload, so the value handed to
      // set() in html mode stays tiny regardless of this.data's size - the cap is
      // never tripped, and the (small) HTML cache entry remains in place.
      this.add_result(
        'html mode: entry remains cached - cap applies to rendered HTML size, not this.data size',
        keys_after_big.length > 0
      );
    }
  }

  display_results() {
    const $results = this.$sid('results');
    let html = '<h2>Test Results</h2><ul>';

    for (const result of this.state.test_results) {
      html += `<li>${result.passed ? 'PASS' : 'FAIL'}: ${result.description}</li>`;
    }
    html += '</ul>';

    const all_passed = this.state.test_results.every((r) => r.passed);
    html += `<h3>${all_passed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}</h3>`;
    $results.html(html);

    console.log('\n========================================');
    console.log('FINAL RESULTS:');
    this.state.test_results.forEach((r) => {
      console.log(`  ${r.passed ? 'PASS' : 'FAIL'}: ${r.description}`);
    });
    console.log(all_passed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED');
    console.log('========================================');

    window.testPassed = all_passed;
  }
}
