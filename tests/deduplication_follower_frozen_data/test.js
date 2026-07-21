class Deduplication_Frozen_Data_Test extends Jqhtml_Component {
  async on_ready() {
    // Wait a bit for all components to finish loading
    await new Promise(resolve => setTimeout(resolve, 500));

    const contacts = this.$.find('.Contact_Display');
    const loaded_count = this.$.find('.Contact_Display .name').length;

    console.log('=== TEST RESULTS ===');
    console.log(`Total Contact_Display components: ${contacts.length}`);
    console.log(`Successfully loaded (have .name): ${loaded_count}`);
    console.log(`on_load() call count: ${window.on_load_calls}`);

    // Check results
    const results = [];

    if (contacts.length !== 3) {
      results.push(`FAIL: Expected 3 Contact_Display components, got ${contacts.length}`);
    } else {
      results.push(`PASS: 3 Contact_Display components created`);
    }

    if (window.on_load_calls === 1) {
      results.push(`PASS: Deduplication worked - only 1 on_load() call`);
    } else {
      results.push(`INFO: on_load() called ${window.on_load_calls} times (deduplication ${window.on_load_calls === 1 ? 'worked' : 'may not have triggered'})`);
    }

    if (loaded_count === 3) {
      results.push(`PASS: All 3 components loaded successfully`);
      window.testPassed = true;
    } else {
      results.push(`FAIL: Only ${loaded_count} of 3 components loaded (followers failed to receive data)`);
      window.testPassed = false;
    }

    // Display results
    this.$sid('results').html('<pre>' + results.join('\n') + '</pre>');

    console.log(results.join('\n'));
    console.log('===================');

    window.testReady = true;
  }
}
