/**
 * Cache_Shared_Reference_Serialization_Test
 *
 * Regression test for the shared (non-circular) reference fix in
 * local-storage.ts process_for_serialization (commit 91f1bc59).
 *
 * Child component's on_load() sets this.data.a = arr and this.data.b = arr
 * (the SAME array reference under two keys). This test asserts:
 *
 *   1. In 'data' cache mode, the framework's own hot/cold parity
 *      normalization (Jqhtml_Local_Storage.normalize_for_cache, invoked
 *      automatically after on_load()) round-trips this.data through
 *      serialize/deserialize. Both this.data.a AND this.data.b must
 *      survive with full content ([1,2,3]) - neither may be dropped
 *      as a false-positive "circular reference".
 *   2. The raw localStorage cache entry written for the component
 *      (via write_cache_on_loaded -> Jqhtml_Local_Storage.set) contains
 *      BOTH keys with full content when parsed as JSON - directly
 *      inspecting the persisted cache artifact rather than only the
 *      in-memory this.data.
 *   3. Identity is NOT preserved across the round-trip (a !== b after),
 *      which is documented/expected JSON semantics - each occurrence of
 *      a shared reference becomes an independent copy.
 *
 * This test only applies to 'data' cache mode (the only mode where
 * process_for_serialization's shared-reference handling is exercised).
 * In 'none' and 'html' modes it instant-passes.
 */

const VALID_MODES = ['data'];
const CACHE_SCOPE_KEY = 'cache_shared_reference_serialization_key';

class Cache_Shared_Reference_Serialization_Test extends Jqhtml_Component {
  on_create() {
    this.state.test_results = [];

    // Must set cache key in on_create(), before any child components are
    // created, per the caching documentation/convention used throughout
    // this test suite.
    window.jqhtml.set_cache_key(CACHE_SCOPE_KEY, 'data');
  }

  async on_ready() {
    const cacheMode = window.__JQHTML_TEST_CACHE_MODE__ || 'none';

    console.log('========================================');
    console.log('CACHE SHARED REFERENCE SERIALIZATION TEST');
    console.log(`Current cache mode: ${cacheMode}`);
    console.log(`Valid modes for this test: ${VALID_MODES.join(', ')}`);
    console.log('========================================');

    if (!VALID_MODES.includes(cacheMode)) {
      console.log(`[SKIP] Test only applies to modes: ${VALID_MODES.join(', ')}`);
      console.log('[SKIP] Instant pass - test not applicable to current mode');
      this.add_result(`Skipped - test only applies to ${VALID_MODES.join(', ')} mode(s)`, true);
      this.display_results();
      return;
    }

    await this.run_test();
    this.display_results();
  }

  async run_test() {
    const $mount = this.$sid('mount_point');

    // Create the child component whose on_load() assigns a shared
    // (non-circular) array reference to two data keys.
    const $child = $('<div>').appendTo($mount);
    $child.component('Shared_Ref_Child', {});
    const child = $child.component();

    await child.ready();

    console.log('child.data:', child.data);

    // TEST GROUP 1: this.data survived the automatic hot/cold parity
    // normalization (serialize/deserialize round-trip) that the framework
    // runs on this.data after on_load() in 'data' cache mode.
    const a_is_full_array =
      Array.isArray(child.data.a) &&
      child.data.a.length === 3 &&
      child.data.a[0] === 1 &&
      child.data.a[1] === 2 &&
      child.data.a[2] === 3;
    this.add_result('this.data.a (first occurrence of shared array) survives round-trip with full content [1,2,3]', a_is_full_array);

    const b_is_full_array =
      Array.isArray(child.data.b) &&
      child.data.b.length === 3 &&
      child.data.b[0] === 1 &&
      child.data.b[1] === 2 &&
      child.data.b[2] === 3;
    this.add_result('this.data.b (SECOND occurrence of the SAME shared array reference) survives round-trip with full content [1,2,3] - not dropped as a false circular reference', b_is_full_array);

    // Documented/expected: JSON round-trip does not preserve object
    // identity, so a and b become independent array copies. This is
    // correct behavior per process_for_serialization's own comments -
    // NOT a bug to "fix" by trying to preserve identity.
    this.add_result('this.data.a and this.data.b are independent copies after round-trip (JSON semantics; identity is not expected to survive)', child.data.a !== child.data.b);

    // TEST GROUP 2: inspect the actual persisted localStorage cache
    // artifact written for this component (write_cache_on_loaded ->
    // Jqhtml_Local_Storage.set), rather than only the in-memory this.data.
    const cache_key = child._cache_key;
    const has_cache_key = typeof cache_key === 'string' && cache_key.length > 0;
    this.add_result('Child component was assigned a cache key', has_cache_key);

    let raw = null;
    if (has_cache_key) {
      const storage_key = `jqhtml::${cache_key}::${CACHE_SCOPE_KEY}`;
      raw = window.localStorage.getItem(storage_key);
      console.log('localStorage key:', storage_key);
      console.log('localStorage raw value:', raw);
    }

    this.add_result('localStorage cache entry exists for the component', typeof raw === 'string' && raw.length > 0);

    let parsed = null;
    if (typeof raw === 'string') {
      try {
        parsed = JSON.parse(raw);
      } catch (e) {
        console.log('Failed to JSON.parse cached entry:', e);
      }
    }

    const parsed_a_ok =
      !!parsed &&
      Array.isArray(parsed.a) &&
      parsed.a.length === 3 &&
      parsed.a.join(',') === '1,2,3';
    this.add_result('Cached localStorage JSON key "a" has full content [1,2,3]', parsed_a_ok);

    const parsed_b_ok =
      !!parsed &&
      Array.isArray(parsed.b) &&
      parsed.b.length === 3 &&
      parsed.b.join(',') === '1,2,3';
    this.add_result('Cached localStorage JSON key "b" (second occurrence of shared reference) has full content [1,2,3], not omitted/dropped', parsed_b_ok);
  }

  add_result(description, passed) {
    this.state.test_results.push({ description, passed });
    console.log(`${passed ? 'PASS' : 'FAIL'}: ${description}`);
  }

  display_results() {
    const $results = this.$sid('results');
    let html = '<h2>Test Results</h2><ul>';

    for (const result of this.state.test_results) {
      const icon = result.passed ? 'PASS' : 'FAIL';
      html += `<li>${icon}: ${result.description}</li>`;
    }

    html += '</ul>';

    const all_passed = this.state.test_results.every(r => r.passed);
    html += `<h3>${all_passed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}</h3>`;

    $results.html(html);

    console.log('');
    console.log('========================================');
    console.log('FINAL RESULTS:');
    for (const result of this.state.test_results) {
      console.log(`  ${result.passed ? 'PASS' : 'FAIL'}: ${result.description}`);
    }
    if (all_passed) {
      console.log('✅ ALL TESTS PASSED');
    } else {
      console.log('❌ SOME TESTS FAILED');
    }
    console.log('========================================');

    window.testPassed = all_passed;
  }
}
