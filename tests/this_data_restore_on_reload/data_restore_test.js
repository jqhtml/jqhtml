class Data_Restore_Test extends Jqhtml_Component {
  on_create() {
    console.log('');
    console.log('========================================');
    console.log('THIS.DATA RESTORE ON RELOAD TEST:');
    console.log('========================================');
    console.log('');

    // Set initial defaults
    this.data.initial_value = 'from_create';
    this.data.counter = 0;
    this.data.test_results = [];

    console.log('on_create() - Initial this.data:', JSON.stringify(this.data, null, 2));
    console.log('');
  }

  async on_load() {
    console.log('on_load() START - this.data:', JSON.stringify(this.data, null, 2));

    // Increment counter (should reset to 0 on each reload due to restore)
    this.data.counter++;
    this.data.loaded_value = `load_${this.data.counter}`;

    console.log('on_load() END - this.data:', JSON.stringify(this.data, null, 2));
    console.log('');
  }

  async on_ready() {
    console.log('on_ready() - this.data:', JSON.stringify(this.data, null, 2));
    console.log('');

    // TEST 1: First on_load() should have counter = 1
    if (this.data.counter === 1 && this.data.loaded_value === 'load_1') {
      console.log('✅ TEST 1 PASS: First on_load() counter = 1');
      this.data.test_results.push({
        test: 'First on_load() counter = 1',
        status: 'PASS'
      });
    } else {
      console.log('❌ TEST 1 FAIL: First on_load() counter =', this.data.counter, 'loaded_value =', this.data.loaded_value);
      this.data.test_results.push({
        test: 'First on_load() counter = 1',
        status: 'FAIL',
        details: `counter=${this.data.counter}, loaded_value=${this.data.loaded_value}`
      });
    }
    console.log('');

    // Only run reload test on first ready
    if (this.data.test_results.length === 1) {
      console.log('Calling reload()...');
      console.log('');

      await this.reload();

      console.log('After reload() - this.data:', JSON.stringify(this.data, null, 2));
      console.log('');

      // TEST 2: After reload(), counter should still be 1 (not 2)
      // Because this.data was restored to on_create() state before second on_load()
      if (this.data.counter === 1 && this.data.loaded_value === 'load_1') {
        console.log('✅ TEST 2 PASS: After reload() counter still = 1 (data was restored)');
        this.data.test_results.push({
          test: 'After reload() counter = 1 (restored)',
          status: 'PASS'
        });
      } else {
        console.log('❌ TEST 2 FAIL: After reload() counter =', this.data.counter, '(expected 1, data NOT restored)');
        this.data.test_results.push({
          test: 'After reload() counter = 1 (restored)',
          status: 'FAIL',
          details: `counter=${this.data.counter} (expected 1), loaded_value=${this.data.loaded_value}`
        });
      }
      console.log('');

      // TEST 3: initial_value should persist
      if (this.data.initial_value === 'from_create') {
        console.log('✅ TEST 3 PASS: initial_value persists across reload');
        this.data.test_results.push({
          test: 'initial_value persists',
          status: 'PASS'
        });
      } else {
        console.log('❌ TEST 3 FAIL: initial_value =', this.data.initial_value, '(expected "from_create")');
        this.data.test_results.push({
          test: 'initial_value persists',
          status: 'FAIL',
          details: `initial_value=${this.data.initial_value}`
        });
      }
      console.log('');

      // Final summary
      console.log('========================================');
      console.log('FINAL RESULT:');
      console.log('========================================');

      const all_passed = this.data.test_results.every(r => r.status === 'PASS');

      this.data.test_results.forEach(result => {
        const icon = result.status === 'PASS' ? '✅' : '❌';
        console.log(`${icon} ${result.test}`);
        if (result.details) {
          console.log(`   ${result.details}`);
        }
      });

      console.log('');

      if (all_passed) {
        console.log('✅ ALL RESTORE TESTS PASSED');
        console.log('   - First on_load() starts with on_create() defaults');
        console.log('   - reload() restores this.data before re-running on_load()');
        console.log('   - Counter resets to 0, then increments to 1 again');
        console.log('   - initial_value persists correctly');
        this.$sid('results').html('<h3 style="color: green;">✅ All tests passed</h3>');
      } else {
        console.log('❌ SOME RESTORE TESTS FAILED');
        console.log('   - this.data may NOT be restoring to on_create() snapshot');
        this.$sid('results').html('<h3 style="color: red;">❌ Some tests failed</h3>');
      }

      console.log('');
      console.log('========================================');
      console.log('');
    }
  }
}
