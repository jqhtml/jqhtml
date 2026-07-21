// Global test results
window.testResults = {
  component_d_found: null,
  hello_result: null
};

class Test_Root extends Jqhtml_Component {
  async on_ready() {
    console.log('[Test_Root] on_ready - checking results');

    // Wait a bit to ensure all logging is done
    await new Promise(resolve => setTimeout(resolve, 200));

    const results = window.testResults;
    console.log('\n=== TEST RESULTS ===');
    console.log('component_d_found:', results.component_d_found);
    console.log('hello_result:', results.hello_result);

    if (results.component_d_found && results.hello_result === 'Hello from Component D!') {
      console.log('✓ TEST PASSED - Component A could access Component D in on_render');
      window.testPassed = true;
    } else {
      console.log('✗ TEST FAILED - Component A could NOT access Component D in on_render');
      console.log('  Expected: component_d_found = true, hello_result = "Hello from Component D!"');
      console.log('  Actual: component_d_found =', results.component_d_found, ', hello_result =', results.hello_result);
      window.testPassed = false;
    }

    // Display in DOM
    this.$sid('results').html(`
      <h2>Test Results</h2>
      <p><strong>Component D found in on_render:</strong> ${results.component_d_found}</p>
      <p><strong>hello() result:</strong> ${results.hello_result}</p>
      <p><strong>Test passed:</strong> ${window.testPassed}</p>
    `);
  }
}
