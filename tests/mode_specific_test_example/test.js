/**
 * Mode-Specific Test Example
 *
 * This test demonstrates how to write tests that only apply to specific cache modes.
 *
 * PATTERN: Check window.__JQHTML_TEST_CACHE_MODE__ at the start of on_ready()
 * and instant-pass if the test doesn't apply to the current mode.
 *
 * This test ONLY runs in 'data' cache mode. In 'none' and 'html' modes,
 * it instantly passes without running any assertions.
 */

// Define which cache modes this test applies to
// Options: 'none', 'data', 'html', or combinations
const VALID_MODES = ['data'];

class Mode_Specific_Test extends Jqhtml_Component {
  on_create() {
    this.state.test_results = [];
  }

  async on_ready() {
    // Get the cache mode from the test runner
    const cacheMode = window.__JQHTML_TEST_CACHE_MODE__ || 'none';

    console.log('========================================');
    console.log('MODE-SPECIFIC TEST EXAMPLE');
    console.log(`Current cache mode: ${cacheMode}`);
    console.log(`Valid modes for this test: ${VALID_MODES.join(', ')}`);
    console.log('========================================');

    // Check if this test applies to the current mode
    if (!VALID_MODES.includes(cacheMode)) {
      console.log(`[SKIP] Test only applies to modes: ${VALID_MODES.join(', ')}`);
      console.log('[SKIP] Instant pass - test not applicable to current mode');

      // Mark test as passed (instant pass)
      this.$sid('status').html(`<span style="color: gray;">SKIPPED - Test only applies to ${VALID_MODES.join(', ')} mode(s)</span>`);
      this.$sid('results').html('<p>Test was skipped because it does not apply to the current cache mode.</p>');

      // Signal test passed
      window.testPassed = true;
      return;
    }

    // If we get here, the test applies to this mode
    console.log('Test applies to current mode - running assertions...');

    // Run the actual test
    await this.run_test();

    // Display results
    this.display_results();
  }

  async run_test() {
    // Example: Test something specific to data cache mode
    // (e.g., verifying ES6 class serialization behavior)

    this.add_result('Test is running in correct mode', true);

    // Check that caching is actually enabled
    const cacheEnabled = !!window.jqhtml.get_cache_key();
    this.add_result('Cache is enabled', cacheEnabled);

    // Check that we're in data mode
    const cacheMode = window.__JQHTML_TEST_CACHE_MODE__;
    this.add_result('Cache mode is data', cacheMode === 'data');

    console.log('Test assertions complete');
  }

  add_result(description, passed) {
    this.state.test_results.push({ description, passed });
    console.log(`${passed ? 'PASS' : 'FAIL'}: ${description}`);
  }

  display_results() {
    const $results = this.$sid('results');
    let html = '<h2>Test Results</h2><ul>';

    for (const result of this.state.test_results) {
      const icon = result.passed ? '✅' : '❌';
      html += `<li>${icon} ${result.description}</li>`;
    }

    html += '</ul>';

    const all_passed = this.state.test_results.every(r => r.passed);
    html += `<h3>${all_passed ? '✅ All tests passed!' : '❌ Some tests failed'}</h3>`;

    this.$sid('status').html(all_passed ? '<span style="color: green;">PASSED</span>' : '<span style="color: red;">FAILED</span>');
    $results.html(html);

    // Signal test result
    window.testPassed = all_passed;

    console.log('========================================');
    console.log('FINAL RESULTS:');
    for (const result of this.state.test_results) {
      console.log(`  ${result.passed ? 'PASS' : 'FAIL'}: ${result.description}`);
    }
    console.log(`Overall: ${all_passed ? 'PASS' : 'FAIL'}`);
    console.log('========================================');
  }
}
