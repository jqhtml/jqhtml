class Rendered_Event_Test extends Jqhtml_Component {
  async on_ready() {
    const cacheMode = window.__JQHTML_TEST_CACHE_MODE__ || 'none';

    console.log('');
    console.log('========================================');
    console.log('TESTING rendered() EVENT AND METHOD:');
    console.log(`Cache mode: ${cacheMode}`);
    console.log('========================================');

    const tests = [];
    window.__rendered_order_log = [];

    // --- TEST 1 + TEST 3 setup: create a component and immediately grab its
    // rendered() promise before the lifecycle has had a chance to complete.
    const $target = $('<div>').appendTo(this.$sid('results'));
    $target.component('Rendered_Order_Child', {});
    const target = $target.component();

    // TEST 1: await component.rendered() resolves
    const rendered_promise = target.rendered();
    let test1_pass = false;
    if (rendered_promise && typeof rendered_promise.then === 'function') {
      await rendered_promise;
      test1_pass = true;
    }
    if (test1_pass) {
      console.log('✅ TEST 1 PASS: await component.rendered() resolved');
      tests.push(true);
    } else {
      console.log('❌ TEST 1 FAIL: component.rendered() did not return an awaitable promise');
      tests.push(false);
    }

    // Let the component finish its full lifecycle (rendered() only waits for
    // the synchronous render chain, not for children/ready).
    await target.ready();

    // TEST 2: 'rendered' is sticky - a NEW .on('rendered', cb) registered
    // after the fact must fire immediately (synchronously, within .on()).
    let sticky_fired = false;
    target.on('rendered', () => {
      sticky_fired = true;
    });
    if (sticky_fired) {
      console.log("✅ TEST 2 PASS: .on('rendered', cb) after the fact fired immediately (sticky)");
      tests.push(true);
    } else {
      console.log("❌ TEST 2 FAIL: .on('rendered', cb) did not fire immediately for an already-rendered component");
      tests.push(false);
    }

    // TEST 3: ordering - 'rendered' must fire BEFORE 'ready'.
    // Rendered_Order_Child registers both listeners in on_create(), before its
    // own first render, so window.__rendered_order_log reflects true firing order.
    const order = window.__rendered_order_log;
    const rendered_idx = order.indexOf('rendered');
    const ready_idx = order.indexOf('ready');
    if (rendered_idx !== -1 && ready_idx !== -1 && rendered_idx < ready_idx) {
      console.log(`✅ TEST 3 PASS: 'rendered' fired before 'ready' (order: [${order.join(', ')}])`);
      tests.push(true);
    } else {
      console.log(`❌ TEST 3 FAIL: unexpected event order: [${order.join(', ')}]`);
      tests.push(false);
    }

    // TEST 4: a component booted with _load_render_only must NOT fire 'rendered'
    // (lifecycle-manager returns before the 'rendered' trigger for that flag).
    let lro_rendered_fired = false;
    const $lro = $('<div>').appendTo(this.$sid('results'));
    $lro.component('Rendered_Flag_Target', { _load_render_only: true });
    const lro = $lro.component();
    lro.on('rendered', () => {
      lro_rendered_fired = true;
    });
    await lro.ready();
    // Give any stray async trigger a chance to fire before asserting absence.
    await new Promise((resolve) => setTimeout(resolve, 100));

    if (lro_rendered_fired === false) {
      console.log("✅ TEST 4 PASS: _load_render_only component did NOT fire 'rendered'");
      tests.push(true);
    } else {
      console.log("❌ TEST 4 FAIL: _load_render_only component fired 'rendered' (should be suppressed)");
      tests.push(false);
    }

    console.log('');
    const all_passed = tests.every((t) => t);
    if (all_passed) {
      console.log('✅ ALL TESTS PASSED');
      this.$sid('results_status').html('<span style="color: green;">✅ All tests passed</span>');
    } else {
      console.log('❌ SOME TESTS FAILED');
      this.$sid('results_status').html('<span style="color: red;">❌ Some tests failed</span>');
    }
    console.log('========================================');

    window.testPassed = all_passed;
    window.testReady = true;
  }
}
