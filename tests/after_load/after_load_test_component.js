class After_Load_Test_Component extends Jqhtml_Component {
  on_create() {
    this.data.value = 'initial';
    this.data.items = [1, 2, 3];
    this.state.after_load_calls = 0;
    this.state.after_load_data_snapshot = null;
    this.state.after_load_had_dom_access = false;
    this.state.after_load_data_was_frozen = false;
    this.state.after_load_event_count = 0;
  }

  async on_load() {
    this.data.value = 'loaded_data';
    this.data.items = [1, 2, 3];
  }

  on_loaded() {
    this.state.after_load_calls++;
    this.state.after_load_data_snapshot = JSON.parse(JSON.stringify(this.data));
    this.state.after_load_had_dom_access = (this.$ && this.$.length > 0);
    try {
      this.data.value = 'should_fail';
      this.state.after_load_data_was_frozen = false;
    } catch (e) {
      this.state.after_load_data_was_frozen = true;
    }
    // Primary use case: clone data to state
    this.state.cloned_items = [...this.data.items];
  }

  async on_ready() {
    // Only run test suite on FIRST on_ready
    if (this.state.test_ran) return;
    this.state.test_ran = true;

    // Listen for loaded event for reload test
    this.on('loaded', () => {
      this.state.after_load_event_count++;
    });

    console.log('[After_Load_Test_Component] on_ready() called');

    let passed = 0;
    let failed = 0;

    // Test 1: on_loaded() was called during boot
    console.log('');
    console.log('1. ON_LOADED CALLED DURING BOOT:');
    if (this.state.after_load_calls === 1) {
      console.log('   PASS: on_loaded() called exactly once during boot');
      passed++;
    } else {
      console.log('   FAIL: Expected 1 call, got:', this.state.after_load_calls);
      failed++;
    }

    // Test 2: on_loaded() received correct data
    console.log('');
    console.log('2. ON_LOADED SAW LOADED DATA:');
    if (this.state.after_load_data_snapshot && this.state.after_load_data_snapshot.value === 'loaded_data') {
      console.log('   PASS: on_loaded() saw this.data from on_load()');
      passed++;
    } else {
      console.log('   FAIL: on_loaded() did not see correct data:', this.state.after_load_data_snapshot);
      failed++;
    }

    // Test 3: on_loaded() had DOM access
    console.log('');
    console.log('3. ON_LOADED HAD DOM ACCESS:');
    if (this.state.after_load_had_dom_access) {
      console.log('   PASS: on_loaded() could access this.$');
      passed++;
    } else {
      console.log('   FAIL: on_loaded() could not access this.$');
      failed++;
    }

    // Test 4: this.data was frozen in on_loaded()
    console.log('');
    console.log('4. DATA FROZEN IN ON_LOADED:');
    if (this.state.after_load_data_was_frozen) {
      console.log('   PASS: this.data was frozen (read-only) in on_loaded()');
      passed++;
    } else {
      console.log('   FAIL: this.data was NOT frozen in on_loaded()');
      failed++;
    }

    // Test 5: Primary use case - clone data to state
    console.log('');
    console.log('5. CLONE DATA TO STATE (PRIMARY USE CASE):');
    if (this.state.cloned_items && JSON.stringify(this.state.cloned_items) === JSON.stringify([1, 2, 3])) {
      console.log('   PASS: this.data.items cloned to this.state.cloned_items');
      passed++;
    } else {
      console.log('   FAIL: Clone failed, got:', this.state.cloned_items);
      failed++;
    }

    // Test 6: on_loaded() fires again on reload()
    console.log('');
    console.log('6. ON_LOADED FIRES ON RELOAD:');
    const calls_before = this.state.after_load_calls;
    await this.reload();
    if (this.state.after_load_calls === calls_before + 1) {
      console.log('   PASS: on_loaded() called again after reload()');
      passed++;
    } else {
      console.log('   FAIL: Expected', calls_before + 1, 'calls, got:', this.state.after_load_calls);
      failed++;
    }

    // Test 7: loaded event was triggered
    console.log('');
    console.log('7. ON_LOADED EVENT TRIGGERED:');
    if (this.state.after_load_event_count >= 1) {
      console.log('   PASS: loaded event fired via this.trigger()');
      passed++;
    } else {
      console.log('   FAIL: loaded event did not fire');
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
