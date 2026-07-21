class Test_SSR_Preload extends Jqhtml_Component {
  on_create() {
    this.state.test_ran = false;
  }

  async on_ready() {
    if (this.state.test_ran) return;
    this.state.test_ran = true;

    let passed = 0;
    let failed = 0;

    function assert(name, condition) {
      if (condition) {
        console.log('   PASS: ' + name);
        passed++;
      } else {
        console.log('   FAIL: ' + name);
        failed++;
      }
    }

    // ============================================================
    // Test 1: DATA CAPTURE — start_data_capture + get_captured_data
    // ============================================================
    console.log('');
    console.log('1. DATA CAPTURE:');

    jqhtml.start_data_capture();

    // Create a component with on_load — its data should be captured
    const $cap1 = $('<div>').appendTo(this.$);
    $cap1.component('Preload_Child', {});
    const cap1 = $cap1.component();
    await cap1.ready();

    // Create a static component — should NOT be captured
    const $cap2 = $('<div>').appendTo(this.$);
    $cap2.component('Static_Child', {});
    const cap2 = $cap2.component();
    await cap2.ready();

    const captured = jqhtml.get_captured_data();

    assert('Captured array has 1 entry (only on_load component)', captured.length === 1);
    assert('Captured component name is Preload_Child', captured[0] && captured[0].component === 'Preload_Child');
    assert('Captured data has value from on_load', captured[0] && captured[0].data.value === 'from_on_load');
    assert('Captured data has source from on_load', captured[0] && captured[0].data.source === 'on_load');
    assert('Captured args is plain object', captured[0] && typeof captured[0].args === 'object');

    // Verify one-shot: second call returns empty
    const captured2 = jqhtml.get_captured_data();
    assert('get_captured_data() returns empty after first call (one-shot)', captured2.length === 0);

    // Clean up captured components
    cap1.stop();
    $cap1.remove();
    cap2.stop();
    $cap2.remove();

    // ============================================================
    // Test 2: DATA CAPTURE — deduplication (same component+args)
    // ============================================================
    console.log('');
    console.log('2. CAPTURE DEDUPLICATION:');

    jqhtml.start_data_capture();

    // Create two components with same name and args — Load Coordinator deduplicates
    const $dup1 = $('<div>').appendTo(this.$);
    const $dup2 = $('<div>').appendTo(this.$);
    $dup1.component('Preload_Child', {});
    $dup2.component('Preload_Child', {});
    const dup1 = $dup1.component();
    const dup2 = $dup2.component();
    await dup1.ready();
    await dup2.ready();

    const captured_dedup = jqhtml.get_captured_data();

    assert('Deduplicated capture: only 1 entry for 2 identical components', captured_dedup.length === 1);

    // Clean up
    dup1.stop();
    $dup1.remove();
    dup2.stop();
    $dup2.remove();

    // ============================================================
    // Test 3: PRELOAD — set_preload_data skips on_load
    // ============================================================
    console.log('');
    console.log('3. PRELOAD SKIPS ON_LOAD:');

    // Seed preload data with custom values (different from what on_load would produce)
    jqhtml.set_preload_data([
      {
        component: 'Preload_Child',
        args: {},
        data: { value: 'from_ssr', source: 'preloaded' }
      }
    ]);

    const start_time = Date.now();

    const $pre1 = $('<div>').appendTo(this.$);
    $pre1.component('Preload_Child', {});
    const pre1 = $pre1.component();
    await pre1.ready();

    const elapsed = Date.now() - start_time;

    assert('Preloaded component has SSR data (value)', pre1.data.value === 'from_ssr');
    assert('Preloaded component has SSR data (source)', pre1.data.source === 'preloaded');
    assert('Preload was fast (on_load skipped, < 200ms)', elapsed < 200);

    // The component's rendered content should show preloaded data
    const rendered_text = $pre1.find('span').text();
    assert('Rendered content shows preloaded value', rendered_text === 'from_ssr');

    // Clean up
    pre1.stop();
    $pre1.remove();

    // ============================================================
    // Test 4: PRELOAD — one-shot consumption
    // ============================================================
    console.log('');
    console.log('4. PRELOAD ONE-SHOT:');

    // Seed again
    jqhtml.set_preload_data([
      {
        component: 'Preload_Child',
        args: {},
        data: { value: 'ssr_oneshot', source: 'preloaded' }
      }
    ]);

    // First component consumes the preload
    const $os1 = $('<div>').appendTo(this.$);
    $os1.component('Preload_Child', {});
    const os1 = $os1.component();
    await os1.ready();

    assert('First component got preloaded data', os1.data.value === 'ssr_oneshot');

    // Second component with same args — preload consumed, should run on_load
    const $os2 = $('<div>').appendTo(this.$);
    $os2.component('Preload_Child', {});
    const os2 = $os2.component();
    await os2.ready();

    assert('Second component ran on_load (preload consumed)', os2.data.value === 'from_on_load');

    // Clean up
    os1.stop();
    $os1.remove();
    os2.stop();
    $os2.remove();

    // ============================================================
    // Test 5: PRELOAD — clear_preload_data
    // ============================================================
    console.log('');
    console.log('5. CLEAR PRELOAD DATA:');

    jqhtml.set_preload_data([
      {
        component: 'Preload_Child',
        args: {},
        data: { value: 'should_be_cleared', source: 'preloaded' }
      }
    ]);

    jqhtml.clear_preload_data();

    // Component should run on_load normally since preload was cleared
    const $cl1 = $('<div>').appendTo(this.$);
    $cl1.component('Preload_Child', {});
    const cl1 = $cl1.component();
    await cl1.ready();

    assert('Component ran on_load after clear_preload_data', cl1.data.value === 'from_on_load');

    // Clean up
    cl1.stop();
    $cl1.remove();

    // ============================================================
    // Test 6: PRELOAD — args-based key matching
    // ============================================================
    console.log('');
    console.log('6. PRELOAD ARGS MATCHING:');

    jqhtml.set_preload_data([
      {
        component: 'Preload_Child',
        args: { filter: 'active' },
        data: { value: 'ssr_active', source: 'preloaded' }
      }
    ]);

    // Component with matching args — should get preloaded data
    const $am1 = $('<div>').appendTo(this.$);
    $am1.component('Preload_Child', { filter: 'active' });
    const am1 = $am1.component();
    await am1.ready();

    assert('Matching args: got preloaded data', am1.data.value === 'ssr_active');

    // Component with different args — should run on_load
    const $am2 = $('<div>').appendTo(this.$);
    $am2.component('Preload_Child', { filter: 'inactive' });
    const am2 = $am2.component();
    await am2.ready();

    assert('Different args: ran on_load normally', am2.data.value === 'from_on_load');

    // Clean up
    am1.stop();
    $am1.remove();
    am2.stop();
    $am2.remove();

    // ============================================================
    // Test 7: PRELOAD — set_preload_data with null/empty is no-op
    // ============================================================
    console.log('');
    console.log('7. SET_PRELOAD_DATA EDGE CASES:');

    // These should not throw
    jqhtml.set_preload_data(null);
    jqhtml.set_preload_data([]);

    // Component should still run on_load normally
    const $ec1 = $('<div>').appendTo(this.$);
    $ec1.component('Preload_Child', {});
    const ec1 = $ec1.component();
    await ec1.ready();

    assert('null preload: component runs on_load', ec1.data.value === 'from_on_load');

    // Clean up
    ec1.stop();
    $ec1.remove();

    // ============================================================
    // Test 8: FULL ROUND-TRIP — capture then preload
    // ============================================================
    console.log('');
    console.log('8. FULL ROUND-TRIP (CAPTURE → PRELOAD):');

    // Simulate SSR: capture data
    jqhtml.start_data_capture();

    const $rt1 = $('<div>').appendTo(this.$);
    $rt1.component('Preload_Child', { id: 'roundtrip' });
    const rt1 = $rt1.component();
    await rt1.ready();

    const rt_captured = jqhtml.get_captured_data();
    assert('Round-trip: captured 1 entry', rt_captured.length === 1);
    assert('Round-trip: captured value is from_on_load', rt_captured[0].data.value === 'from_on_load');

    rt1.stop();
    $rt1.remove();

    // Simulate client: inject captured data as preload
    jqhtml.set_preload_data(rt_captured);

    const start_rt = Date.now();
    const $rt2 = $('<div>').appendTo(this.$);
    $rt2.component('Preload_Child', { id: 'roundtrip' });
    const rt2 = $rt2.component();
    await rt2.ready();
    const elapsed_rt = Date.now() - start_rt;

    assert('Round-trip: preloaded component has correct data', rt2.data.value === 'from_on_load');
    assert('Round-trip: preload was fast (< 200ms)', elapsed_rt < 200);

    // Clean up
    rt2.stop();
    $rt2.remove();
    jqhtml.clear_preload_data();

    // ============================================================
    // Test 9: CAPTURE — static components excluded
    // ============================================================
    console.log('');
    console.log('9. STATIC COMPONENTS EXCLUDED FROM CAPTURE:');

    jqhtml.start_data_capture();

    // Only create static components
    const $sc1 = $('<div>').appendTo(this.$);
    $sc1.component('Static_Child', {});
    const sc1 = $sc1.component();
    await sc1.ready();

    const static_captured = jqhtml.get_captured_data();
    assert('Static component not captured (0 entries)', static_captured.length === 0);

    sc1.stop();
    $sc1.remove();

    // ============================================================
    // Summary
    // ============================================================
    console.log('');
    console.log('========================================');
    console.log('SUMMARY: ' + passed + ' passed, ' + failed + ' failed');
    console.log('========================================');
    console.log('');

    window.testPassed = (failed === 0);
    window.testReady = true;
  }
}
