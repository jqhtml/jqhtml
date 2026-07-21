class Test_Container extends Jqhtml_Component {
  async on_ready() {
    console.log('');
    console.log('========================================');
    console.log('RELOAD READY INVALIDATION TESTS:');
    console.log('========================================');
    console.log('');

    const component = this.sid('test_component');
    let all_passed = true;
    const results = [];

    // Wait for initial ready to complete
    await component.ready();
    console.log('[Test] Initial ready complete, reload_count should be 1');
    console.log(`[Test] Current reload_count: ${component.data.reload_count}`);

    // Test 1: Verify initial state
    const test1_passed = component.data.reload_count === 1;
    results.push({
      name: 'Test 1: Initial load completes',
      passed: test1_passed,
      expected: 1,
      actual: component.data.reload_count
    });
    if (!test1_passed) all_passed = false;

    // Test 2: Add .on('ready') handler DURING reload and verify it doesn't fire prematurely
    console.log('');
    console.log('[Test 2] Starting reload and adding .on("ready") handler mid-reload...');

    let handler_fired_at_count = null;
    let handler_fired_prematurely = false;

    // Start reload (don't await yet)
    const reload_promise = component.reload();

    // Immediately after starting reload, add a ready handler
    // This should NOT fire until reload completes (reload_count should be 2)
    component.on('ready', () => {
      handler_fired_at_count = component.data.reload_count;
      console.log(`[Test 2] Handler fired! reload_count at fire time: ${handler_fired_at_count}`);

      // If we fire when reload_count is still 1, that's premature (bug)
      if (handler_fired_at_count < 2) {
        handler_fired_prematurely = true;
        console.log('[Test 2] BUG DETECTED: Handler fired before reload completed!');
      }
    });

    // Now wait for reload to complete
    await reload_promise;
    console.log(`[Test 2] Reload complete, reload_count: ${component.data.reload_count}`);

    const test2_passed = !handler_fired_prematurely && handler_fired_at_count === 2;
    results.push({
      name: 'Test 2: Handler added during reload waits for completion',
      passed: test2_passed,
      expected: 'handler fires at reload_count=2',
      actual: `handler fired at reload_count=${handler_fired_at_count}, premature=${handler_fired_prematurely}`
    });
    if (!test2_passed) all_passed = false;

    // Test 3: await component.ready() during reload should wait
    console.log('');
    console.log('[Test 3] Starting reload and calling await ready() mid-reload...');

    let ready_resolved_at_count = null;

    // Start another reload (don't await yet)
    const reload_promise_2 = component.reload();

    // Call ready() immediately - should wait for reload to complete
    const ready_promise = component.ready().then(() => {
      ready_resolved_at_count = component.data.reload_count;
      console.log(`[Test 3] ready() resolved! reload_count: ${ready_resolved_at_count}`);
    });

    // Wait for reload
    await reload_promise_2;
    await ready_promise;

    console.log(`[Test 3] After reload, ready_resolved_at_count: ${ready_resolved_at_count}`);

    const test3_passed = ready_resolved_at_count === 3;
    results.push({
      name: 'Test 3: await ready() during reload waits for completion',
      passed: test3_passed,
      expected: 3,
      actual: ready_resolved_at_count
    });
    if (!test3_passed) all_passed = false;

    // Print results
    console.log('');
    console.log('========================================');
    console.log('TEST RESULTS:');
    console.log('========================================');
    console.log('');

    results.forEach((test, i) => {
      const status = test.passed ? '✅ PASS' : '❌ FAIL';
      console.log(`${test.name}: ${status}`);
      console.log(`   Expected: ${test.expected}`);
      console.log(`   Actual: ${test.actual}`);
      console.log('');
    });

    console.log('========================================');
    console.log('FINAL RESULT:');
    console.log('========================================');

    if (all_passed) {
      console.log('✅ ALL RELOAD READY TESTS PASSED');
      this.$sid('results').html('<h3 style="color: green;">✅ All tests passed</h3>');
      window.testPassed = true;
    } else {
      console.log('❌ SOME RELOAD READY TESTS FAILED');
      console.log('');
      console.log('This indicates the bug: .on("ready") handlers added during reload');
      console.log('fire immediately instead of waiting for the reload to complete.');
      this.$sid('results').html('<h3 style="color: red;">❌ Some tests failed - see console for details</h3>');
      window.testPassed = false;
    }

    console.log('');
    console.log('========================================');
    console.log('');
  }
}
