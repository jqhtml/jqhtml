// This test only applies to 'html' cache mode
const VALID_MODES = ['html'];

class Html_Cache_Static_Skip_Test extends Jqhtml_Component {
  on_create() {
    this.state.test_results = [];

    // Set cache key in on_create() - must be done before any child components are created
    // This is the only acceptable place to call set_cache_key() in a component
    window.jqhtml.set_cache_key('html_cache_static_skip_test_key', 'html');
  }

  async on_ready() {
    const cacheMode = window.__JQHTML_TEST_CACHE_MODE__ || 'none';

    // Instant-pass if mode doesn't apply
    if (!VALID_MODES.includes(cacheMode)) {
      console.log(`[SKIP] Test only applies to modes: ${VALID_MODES.join(', ')}`);
      console.log(`Current mode: ${cacheMode}`);
      window.testPassed = true;
      return;
    }

    console.log('========================================');
    console.log('HTML CACHE STATIC SKIP TEST');
    console.log('Testing that static components are NOT cached');
    console.log('========================================');
    console.log('Cache key set in on_create()');

    // Run the test
    await this.run_test();

    // Display results
    this.display_results();
  }

  async run_test() {
    const $static_mount = this.$sid('static_mount');
    const $dynamic_mount = this.$sid('dynamic_mount');

    // STEP 1: Create both components
    console.log('\n--- STEP 1: Creating static and dynamic components ---');

    // Create static component
    const $static = $('<div>').appendTo($static_mount);
    $static.component('Static_Component', { id: 1 });
    const static_component = $static.component();

    // Create dynamic component
    const $dynamic = $('<div>').appendTo($dynamic_mount);
    $dynamic.component('Dynamic_Component', { id: 1 });
    const dynamic_component = $dynamic.component();

    // Wait for both to be ready
    await static_component.ready();
    await dynamic_component.ready();

    console.log('Both components are ready');

    // STEP 2: Check the _is_dynamic flag on each component
    console.log('\n--- STEP 2: Checking _is_dynamic flag ---');
    const static_is_dynamic = static_component._is_dynamic;
    const dynamic_is_dynamic = dynamic_component._is_dynamic;

    console.log(`Static component _is_dynamic: ${static_is_dynamic}`);
    console.log(`Dynamic component _is_dynamic: ${dynamic_is_dynamic}`);

    this.add_result('Static component _is_dynamic is false', static_is_dynamic === false);
    this.add_result('Dynamic component _is_dynamic is true', dynamic_is_dynamic === true);

    // STEP 3: Verify content rendered correctly
    console.log('\n--- STEP 3: Verifying rendered content ---');
    const static_label = $static.find('.default-value').text();
    const dynamic_message = $dynamic.find('.message').text();

    console.log(`Static component label: "${static_label}"`);
    console.log(`Dynamic component message: "${dynamic_message}"`);

    this.add_result('Static component rendered with default label', static_label === 'Default Label');
    this.add_result('Dynamic component rendered with loaded message', dynamic_message === 'Loaded from API');

    console.log('\n========================================');
    console.log('TEST COMPLETE');
    console.log('========================================');
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

    console.log('\n========================================');
    console.log('FINAL RESULTS:');
    for (const result of this.state.test_results) {
      console.log(`  ${result.passed ? 'PASS' : 'FAIL'}: ${result.description}`);
    }
    console.log('========================================');

    window.testPassed = all_passed;
  }
}
