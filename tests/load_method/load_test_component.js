class Load_Test_Component extends Jqhtml_Component {
  on_create() {
    this.data.value = 'initial';
    this.data.render_count = 0;
    this.args.call_count = this.args.call_count || 1;
  }

  async on_load() {
    // Use this.args.call_count (readable in on_load) to produce different data each time
    const count = this.args.call_count;
    this.data.value = 'loaded_' + count;
    this.data.render_count = count;
  }

  async on_ready() {
    // Guard against re-entry from render() call at end of test
    if (this.state.test_ran) return;
    this.state.test_ran = true;

    console.log('[Load_Test_Component] on_ready() called');
    console.log('  this.data.value:', this.data.value);

    let passed = 0;
    let failed = 0;

    // Test 1: Initial load worked (args.call_count=1 from on_create default)
    const initial_value = this.$sid('value').text().trim();
    console.log('');
    console.log('1. INITIAL LOAD:');
    console.log('   DOM value text:', initial_value);
    if (initial_value.includes('loaded_1')) {
      console.log('   PASS: Initial on_load() worked');
      passed++;
    } else {
      console.log('   FAIL: Expected "loaded_1" in DOM, got:', initial_value);
      failed++;
    }

    // Capture DOM state before load()
    const dom_before_load = this.$sid('value').text().trim();

    // Test 2: Update args.call_count, call load() - data should change
    console.log('');
    console.log('2. CALLING load() with updated args:');
    this.args.call_count = 2;
    const changed = await this.load();
    console.log('   load() returned:', changed);
    console.log('   this.data.value after load():', this.data.value);
    console.log('   this.data.render_count after load():', this.data.render_count);

    // Check data was updated
    if (this.data.value === 'loaded_2' && this.data.render_count === 2) {
      console.log('   PASS: this.data was updated by load()');
      passed++;
    } else {
      console.log('   FAIL: this.data not updated correctly');
      failed++;
    }

    // Test 3: load() returned true (data changed)
    console.log('');
    console.log('3. RETURN VALUE (data changed):');
    if (changed === true) {
      console.log('   PASS: load() returned true (data changed)');
      passed++;
    } else {
      console.log('   FAIL: load() should have returned true, got:', changed);
      failed++;
    }

    // Test 4: DOM should NOT have been re-rendered
    const dom_after_load = this.$sid('value').text().trim();
    console.log('');
    console.log('4. DOM NOT RE-RENDERED:');
    console.log('   DOM before load():', dom_before_load);
    console.log('   DOM after load():', dom_after_load);
    if (dom_before_load === dom_after_load) {
      console.log('   PASS: DOM unchanged after load() (no re-render)');
      passed++;
    } else {
      console.log('   FAIL: DOM changed after load() (unexpected re-render)');
      failed++;
    }

    // Test 5: this.data is frozen after load()
    console.log('');
    console.log('5. DATA FROZEN AFTER load():');
    let freeze_error = false;
    try {
      this.data.value = 'should_fail';
    } catch (e) {
      freeze_error = true;
    }
    if (freeze_error) {
      console.log('   PASS: this.data is frozen after load()');
      passed++;
    } else {
      console.log('   FAIL: this.data should be frozen after load()');
      failed++;
    }

    // Test 6: Call load() again WITHOUT changing args - should return false (same data)
    console.log('');
    console.log('6. SECOND load() CALL (same args, no change):');
    const changed2 = await this.load();
    console.log('   Second load() returned:', changed2);
    if (changed2 === false) {
      console.log('   PASS: load() returned false when data unchanged');
      passed++;
    } else {
      console.log('   FAIL: Expected false (data unchanged), got:', changed2);
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
