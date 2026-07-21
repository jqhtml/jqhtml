/**
 * Test component - main test harness
 */
class Loaded_Event_Test extends Jqhtml_Component {
  on_create() {
    this.state.results = [];
  }

  async on_ready() {
    const with_load = this.sid('with_load');
    const without_load = this.sid('without_load');

    // Wait for children to be ready
    await with_load.ready();
    await without_load.ready();

    // Verify results
    const with_load_fired = with_load.state.loaded_event_fired;
    const with_load_time = with_load.state.loaded_event_time;
    const with_load_on_load_end = with_load.state.on_load_end_time;

    const without_load_fired = without_load.state.loaded_event_fired;

    console.log('[TEST] With_On_Load loaded event fired:', with_load_fired);
    console.log('[TEST] Without_On_Load loaded event fired:', without_load_fired);

    let passed = true;

    // Test 1: 'loaded' event should fire for component with on_load
    if (!with_load_fired) {
      console.log('[FAIL] loaded event did not fire for component WITH on_load');
      passed = false;
    } else {
      console.log('[PASS] loaded event fired for component WITH on_load');
    }

    // Test 2: 'loaded' event should fire for component without on_load
    if (!without_load_fired) {
      console.log('[FAIL] loaded event did not fire for component WITHOUT on_load');
      passed = false;
    } else {
      console.log('[PASS] loaded event fired for component WITHOUT on_load');
    }

    // Test 3: 'loaded' event should fire AFTER on_load completes
    if (with_load_time && with_load_on_load_end) {
      if (with_load_time >= with_load_on_load_end) {
        console.log('[PASS] loaded event fired after on_load completed');
      } else {
        console.log('[FAIL] loaded event fired before on_load completed');
        passed = false;
      }
    }

    // Summary
    console.log('');
    console.log('========================================');
    if (passed) {
      console.log('[TEST PASSED] All loaded event tests passed');
    } else {
      console.log('[TEST FAILED] Some loaded event tests failed');
    }
    console.log('========================================');

    window.testPassed = passed;
    window.testReady = true;
  }
}
