class Manual_On_Ready_Call extends Jqhtml_Component {
  on_create() {
    this.state.ready_count = 0;
    this.state.test_complete = false;
  }

  on_ready() {
    this.state.ready_count++;
    console.log('[Test 3] on_ready() called, count:', this.state.ready_count);

    // Only run test on first ready (framework call)
    if (this.state.ready_count === 1 && !this.state.test_complete) {
      this.state.test_complete = true;
      console.log('[Test 3] Testing manual on_ready() call...');
      try {
        this.on_ready(); // Should throw error
        console.log('[Test 3] ❌ FAIL: Should have thrown but did not!');
        this.$sid('status').text('❌ FAIL - No error thrown');
        this.$sid('status').css('color', 'red');
      } catch (error) {
        if (error.message.includes('on_ready() cannot be called manually')) {
          console.log('[Test 3] ✅ PASS: Correctly threw error:', error.message);
          this.$sid('status').text('✅ PASS - Error thrown correctly');
          this.$sid('status').css('color', 'green');
        } else {
          console.log('[Test 3] ❌ FAIL: Wrong error message:', error.message);
          this.$sid('status').text('❌ FAIL - Wrong error: ' + error.message);
          this.$sid('status').css('color', 'red');
        }
      }
    }
  }
}
