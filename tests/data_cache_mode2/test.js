class Data_Cache_Test extends Jqhtml_Component {
  on_create() {
    this.state.test_results = [];
    this.state.instance_count = 0;
  }

  async on_ready() {
    console.log('========================================');
    console.log('DATA CACHE MODE 2 TEST');
    console.log('ES6 Class Instance Restoration');
    console.log('========================================');

    // Register the Contact_Model class for cache serialization
    window.jqhtml.register_cache_class(window.Contact_Model);
    console.log('Registered Contact_Model for caching');

    // Enable cache with a test key
    window.jqhtml.set_cache_key('data_cache_test_key');

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

    const first_data = first_component.data;
    console.log('First instance data:', first_data);
    console.log('Contact is instance of Contact_Model:', first_data.contact instanceof window.Contact_Model);

    this.add_result('First instance loaded with Contact_Model', first_data.contact instanceof window.Contact_Model);
    this.add_result('Contact has name property', first_data.contact && first_data.contact.name === 'John Doe');

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

    // Small delay to let cache hydrate
    await new Promise(resolve => setTimeout(resolve, 50));

    // Check if cached data is hydrated (should show contact from cache BEFORE on_load completes)
    const second_data_before_load = JSON.parse(JSON.stringify(second_component.data));
    console.log('Second instance data before on_load:', second_data_before_load);

    // Check if the contact was restored as an instance (not plain object)
    const contact_before = second_component.data.contact;
    const is_class_instance_before = contact_before instanceof window.Contact_Model;
    console.log('Contact is instance of Contact_Model (before on_load):', is_class_instance_before);

    this.add_result('Second instance hydrated from cache', second_data_before_load.contact !== null);

    // STEP 4: Wait for second instance to fully load
    console.log('\n--- STEP 4: Waiting for second instance to load ---');
    await second_component.ready();

    const second_data_after_load = second_component.data;
    console.log('Second instance data after load:', second_data_after_load);

    // After on_load(), contact should be a new Contact_Model instance
    const contact_after = second_data_after_load.contact;
    const is_class_instance_after = contact_after instanceof window.Contact_Model;
    console.log('Contact is instance of Contact_Model (after on_load):', is_class_instance_after);

    this.add_result('Contact_Model class restored from cache', is_class_instance_before);
    this.add_result('Contact has get_display_name method', typeof contact_after.get_display_name === 'function');

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
