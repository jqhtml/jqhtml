class Data_Freeze_Test extends Jqhtml_Component {
  on_create() {
    console.log('');
    console.log('========================================');
    console.log('THIS.DATA FREEZE/UNFREEZE CYCLE TEST:');
    console.log('========================================');
    console.log('');

    // Store test results in this.data (accessible in on_load)
    this.data.test_results = [];

    // TEST 1: this.data writable in on_create()
    console.log('TEST 1: Modifying this.data in on_create()');
    try {
      this.data.initial = 'created';
      this.data.created_at = Date.now();
      console.log('✅ PASS: Successfully set this.data.initial and this.data.created_at');
      this.data.test_results.push({
        test: 'on_create() can modify this.data',
        status: 'PASS',
        details: 'this.data.initial = "created"'
      });
    } catch (e) {
      console.log('❌ FAIL: Could not modify this.data in on_create():', e.message);
      this.data.test_results.push({
        test: 'on_create() can modify this.data',
        status: 'FAIL',
        details: e.message
      });
    }
    console.log('');
  }

  async on_load() {
    // TEST 3: this.data writable in on_load()
    console.log('TEST 3: Modifying this.data in on_load()');
    try {
      this.data.loaded = 'from_api';
      this.data.loaded_at = Date.now();
      console.log('✅ PASS: Successfully set this.data.loaded and this.data.loaded_at');
      this.data.test_results.push({
        test: 'on_load() can modify this.data',
        status: 'PASS',
        details: 'this.data.loaded = "from_api"'
      });
    } catch (e) {
      console.log('❌ FAIL: Could not modify this.data in on_load():', e.message);
      this.data.test_results.push({
        test: 'on_load() can modify this.data',
        status: 'FAIL',
        details: e.message
      });
    }
    console.log('');
  }

  on_render() {
    // TEST 2: this.data frozen after on_create() (tested in on_render which runs after on_create)
    console.log('TEST 2: Attempting to modify this.data in on_render() (after on_create)');
    try {
      this.data.rendered = 'should_fail';
      console.log('❌ FAIL: Was able to modify this.data in on_render()');
      this.data.test_results.push({
        test: 'this.data frozen after on_create()',
        status: 'FAIL',
        details: 'Modification succeeded when it should have failed'
      });
    } catch (e) {
      console.log('✅ PASS: Cannot modify this.data in on_render():', e.message);
      this.data.test_results.push({
        test: 'this.data frozen after on_create()',
        status: 'PASS',
        details: e.message
      });
    }
    console.log('');
  }

  on_ready() {
    // TEST 4: this.data frozen after on_load()
    console.log('TEST 4: Attempting to modify this.data in on_ready() (after on_load)');
    try {
      this.data.ready = 'should_fail';
      console.log('❌ FAIL: Was able to modify this.data in on_ready()');
      this.data.test_results.push({
        test: 'this.data frozen after on_load()',
        status: 'FAIL',
        details: 'Modification succeeded when it should have failed'
      });
    } catch (e) {
      console.log('✅ PASS: Cannot modify this.data in on_ready():', e.message);
      this.data.test_results.push({
        test: 'this.data frozen after on_load()',
        status: 'PASS',
        details: e.message
      });
    }
    console.log('');

    // TEST 5: Verify data persists correctly
    console.log('TEST 5: Verifying data persistence');
    const has_initial = this.data.initial === 'created';
    const has_loaded = this.data.loaded === 'from_api';
    const has_rendered = this.data.rendered !== undefined;
    const has_ready = this.data.ready !== undefined;

    console.log('  this.data.initial:', this.data.initial, has_initial ? '✅' : '❌');
    console.log('  this.data.loaded:', this.data.loaded, has_loaded ? '✅' : '❌');
    console.log('  this.data.rendered:', this.data.rendered, has_rendered ? '(present)' : '(absent)');
    console.log('  this.data.ready:', this.data.ready, has_ready ? '(present)' : '(absent)');

    // Data persistence test: initial and loaded should be present
    if (has_initial && has_loaded) {
      console.log('✅ PASS: Data persists correctly (initial and loaded present)');
      this.data.test_results.push({
        test: 'Data persists correctly',
        status: 'PASS',
        details: 'initial and loaded values present'
      });
    } else {
      console.log('❌ FAIL: Data state incorrect');
      this.data.test_results.push({
        test: 'Data persists correctly',
        status: 'FAIL',
        details: `initial:${has_initial}, loaded:${has_loaded}`
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
      console.log(`   ${result.details}`);
    });

    console.log('');

    if (all_passed) {
      console.log('✅ ALL FREEZE/UNFREEZE TESTS PASSED');
      console.log('   - this.data writable in on_create()');
      console.log('   - this.data frozen after on_create()');
      console.log('   - this.data writable in on_load()');
      console.log('   - this.data frozen after on_load()');
      console.log('   - Data persists correctly');
      this.$sid('results').html('<h3 style="color: green;">✅ All tests passed</h3>');
    } else {
      console.log('❌ SOME FREEZE/UNFREEZE TESTS FAILED');
      this.$sid('results').html('<h3 style="color: red;">❌ Some tests failed</h3>');
    }

    console.log('');
    console.log('========================================');
    console.log('');
  }
}
