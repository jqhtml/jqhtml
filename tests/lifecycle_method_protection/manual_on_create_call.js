class Manual_On_Create_Call extends Jqhtml_Component {
  on_create() {
    this.data.created = true;
  }

  on_ready() {
    console.log('[Test 1] Testing manual on_create() call...');
    try {
      this.on_create(); // Should throw error
      console.log('[Test 1] ❌ FAIL: Should have thrown but did not!');
      this.$sid('status').text('❌ FAIL - No error thrown');
      this.$sid('status').css('color', 'red');
    } catch (error) {
      if (error.message.includes('on_create() cannot be called manually')) {
        console.log('[Test 1] ✅ PASS: Correctly threw error:', error.message);
        this.$sid('status').text('✅ PASS - Error thrown correctly');
        this.$sid('status').css('color', 'green');
      } else {
        console.log('[Test 1] ❌ FAIL: Wrong error message:', error.message);
        this.$sid('status').text('❌ FAIL - Wrong error: ' + error.message);
        this.$sid('status').css('color', 'red');
      }
    }
  }
}
