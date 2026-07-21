class Stop_Event_Test_Main extends Jqhtml_Component {
  on_ready() {
    setTimeout(() => {
      console.log('');
      console.log('========================================');
      console.log('TESTING stop EVENT WITHOUT on_stop():');
      console.log('========================================');
      const tests = [];

      const child = this.sid('child');
      if (!child) {
        console.log('❌ SETUP FAIL: could not get child component instance');
        console.log('❌ SOME TESTS FAILED');
        return;
      }

      let fired = false;
      let received = null;
      child.on('stop', (c) => {
        fired = true;
        received = c;
      });

      child.stop();

      // TEST 1: .on('stop') listener fired even though child has no on_stop()
      if (fired) {
        console.log('✅ TEST 1 PASS: stop event fired for component without on_stop()');
        tests.push(true);
      } else {
        console.log('❌ TEST 1 FAIL: stop event did NOT fire (dead \'destroy\' fast-path check)');
        tests.push(false);
      }

      // TEST 2: _Component_Stopped class applied
      if (child.$.hasClass('_Component_Stopped')) {
        console.log('✅ TEST 2 PASS: _Component_Stopped class applied');
        tests.push(true);
      } else {
        console.log('❌ TEST 2 FAIL: _Component_Stopped class missing');
        tests.push(false);
      }

      // TEST 3: callback received the component instance
      if (received === child) {
        console.log('✅ TEST 3 PASS: stop callback received component instance');
        tests.push(true);
      } else {
        console.log('❌ TEST 3 FAIL: stop callback argument was not the component');
        tests.push(false);
      }

      // TEST 4: DOM left intact after stop()
      if ($('.Stop_Event_Child').length > 0) {
        console.log('✅ TEST 4 PASS: DOM left intact after stop()');
        tests.push(true);
      } else {
        console.log('❌ TEST 4 FAIL: stop() removed the DOM');
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
