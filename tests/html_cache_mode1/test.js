class Html_Cache_Test extends Jqhtml_Component {
  on_create() {
    this.state.test_results = [];
    this.state.instance_count = 0;
  }

  async on_ready() {
    console.log('========================================');
    console.log('HTML CACHE MODE 1 TEST');
    console.log('========================================');

    // Enable cache with a test key
    window.jqhtml.set_cache_key('html_cache_test_key');

    // Run the test
    await this.run_test();

    // Display results
    this.display_results();
  }

  async run_test() {
    const $mount = this.$sid('mount_point');

    // STEP 1: Create first instance of cached component
    console.log('\n--- STEP 1: Creating first instance ---');
    this.state.instance_count++;
    const $first = $('<div>').appendTo($mount);
    $first.component('Cached_Component', { id: 1 });
    const first_component = $first.component();

    // Wait for it to fully load
    await first_component.ready();

    const first_html = $first.html();
    console.log('First instance loaded, HTML:', first_html.substring(0, 100) + '...');
    this.add_result('First instance loaded', first_html.includes('Loaded Title'));

    // STEP 2: Remove first instance after a delay
    console.log('\n--- STEP 2: Removing first instance ---');
    await new Promise(resolve => setTimeout(resolve, 200));
    first_component.stop();
    $first.remove();
    console.log('First instance removed');

    // STEP 3: Create second instance with same args
    console.log('\n--- STEP 3: Creating second instance ---');
    this.state.instance_count++;
    const $second = $('<div>').appendTo($mount);
    $second.component('Cached_Component', { id: 1 });
    const second_component = $second.component();

    // Capture HTML immediately after creation (should show cached HTML)
    await new Promise(resolve => setTimeout(resolve, 50)); // Small delay for DOM update
    const second_html_before_load = $second.html();
    console.log('Second instance HTML before load:', second_html_before_load.substring(0, 100) + '...');

    // Check if cached HTML is displayed (should show "Loaded Title" from cache)
    const shows_cached_content = second_html_before_load.includes('Loaded Title');
    this.add_result('Second instance shows cached HTML immediately', shows_cached_content);

    if (shows_cached_content) {
      console.log('SUCCESS: Cached HTML is displayed while loading!');
    } else {
      console.log('FAILURE: Cached HTML not displayed');
      console.log('Actual HTML:', second_html_before_load);
    }

    // STEP 4: Wait for second instance to fully load
    console.log('\n--- STEP 4: Waiting for second instance to load ---');
    await second_component.ready();

    const second_html_after_load = $second.html();
    console.log('Second instance HTML after load:', second_html_after_load.substring(0, 100) + '...');
    this.add_result('Second instance fully loaded', second_html_after_load.includes('Loaded Title'));

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
      const icon = result.passed ? '✅' : '❌';
      html += `<li>${icon} ${result.description}</li>`;
    }

    html += '</ul>';

    const all_passed = this.state.test_results.every(r => r.passed);
    html += `<h3>${all_passed ? '✅ All tests passed!' : '❌ Some tests failed'}</h3>`;

    $results.html(html);

    console.log('\n========================================');
    console.log('FINAL RESULTS:');
    for (const result of this.state.test_results) {
      console.log(`  ${result.passed ? 'PASS' : 'FAIL'}: ${result.description}`);
    }
    console.log('========================================');
  }
}
