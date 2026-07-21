class Test_Load_Only_Flag extends Jqhtml_Component {
  on_create() {
    // Reset tracking globals
    window.__load_only_on_load_fired = false;
    window.__load_only_on_render_fired = false;
    window.__load_only_after_load_fired = false;
    window.__load_only_on_ready_fired = false;
    window.__load_only_child_on_load_fired = false;
  }

  async on_ready() {
    const $results = this.$sid('results');

    // Create component with _load_only flag
    const $target = $('<div>').appendTo($results);
    $target.component('Target_Component', { _load_only: true });

    // Wait for the component's ready event
    const target = $target.component();
    await target.ready();

    // Allow a tick for any straggling async
    await new Promise(r => setTimeout(r, 100));

    let passed = 0;
    let failed = 0;

    // Test 1: on_load() fired
    console.log('');
    console.log('1. ON_LOAD FIRED:');
    if (window.__load_only_on_load_fired === true) {
      console.log('   PASS: on_load() was called');
      passed++;
    } else {
      console.log('   FAIL: on_load() was NOT called');
      failed++;
    }

    // Test 2: on_render() did NOT fire
    console.log('');
    console.log('2. ON_RENDER SUPPRESSED:');
    if (window.__load_only_on_render_fired === false) {
      console.log('   PASS: on_render() was NOT called');
      passed++;
    } else {
      console.log('   FAIL: on_render() was called (should be suppressed)');
      failed++;
    }

    // Test 3: on_loaded() did NOT fire
    console.log('');
    console.log('3. ON_LOADED SUPPRESSED:');
    if (window.__load_only_after_load_fired === false) {
      console.log('   PASS: on_loaded() was NOT called');
      passed++;
    } else {
      console.log('   FAIL: on_loaded() was called (should be suppressed)');
      failed++;
    }

    // Test 4: on_ready() did NOT fire
    console.log('');
    console.log('4. ON_READY SUPPRESSED:');
    if (window.__load_only_on_ready_fired === false) {
      console.log('   PASS: on_ready() was NOT called');
      passed++;
    } else {
      console.log('   FAIL: on_ready() was called (should be suppressed)');
      failed++;
    }

    // Test 5: No child components created (render was skipped)
    console.log('');
    console.log('5. NO CHILDREN CREATED:');
    if (window.__load_only_child_on_load_fired === false) {
      console.log('   PASS: No child components were created (render skipped)');
      passed++;
    } else {
      console.log('   FAIL: Child component on_load fired (render should have been skipped)');
      failed++;
    }

    // Test 6: Ready event fired
    console.log('');
    console.log('6. READY EVENT FIRED:');
    // If we got here via await target.ready(), the event fired
    console.log('   PASS: ready event fired (target.ready() resolved)');
    passed++;

    // Test 7: Data was loaded despite no render
    console.log('');
    console.log('7. DATA WAS LOADED:');
    if (target.data.value === 'loaded') {
      console.log('   PASS: this.data.value is "loaded"');
      passed++;
    } else {
      console.log('   FAIL: this.data.value is "' + target.data.value + '" (expected "loaded")');
      failed++;
    }

    console.log('');
    console.log('========================================');
    console.log('SUMMARY: ' + passed + ' passed, ' + failed + ' failed');
    console.log('========================================');
    console.log('');

    window.testPassed = (failed === 0);
    window.testReady = true;
  }
}
