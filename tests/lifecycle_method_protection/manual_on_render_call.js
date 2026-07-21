class Manual_On_Render_Call extends Jqhtml_Component {
  on_render() {
    // Framework calls this after DOM update
    console.log('[Test 4] on_render() called by framework');
  }

  on_ready() {
    console.log('[Test 4] Testing manual on_render() call...');
    try {
      this.on_render(); // Should throw error
      console.log('[Test 4] ❌ FAIL: Should have thrown but did not!');
      this.$sid('status').text('❌ FAIL - No error thrown');
      this.$sid('status').css('color', 'red');
    } catch (error) {
      if (error.message.includes('on_render() cannot be called manually')) {
        console.log('[Test 4] ✅ PASS: Correctly threw error:', error.message);
        this.$sid('status').text('✅ PASS - Error thrown correctly');
        this.$sid('status').css('color', 'green');
      } else {
        console.log('[Test 4] ❌ FAIL: Wrong error message:', error.message);
        this.$sid('status').text('❌ FAIL - Wrong error: ' + error.message);
        this.$sid('status').css('color', 'red');
      }
    }
  }
}
