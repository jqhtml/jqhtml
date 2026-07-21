// This test only applies to data cache mode
const VALID_MODES = ['data'];

// Global counter to track on_load() calls
window.on_load_call_count = 0;

class Use_Cached_Data_Test extends Jqhtml_Component {
  on_create() {
    this.state.test_results = [];
    // CRITICAL: Set cache key in on_create() - NEVER in on_ready()
    window.jqhtml.set_cache_key('use_cached_data_test_key', 'data');
  }

  async on_ready() {
    const cacheMode = window.__JQHTML_TEST_CACHE_MODE__ || 'none';

    // Instant-pass if mode doesn't apply
    if (!VALID_MODES.includes(cacheMode)) {
      console.log(`[SKIP] Test only applies to modes: ${VALID_MODES.join(', ')}`);
      window.testPassed = true;
      this.show_results(['SKIP: Test only runs in data cache mode']);
      return;
    }

    console.log('========================================');
    console.log('use_cached_data TEST');
    console.log('========================================');
    console.log('');

    // Step 1: First load - should call on_load() and cache data
    console.log('Step 1: First load WITHOUT use_cached_data');
    window.on_load_call_count = 0;

    const mount = this.$sid('mount_point');
    mount.empty();
    mount.component('Cacheable_Component', { item_id: 1 });

    // Wait for component to be ready
    await new Promise(resolve => setTimeout(resolve, 300));

    const first_load_count = window.on_load_call_count;
    console.log(`on_load() called ${first_load_count} time(s) on first load`);

    if (first_load_count !== 1) {
      this.state.test_results.push('FAIL: Expected on_load() to be called 1 time on first load');
      this.show_results(this.state.test_results);
      return;
    }
    this.state.test_results.push('PASS: on_load() called 1 time on first load (data now cached)');

    // Step 2: Second load WITHOUT use_cached_data - should still call on_load() (revalidate)
    console.log('');
    console.log('Step 2: Second load WITHOUT use_cached_data');
    window.on_load_call_count = 0;

    mount.empty();
    mount.component('Cacheable_Component', { item_id: 1 });

    await new Promise(resolve => setTimeout(resolve, 300));

    const second_load_count = window.on_load_call_count;
    console.log(`on_load() called ${second_load_count} time(s) on second load without use_cached_data`);

    if (second_load_count !== 1) {
      this.state.test_results.push('FAIL: Expected on_load() to be called 1 time on second load (revalidation)');
      this.show_results(this.state.test_results);
      return;
    }
    this.state.test_results.push('PASS: on_load() called 1 time on second load (revalidation)');

    // Step 3: Third load WITH use_cached_data=true - should SKIP on_load()
    console.log('');
    console.log('Step 3: Third load WITH use_cached_data=true');
    window.on_load_call_count = 0;

    mount.empty();
    mount.component('Cacheable_Component', { item_id: 1, use_cached_data: true });

    await new Promise(resolve => setTimeout(resolve, 300));

    const third_load_count = window.on_load_call_count;
    console.log(`on_load() called ${third_load_count} time(s) with use_cached_data=true`);

    if (third_load_count !== 0) {
      this.state.test_results.push('FAIL: Expected on_load() to be SKIPPED with use_cached_data=true');
      this.show_results(this.state.test_results);
      return;
    }
    this.state.test_results.push('PASS: on_load() SKIPPED with use_cached_data=true (cache hit)');

    // Step 4: Verify data was still loaded from cache
    // Wait for component to be ready first - give it time to finish boot
    await new Promise(resolve => setTimeout(resolve, 200));

    // The mount element BECOMES the component (classes merged), so just get the component from mount
    const component = mount.component();
    if (!component) {
      this.state.test_results.push('FAIL: Component instance not found on mount point');
      this.show_results(this.state.test_results);
      return;
    }

    // Check if component is ready
    if (component._ready_state < 4) {
      await component.ready();
    }

    if (!component.data.loaded) {
      this.state.test_results.push(`FAIL: Component data not loaded from cache (data=${JSON.stringify(component?.data)})`);
      this.show_results(this.state.test_results);
      return;
    }
    this.state.test_results.push(`PASS: Component has cached data (name=${component.data.name})`);

    console.log('');
    console.log('========================================');
    console.log('ALL TESTS PASSED');
    console.log('========================================');

    window.testPassed = true;
    this.show_results(this.state.test_results);
  }

  show_results(results) {
    const resultsEl = this.$sid('results');
    const allPassed = results.every(r => r.startsWith('PASS') || r.startsWith('SKIP'));

    let html = '<h2>Test Results</h2><ul>';
    for (const result of results) {
      html += `<li>${result}</li>`;
    }
    html += '</ul>';
    html += allPassed ? '<h3>ALL TESTS PASSED</h3>' : '<h3 style="color:red">TESTS FAILED</h3>';

    resultsEl.html(html);
  }
}
