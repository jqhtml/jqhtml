// This test only applies to 'html' cache mode
const VALID_MODES = ['html'];

class Html_Cache_Render_Count_Test extends Jqhtml_Component {
  on_create() {
    this.state.test_results = [];

    // Set cache key in on_create() - must be done before any child components are created
    window.jqhtml.set_cache_key('html_cache_render_count_test_key', 'html');
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
    console.log('HTML CACHE RENDER COUNT TEST');
    console.log('Testing template and on_render execution counts');
    console.log('========================================');
    console.log('Cache key set in on_create()');

    // Run the test
    await this.run_test();

    // Display results
    this.display_results();
  }

  async run_test() {
    const $mount = this.$sid('mount_point');

    // Reset counters
    window.template_render_count = 0;
    window.on_render_count = 0;

    // STEP 1: Create first instance (fresh load)
    console.log('\n--- STEP 1: Creating first instance (fresh load) ---');
    const $first = $('<div>').appendTo($mount);
    $first.component('Counter_Component', { id: 1 });
    const first_component = $first.component();

    await first_component.ready();

    const first_template_count = window.template_render_count;
    const first_on_render_count = window.on_render_count;

    console.log(`First load - Template renders: ${first_template_count}`);
    console.log(`First load - on_render calls: ${first_on_render_count}`);

    // First load: template renders twice (initial + after on_load changes data)
    this.add_result('First load: Template renders 2 times', first_template_count === 2);
    // First load: on_render called twice (once per render)
    this.add_result('First load: on_render called 2 times', first_on_render_count === 2);

    // Verify HTML was cached - check that second load will use it
    // (We'll verify this in step 3 by checking the template render count)
    console.log('Waiting to verify caching via second load behavior...');

    // STEP 2: Remove first instance
    console.log('\n--- STEP 2: Removing first instance ---');
    first_component.stop();
    $first.remove();
    await new Promise(resolve => setTimeout(resolve, 100));
    console.log('First instance removed');

    // Reset counters for second load
    window.template_render_count = 0;
    window.on_render_count = 0;

    // STEP 3: Create second instance (cache hit)
    console.log('\n--- STEP 3: Creating second instance (cache hit) ---');
    const $second = $('<div>').appendTo($mount);
    $second.component('Counter_Component', { id: 1 });
    const second_component = $second.component();

    await second_component.ready();

    const second_template_count = window.template_render_count;
    const second_on_render_count = window.on_render_count;

    console.log(`Second load - Template renders: ${second_template_count}`);
    console.log(`Second load - on_render calls: ${second_on_render_count}`);

    // Second load with cache:
    // - Cached HTML is injected (no template render)
    // - on_render() runs on cached HTML
    // - on_load() runs, sets data
    // - Forced re-render (template renders once)
    // - on_render() runs again with fresh data
    this.add_result('Second load: Template renders 1 time (skipped cache inject)', second_template_count === 1);
    this.add_result('Second load: on_render called 2 times (cache + re-render)', second_on_render_count === 2);

    // Verify content is correct
    const message = $second.find('.message').text();
    const has_content = message === 'Loaded successfully';
    console.log('Final message:', message);
    this.add_result('Final content is correct after cache reload', has_content);

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
