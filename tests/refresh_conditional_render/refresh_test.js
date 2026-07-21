class Refresh_Test extends Jqhtml_Component {
  async on_ready() {
    console.log('');
    console.log('========================================');
    console.log('refresh() CONDITIONAL RENDERING TEST:');
    console.log('========================================');
    console.log('');

    const tests = [];
    const counter = this.$sid('counter_container').find('.Counter').component();

    // Wait for initial render to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    // TEST 1: refresh() with unchanged data (should NOT re-render)
    console.log('TEST 1: refresh() with unchanged data');
    const renders_before_test1 = window.counter_stats.render_count;
    const ready_before_test1 = window.counter_stats.ready_count;
    console.log(`  Renders before: ${renders_before_test1}`);
    console.log(`  Ready calls before: ${ready_before_test1}`);

    // Server data unchanged (still count: 1)
    window.server_data.count = 1;
    await counter.refresh();
    await new Promise(resolve => setTimeout(resolve, 100));

    const renders_after_test1 = window.counter_stats.render_count;
    const ready_after_test1 = window.counter_stats.ready_count;
    console.log(`  Renders after: ${renders_after_test1}`);
    console.log(`  Ready calls after: ${ready_after_test1}`);
    console.log(`  Expected: NO new renders, NO new on_ready calls`);

    if (renders_after_test1 === renders_before_test1 && ready_after_test1 === ready_before_test1) {
      console.log('✅ PASS: refresh() did NOT re-render when data unchanged');
      tests.push(true);
    } else {
      console.log(`❌ FAIL: refresh() re-rendered when it shouldn't`);
      tests.push(false);
    }
    console.log('');

    // TEST 2: refresh() with changed data (should re-render)
    console.log('TEST 2: refresh() with changed data');
    const renders_before_test2 = window.counter_stats.render_count;
    const ready_before_test2 = window.counter_stats.ready_count;
    console.log(`  Renders before: ${renders_before_test2}`);
    console.log(`  Ready calls before: ${ready_before_test2}`);

    // Server data changes
    window.server_data.count = 2;
    await counter.refresh();
    await new Promise(resolve => setTimeout(resolve, 100));

    const renders_after_test2 = window.counter_stats.render_count;
    const ready_after_test2 = window.counter_stats.ready_count;
    const count_displayed = counter.$.find('.count').text();
    console.log(`  Renders after: ${renders_after_test2}`);
    console.log(`  Ready calls after: ${ready_after_test2}`);
    console.log(`  Count displayed: "${count_displayed}"`);
    console.log(`  Expected: 1 new render, 1 new on_ready call, count shows "2"`);

    if (renders_after_test2 === renders_before_test2 + 1 &&
        ready_after_test2 === ready_before_test2 + 1 &&
        count_displayed === '2') {
      console.log('✅ PASS: refresh() re-rendered when data changed');
      tests.push(true);
    } else {
      console.log(`❌ FAIL: refresh() did not behave correctly with changed data`);
      tests.push(false);
    }
    console.log('');

    // TEST 3: reload() always re-renders (even with unchanged data)
    console.log('TEST 3: reload() always re-renders');
    const renders_before_test3 = window.counter_stats.render_count;
    const ready_before_test3 = window.counter_stats.ready_count;
    console.log(`  Renders before: ${renders_before_test3}`);
    console.log(`  Ready calls before: ${ready_before_test3}`);

    // Server data unchanged (still count: 2)
    window.server_data.count = 2;
    await counter.reload();
    await new Promise(resolve => setTimeout(resolve, 100));

    const renders_after_test3 = window.counter_stats.render_count;
    const ready_after_test3 = window.counter_stats.ready_count;
    console.log(`  Renders after: ${renders_after_test3}`);
    console.log(`  Ready calls after: ${ready_after_test3}`);
    console.log(`  Expected: 1 new render, 1 new on_ready call (even though data unchanged)`);

    if (renders_after_test3 === renders_before_test3 + 1 &&
        ready_after_test3 === ready_before_test3 + 1) {
      console.log('✅ PASS: reload() always re-renders');
      tests.push(true);
    } else {
      console.log(`❌ FAIL: reload() did not re-render`);
      tests.push(false);
    }
    console.log('');

    // TEST 4: Debounce precedence - reload() beats refresh()
    console.log('TEST 4: Debounce precedence - reload() beats refresh()');
    const renders_before_test4 = window.counter_stats.render_count;
    console.log(`  Renders before: ${renders_before_test4}`);

    // Call refresh() (reload(false)), then reload() (reload(true))
    // Both will execute (debounced), but reload(true) forces the second execution to always render
    window.server_data.count = 2; // Unchanged from previous test
    const refresh_promise = counter.refresh();
    const reload_promise = counter.reload();

    await Promise.all([refresh_promise, reload_promise]);
    await new Promise(resolve => setTimeout(resolve, 100));

    const renders_after_test4 = window.counter_stats.render_count;
    console.log(`  Renders after: ${renders_after_test4}`);
    console.log(`  Expected: 2 new renders (both debounced calls execute, reload(true) precedence ensures second call always renders)`);

    if (renders_after_test4 === renders_before_test4 + 2) {
      console.log('✅ PASS: Both calls executed with reload() precedence');
      tests.push(true);
    } else {
      console.log(`❌ FAIL: Expected 2 renders, got ${renders_after_test4 - renders_before_test4}`);
      tests.push(false);
    }
    console.log('');

    // TEST 5: Verify counts displayed correctly
    console.log('TEST 5: Final state verification');
    const final_count = counter.$.find('.count').text();
    const final_renders = counter.$sid('render_count').text();
    const final_ready = counter.$sid('ready_count').text();

    console.log(`  Final count: "${final_count}"`);
    console.log(`  Final render count displayed: "${final_renders}"`);
    console.log(`  Final ready count displayed: "${final_ready}"`);
    console.log(`  Expected: count "2", renders match window.counter_stats`);

    if (final_count === '2' &&
        final_renders === window.counter_stats.render_count.toString() &&
        final_ready === window.counter_stats.ready_count.toString()) {
      console.log('✅ PASS: Final state correct');
      tests.push(true);
    } else {
      console.log(`❌ FAIL: Final state incorrect`);
      tests.push(false);
    }
    console.log('');

    // Final result
    console.log('========================================');
    const all_passed = tests.every(t => t);
    if (all_passed) {
      console.log('✅ ALL TESTS PASSED');
      this.$sid('results').html('<span style="color: green;">✅ All tests passed</span>');
    } else {
      console.log('❌ SOME TESTS FAILED');
      this.$sid('results').html('<span style="color: red;">❌ Some tests failed</span>');
    }
    console.log('========================================');
    console.log('');
  }
}
