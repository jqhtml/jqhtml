class Render_Promise_Test extends Jqhtml_Component {
  on_create() {
    this.args.label = this.args.label || 'first';
  }

  on_ready() {
    window.ready_count = (window.ready_count || 0) + 1;

    // Only drive the test from the FIRST on_ready; re-renders re-enter here
    if (this.state.testing) return;
    this.state.testing = true;

    setTimeout(async () => {
      console.log('');
      console.log('========================================');
      console.log('TESTING render() PROMISE SEMANTICS:');
      console.log('========================================');
      const tests = [];

      this.args.label = 'second';
      const ready_before = window.ready_count;
      const p = this.render();

      // TEST 1: render() returns a thenable
      if (p && typeof p.then === 'function') {
        console.log('✅ TEST 1 PASS: render() returns a Promise');
        tests.push(true);
      } else {
        console.log(`❌ TEST 1 FAIL: render() returned ${typeof p}, not a Promise`);
        tests.push(false);
      }

      // TEST 2: at this point (before awaiting) the re-render lifecycle has
      // not completed yet - on_ready for the new render hasn't fired
      if (window.ready_count === ready_before) {
        console.log('✅ TEST 2 PASS: lifecycle not yet complete before await');
        tests.push(true);
      } else {
        console.log('❌ TEST 2 FAIL: on_ready already ran synchronously');
        tests.push(false);
      }

      if (p && typeof p.then === 'function') {
        await p;
      }

      // TEST 3: after awaiting, the re-render's on_ready has run
      if (window.ready_count === ready_before + 1) {
        console.log('✅ TEST 3 PASS: await render() resolved AFTER on_ready ran');
        tests.push(true);
      } else {
        console.log(`❌ TEST 3 FAIL: ready_count=${window.ready_count}, expected ${ready_before + 1} - promise resolved before lifecycle completed`);
        tests.push(false);
      }

      // TEST 4: after awaiting, the DOM reflects the new args
      const dom_ok = this.$sid('label').text().includes('second');
      if (dom_ok) {
        console.log('✅ TEST 4 PASS: DOM updated when await render() resolved');
        tests.push(true);
      } else {
        console.log(`❌ TEST 4 FAIL: DOM still shows "${this.$sid('label').text()}" after await`);
        tests.push(false);
      }

      // TEST 5: redraw() alias also returns the promise
      const p2 = this.redraw();
      if (p2 && typeof p2.then === 'function') {
        console.log('✅ TEST 5 PASS: redraw() returns a Promise');
        tests.push(true);
        await p2;
      } else {
        console.log('❌ TEST 5 FAIL: redraw() did not return a Promise');
        tests.push(false);
      }

      console.log('');
      if (tests.every(t => t)) {
        console.log('✅ ALL TESTS PASSED');
        $('#results').html('<span style="color: green;">✅ All tests passed</span>');
      } else {
        console.log('❌ SOME TESTS FAILED');
        $('#results').html('<span style="color: red;">❌ Some tests failed</span>');
      }
      console.log('========================================');
    }, 300);
  }
}
