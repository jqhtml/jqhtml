class Test_Root extends Jqhtml_Component {
  async on_ready() {
    const results = [];
    const emitter = this.sid('emitter');
    const $results = this.$sid('results');

    console.log('[Test_Root] Starting event data parameter tests');

    // ==========================================
    // TEST 1: Subscribe BEFORE trigger (via setTimeout)
    // ==========================================
    console.log('\n=== TEST 1: Subscribe BEFORE trigger ===');

    // Create a fresh emitter for Test 1
    const $test1_container = $('<div>').appendTo(this.$);
    const test1_emitter = $('<div>')
      .component('Event_Emitter', {})
      .appendTo($test1_container)
      .component();

    // Subscribe BEFORE ready (before trigger fires)
    let test1_data = null;
    let test1_component = null;

    // Need to subscribe before the emitter's on_ready triggers the event
    // Since we just created it, we can subscribe immediately before it boots
    test1_emitter.on('my-event', (c, data) => {
      console.log('[TEST 1] Callback fired! component:', c?.component_name?.(), 'data:', data);
      test1_component = c;
      test1_data = data;
    });

    // Wait for the emitter to be ready (which triggers the event)
    await test1_emitter.ready();

    // Check results
    if (test1_data && test1_data.key === 'test-key' && test1_data.value === 42) {
      console.log('[TEST 1] ✓ PASSED - Data received correctly when subscribing BEFORE trigger');
      results.push({ test: 'before_trigger', passed: true, data: test1_data });
    } else {
      console.log('[TEST 1] ✗ FAILED - Data was:', test1_data);
      results.push({ test: 'before_trigger', passed: false, data: test1_data });
    }

    // ==========================================
    // TEST 2: Subscribe AFTER trigger (late subscriber)
    // ==========================================
    console.log('\n=== TEST 2: Subscribe AFTER trigger ===');

    // Create another emitter
    const $test2_container = $('<div>').appendTo(this.$);
    const test2_emitter = $('<div>')
      .component('Event_Emitter', {})
      .appendTo($test2_container)
      .component();

    // Wait for it to be ready (event has already triggered)
    await test2_emitter.ready();

    console.log('[TEST 2] Emitter is ready, event already triggered. Now subscribing late...');

    // Subscribe AFTER the event already fired
    let test2_data = null;
    let test2_component = null;
    let test2_callback_fired = false;

    test2_emitter.on('my-event', (c, data) => {
      console.log('[TEST 2] Late callback fired! component:', c?.component_name?.(), 'data:', data);
      test2_callback_fired = true;
      test2_component = c;
      test2_data = data;
    });

    // Give a tick for the callback to fire (it should fire immediately for already-occurred events)
    await new Promise(resolve => setTimeout(resolve, 50));

    // Check results - the callback SHOULD fire for already-occurred events
    // The question is: does it receive the original data?
    if (test2_callback_fired) {
      if (test2_data && test2_data.key === 'test-key' && test2_data.value === 42) {
        console.log('[TEST 2] ✓ PASSED - Late subscriber received data correctly');
        results.push({ test: 'after_trigger_with_data', passed: true, data: test2_data });
      } else {
        console.log('[TEST 2] ✗ FAILED - Late subscriber callback fired but data was:', test2_data);
        console.log('[TEST 2] Expected: { key: "test-key", value: 42, nested: { foo: "bar" } }');
        results.push({ test: 'after_trigger_with_data', passed: false, data: test2_data, expected: { key: 'test-key', value: 42 } });
      }
    } else {
      console.log('[TEST 2] ✗ FAILED - Late subscriber callback did not fire at all');
      results.push({ test: 'after_trigger_with_data', passed: false, data: null, error: 'callback_not_fired' });
    }

    // ==========================================
    // TEST 3: Multiple triggers - data should update
    // ==========================================
    console.log('\n=== TEST 3: Multiple triggers update stored data ===');

    const $test3_container = $('<div>').appendTo(this.$);
    const test3_emitter = $('<div>')
      .component('Event_Emitter', {})
      .appendTo($test3_container)
      .component();

    await test3_emitter.ready();

    // Trigger again with different data
    test3_emitter.trigger('my-event', { key: 'updated-key', value: 999 });

    let test3_data = null;
    test3_emitter.on('my-event', (c, data) => {
      console.log('[TEST 3] Callback fired with data:', data);
      test3_data = data;
    });

    await new Promise(resolve => setTimeout(resolve, 50));

    if (test3_data && test3_data.key === 'updated-key' && test3_data.value === 999) {
      console.log('[TEST 3] ✓ PASSED - Late subscriber received LATEST data after multiple triggers');
      results.push({ test: 'multiple_triggers', passed: true, data: test3_data });
    } else {
      console.log('[TEST 3] ✗ FAILED - Expected updated data, got:', test3_data);
      results.push({ test: 'multiple_triggers', passed: false, data: test3_data });
    }

    // ==========================================
    // SUMMARY
    // ==========================================
    console.log('\n=== TEST SUMMARY ===');
    const passed = results.filter(r => r.passed).length;
    const total = results.length;
    console.log(`Passed: ${passed}/${total}`);

    results.forEach(r => {
      console.log(`  ${r.passed ? '✓' : '✗'} ${r.test}:`, r.data);
    });

    // Set global test result
    window.testPassed = passed === total;
    window.testResults = results;

    // Display results in DOM
    $results.html(`
      <h2>Test Results: ${passed}/${total}</h2>
      <pre>${JSON.stringify(results, null, 2)}</pre>
    `);

    console.log('\n[Test_Root] Tests complete. window.testPassed =', window.testPassed);
  }
}
