class Test_Load_Render_Only_Flag extends Jqhtml_Component {
  on_create() {
    // Reset tracking globals
    window.__lro_parent_on_load_fired = false;
    window.__lro_parent_on_render_count = 0;
    window.__lro_parent_after_load_fired = false;
    window.__lro_parent_on_ready_fired = false;
    window.__lro_child_a_on_load_fired = false;
    window.__lro_child_a_on_render_fired = false;
    window.__lro_child_a_after_load_fired = false;
    window.__lro_child_a_on_ready_fired = false;
    window.__lro_child_b_on_load_fired = false;
    window.__lro_child_b_on_render_fired = false;
    window.__lro_child_b_after_load_fired = false;
    window.__lro_child_b_on_ready_fired = false;
  }

  async on_ready() {
    const $results = this.$sid('results');

    // Create parent component with _load_render_only flag
    const $parent = $('<div>').appendTo($results);
    $parent.component('Parent_Component', { _load_render_only: true });

    // Wait for the component's ready event
    const parent = $parent.component();
    await parent.ready();

    // Allow time for child components to complete
    await new Promise(r => setTimeout(r, 500));

    let passed = 0;
    let failed = 0;

    // Test 1: Parent on_load() fired
    console.log('');
    console.log('1. PARENT ON_LOAD FIRED:');
    if (window.__lro_parent_on_load_fired === true) {
      console.log('   PASS: Parent on_load() was called');
      passed++;
    } else {
      console.log('   FAIL: Parent on_load() was NOT called');
      failed++;
    }

    // Test 2: Parent on_render() did NOT fire
    console.log('');
    console.log('2. PARENT ON_RENDER SUPPRESSED:');
    if (window.__lro_parent_on_render_count === 0) {
      console.log('   PASS: Parent on_render() was NOT called (count: 0)');
      passed++;
    } else {
      console.log('   FAIL: Parent on_render() was called ' + window.__lro_parent_on_render_count + ' times (should be 0)');
      failed++;
    }

    // Test 3: Parent on_loaded() did NOT fire
    console.log('');
    console.log('3. PARENT ON_LOADED SUPPRESSED:');
    if (window.__lro_parent_after_load_fired === false) {
      console.log('   PASS: Parent on_loaded() was NOT called');
      passed++;
    } else {
      console.log('   FAIL: Parent on_loaded() was called (should be suppressed)');
      failed++;
    }

    // Test 4: Parent on_ready() did NOT fire
    console.log('');
    console.log('4. PARENT ON_READY SUPPRESSED:');
    if (window.__lro_parent_on_ready_fired === false) {
      console.log('   PASS: Parent on_ready() was NOT called');
      passed++;
    } else {
      console.log('   FAIL: Parent on_ready() was called (should be suppressed)');
      failed++;
    }

    // Test 5: Child A on_load() DID fire (children created via render)
    console.log('');
    console.log('5. CHILD A ON_LOAD FIRED (CHILDREN CREATED):');
    if (window.__lro_child_a_on_load_fired === true) {
      console.log('   PASS: Child A on_load() was called');
      passed++;
    } else {
      console.log('   FAIL: Child A on_load() was NOT called (children should be created)');
      failed++;
    }

    // Test 6: Child B on_load() DID fire
    console.log('');
    console.log('6. CHILD B ON_LOAD FIRED:');
    if (window.__lro_child_b_on_load_fired === true) {
      console.log('   PASS: Child B on_load() was called');
      passed++;
    } else {
      console.log('   FAIL: Child B on_load() was NOT called');
      failed++;
    }

    // Test 7: Child A on_render() did NOT fire (flag cascades)
    console.log('');
    console.log('7. CHILD A ON_RENDER SUPPRESSED (FLAG CASCADES):');
    if (window.__lro_child_a_on_render_fired !== true) {
      console.log('   PASS: Child A on_render() was NOT called');
      passed++;
    } else {
      console.log('   FAIL: Child A on_render() was called (flag should cascade)');
      failed++;
    }

    // Test 8: Child A on_loaded() did NOT fire (flag cascades)
    console.log('');
    console.log('8. CHILD A ON_LOADED SUPPRESSED (FLAG CASCADES):');
    if (window.__lro_child_a_after_load_fired !== true) {
      console.log('   PASS: Child A on_loaded() was NOT called');
      passed++;
    } else {
      console.log('   FAIL: Child A on_loaded() was called (flag should cascade)');
      failed++;
    }

    // Test 9: Child A on_ready() did NOT fire (flag cascades)
    console.log('');
    console.log('9. CHILD A ON_READY SUPPRESSED (FLAG CASCADES):');
    if (window.__lro_child_a_on_ready_fired !== true) {
      console.log('   PASS: Child A on_ready() was NOT called');
      passed++;
    } else {
      console.log('   FAIL: Child A on_ready() was called (flag should cascade)');
      failed++;
    }

    // Test 10: Child B on_render() did NOT fire (flag cascades)
    console.log('');
    console.log('10. CHILD B ON_RENDER SUPPRESSED:');
    if (window.__lro_child_b_on_render_fired !== true) {
      console.log('   PASS: Child B on_render() was NOT called');
      passed++;
    } else {
      console.log('   FAIL: Child B on_render() was called');
      failed++;
    }

    // Test 11: Child B on_loaded() did NOT fire
    console.log('');
    console.log('11. CHILD B ON_LOADED SUPPRESSED:');
    if (window.__lro_child_b_after_load_fired !== true) {
      console.log('   PASS: Child B on_loaded() was NOT called');
      passed++;
    } else {
      console.log('   FAIL: Child B on_loaded() was called');
      failed++;
    }

    // Test 12: Child B on_ready() did NOT fire
    console.log('');
    console.log('12. CHILD B ON_READY SUPPRESSED:');
    if (window.__lro_child_b_on_ready_fired !== true) {
      console.log('   PASS: Child B on_ready() was NOT called');
      passed++;
    } else {
      console.log('   FAIL: Child B on_ready() was called');
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
