class Stop_Test extends Jqhtml_Component {
  on_ready() {
    // Start interval
    this.update_interval = setInterval(() => {
      console.log('Interval running');
    }, 100);

    console.log('Interval started');

    // Schedule stop() call after 500ms
    setTimeout(() => {
      console.log('');
      console.log('========================================');
      console.log('CALLING stop():');
      console.log('========================================');
      console.log('');

      const before_stop = Date.now();
      this.stop(); // Synchronous
      const after_stop = Date.now();

      console.log('stop() completed');
      console.log(`stop() execution time: ${after_stop - before_stop}ms (should be < 5ms - synchronous)`);
      console.log('');

      // DOM should still exist after stop()
      const still_in_dom = $('.Stop_Test').length > 0;
      console.log(`Component still in DOM: ${still_in_dom}`);
      console.log('');

      // Check for _Component_Stopped class
      const has_stopped_class = this.$.hasClass('_Component_Stopped');
      console.log(`Has _Component_Stopped class: ${has_stopped_class}`);
      console.log('');

      // Validate results
      console.log('========================================');
      console.log('VALIDATION:');
      console.log('========================================');
      console.log('');

      const tests = [];

      // TEST 1: on_stop() was called (check flag we set)
      if (this.stop_called) {
        console.log('✅ TEST 1 PASS: on_stop() was called');
        tests.push(true);
      } else {
        console.log('❌ TEST 1 FAIL: on_stop() was NOT called');
        tests.push(false);
      }

      // TEST 2: Interval was cleared (check flag we set)
      if (this.interval_cleared) {
        console.log('✅ TEST 2 PASS: Interval cleared in on_stop()');
        tests.push(true);
      } else {
        console.log('❌ TEST 2 FAIL: Interval NOT cleared');
        tests.push(false);
      }

      // TEST 3: Component still in DOM
      if (still_in_dom) {
        console.log('✅ TEST 3 PASS: Component still in DOM after stop()');
        tests.push(true);
      } else {
        console.log('❌ TEST 3 FAIL: Component removed from DOM (should not be)');
        tests.push(false);
      }

      // TEST 4: stop() was synchronous (< 5ms)
      const execution_time = after_stop - before_stop;
      if (execution_time < 5) {
        console.log(`✅ TEST 4 PASS: stop() is synchronous (${execution_time}ms)`);
        tests.push(true);
      } else {
        console.log(`❌ TEST 4 FAIL: stop() took too long (${execution_time}ms)`);
        tests.push(false);
      }

      // TEST 5: Has _Component_Stopped class
      if (has_stopped_class) {
        console.log('✅ TEST 5 PASS: _Component_Stopped class added');
        tests.push(true);
      } else {
        console.log('❌ TEST 5 FAIL: _Component_Stopped class NOT added');
        tests.push(false);
      }

      console.log('');

      // Final result
      const all_passed = tests.every(t => t);
      if (all_passed) {
        console.log('✅ ALL TESTS PASSED');
        $('#results').html('<span style="color: green;">✅ All tests passed</span>');
      } else {
        console.log('❌ SOME TESTS FAILED');
        $('#results').html('<span style="color: red;">❌ Some tests failed</span>');
      }

      console.log('');
      console.log('========================================');
      console.log('');

    }, 500);
  }

  on_stop() {
    // Set flag to verify on_stop was called
    this.stop_called = true;

    // Cleanup interval
    if (this.update_interval) {
      clearInterval(this.update_interval);
      this.update_interval = null;
      this.interval_cleared = true;
      console.log('Interval cleared in on_stop()');
    }
  }
}
