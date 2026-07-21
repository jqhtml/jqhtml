class Render_Reload_Test extends Jqhtml_Component {
  on_create() {
    this.on_ready_count = 0;
    this.data.on_load_count = 0;
    this.data.load_count = 0;
    this.data.test_results = [];
  }

  async on_load() {
    this.data.on_load_count++;
    console.log(`on_load called (count: ${this.data.on_load_count})`);
    this.data.load_count = this.data.on_load_count;
  }

  async on_ready() {
    this.on_ready_count++;
    console.log(`on_ready called (count: ${this.on_ready_count})`);
    console.log('');

    if (this.on_ready_count === 1) {
      // TEST 1: Initial state
      console.log('TEST 1: Initial state after first boot');
      console.log(`  on_load_count: ${this.data.on_load_count} (expected: 1)`);
      console.log(`  on_ready_count: ${this.on_ready_count} (expected: 1)`);

      if (this.data.on_load_count === 1 && this.on_ready_count === 1) {
        console.log('✅ PASS: Initial lifecycle completed correctly');
        this.data.test_results.push({test: 'Initial lifecycle', status: 'PASS'});
      } else {
        console.log('❌ FAIL: Initial lifecycle incorrect');
        this.data.test_results.push({test: 'Initial lifecycle', status: 'FAIL'});
      }
      console.log('');

      // Call render() - should NOT call on_load()
      console.log('Calling render()...');
      await this.render();

    } else if (this.on_ready_count === 2) {
      // TEST 2: After render()
      console.log('TEST 2: After render() completed');
      console.log(`  on_load_count: ${this.data.on_load_count} (expected: 1, NOT incremented)`);
      console.log(`  on_ready_count: ${this.on_ready_count} (expected: 2)`);

      if (this.data.on_load_count === 1 && this.on_ready_count === 2) {
        console.log('✅ PASS: render() did NOT call on_load()');
        this.data.test_results.push({test: 'render() skips on_load()', status: 'PASS'});
      } else {
        console.log('❌ FAIL: render() incorrectly called on_load()');
        this.data.test_results.push({test: 'render() skips on_load()', status: 'FAIL'});
      }
      console.log('');

      // Call reload() - SHOULD call on_load()
      console.log('Calling reload()...');
      await this.reload();

    } else if (this.on_ready_count === 3) {
      // TEST 3: After reload()
      // Note: reload() restores this.data to on_create() state, so counter resets to 0, then increments to 1
      console.log('TEST 3: After reload() completed');
      console.log(`  on_load_count: ${this.data.on_load_count} (expected: 1, restored then incremented)`);
      console.log(`  on_ready_count: ${this.on_ready_count} (expected: 3)`);

      // Check that on_load was called (counter would be 0 if not called after restore)
      if (this.data.on_load_count === 1 && this.on_ready_count === 3) {
        console.log('✅ PASS: reload() DID call on_load() (data restored, then incremented)');
        this.data.test_results.push({test: 'reload() calls on_load()', status: 'PASS'});
      } else {
        console.log('❌ FAIL: reload() did not call on_load()');
        this.data.test_results.push({test: 'reload() calls on_load()', status: 'FAIL', details: `on_load_count=${this.data.on_load_count}`});
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
      });

      console.log('');

      if (all_passed) {
        console.log('✅ ALL RENDER/RELOAD TESTS PASSED');
        console.log('   - render() does NOT call on_load()');
        console.log('   - reload() DOES call on_load()');
        console.log('   - Both call on_ready()');
        this.$sid('results').html('<h3 style="color: green;">✅ All tests passed</h3>');
      } else {
        console.log('❌ SOME RENDER/RELOAD TESTS FAILED');
        this.$sid('results').html('<h3 style="color: red;">❌ Some tests failed</h3>');
      }

      console.log('');
      console.log('========================================');
      console.log('');
    }
  }
}
