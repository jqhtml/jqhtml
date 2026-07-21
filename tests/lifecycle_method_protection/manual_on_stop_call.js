class Manual_On_Stop_Call extends Jqhtml_Component {
  on_stop() {
    // Framework calls this when component stops
    console.log('[Test 5] on_stop() called');
  }

  on_ready() {
    console.log('[Test 5] Testing manual on_stop() call...');
    try {
      this.on_stop(); // Should throw error
      console.log('[Test 5] ❌ FAIL: Should have thrown but did not!');
      this.$sid('status').text('❌ FAIL - No error thrown');
      this.$sid('status').css('color', 'red');
    } catch (error) {
      if (error.message.includes('on_stop() cannot be called manually')) {
        console.log('[Test 5] ✅ PASS: Correctly threw error:', error.message);
        this.$sid('status').text('✅ PASS - Error thrown correctly');
        this.$sid('status').css('color', 'green');
      } else {
        console.log('[Test 5] ❌ FAIL: Wrong error message:', error.message);
        this.$sid('status').text('❌ FAIL - Wrong error: ' + error.message);
        this.$sid('status').css('color', 'red');
      }
    }
  }
}
