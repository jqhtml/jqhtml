// This test only applies to 'data' cache mode
const VALID_MODES = ['data'];

class Unregistered_Class_Test extends Jqhtml_Component {
  on_create() {
    this.state.test_results = [];

    // Set cache key in on_create() - must be done before any child components are created
    window.jqhtml.set_cache_key('unregistered_class_test_key', 'data');

    // Deliberately NOT registering Unregistered_Model
    // This tests that unregistered classes are normalized to plain objects
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
    console.log('DATA CACHE UNREGISTERED CLASS TEST');
    console.log('Testing hot/cold cache parity normalization');
    console.log('========================================');
    console.log('Cache key set in on_create() with data mode');
    console.log('Unregistered_Model is NOT registered with jqhtml.register_cache_class()');

    // Run the test
    await this.run_test();

    // Display results
    this.display_results();
  }

  async run_test() {
    const $mount = this.$sid('mount_point');

    // STEP 1: Create component that returns ES6 class instance
    console.log('\n--- STEP 1: Creating component with unregistered ES6 class ---');
    const $test = $('<div>').appendTo($mount);
    $test.component('Test_Component', { id: 1 });
    const component = $test.component();

    // Wait for it to fully load
    await component.ready();

    const contact = component.data.contact;
    console.log('Contact object:', contact);

    // STEP 2: Check that it's NOT an instance of Unregistered_Model
    const is_instance = contact instanceof window.Unregistered_Model;
    console.log('contact instanceof Unregistered_Model:', is_instance);
    this.add_result('Contact is NOT an instance of Unregistered_Model (normalized to plain object)', !is_instance);

    // STEP 3: Check that prototype methods are NOT available
    const has_get_display_name = typeof contact.get_display_name === 'function';
    const has_validate_email = typeof contact.validate_email === 'function';
    console.log('typeof contact.get_display_name:', typeof contact.get_display_name);
    console.log('typeof contact.validate_email:', typeof contact.validate_email);
    this.add_result('get_display_name method is NOT available', !has_get_display_name);
    this.add_result('validate_email method is NOT available', !has_validate_email);

    // STEP 4: Check that data properties ARE preserved
    const has_name = contact.name === 'John Doe';
    const has_email = contact.email === 'john@example.com';
    console.log('contact.name:', contact.name);
    console.log('contact.email:', contact.email);
    this.add_result('name property is preserved', has_name);
    this.add_result('email property is preserved', has_email);

    // STEP 5: Verify the object is just a plain Object
    const constructor_name = contact.constructor.name;
    console.log('contact.constructor.name:', constructor_name);
    this.add_result('Constructor is Object (plain object)', constructor_name === 'Object');

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
