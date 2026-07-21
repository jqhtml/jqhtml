class Manual_On_Load_Call extends Jqhtml_Component {
  async on_load() {
    this.data.loaded = true;
    this.data.value = 42;
  }

  on_ready() {
    console.log('[Test 2] Testing manual on_load() call...');
    try {
      this.on_load(); // Should throw error
      console.log('[Test 2] ❌ FAIL: Should have thrown but did not!');
      this.$sid('status').text('❌ FAIL - No error thrown');
      this.$sid('status').css('color', 'red');
    } catch (error) {
      if (error.message.includes('on_load() cannot be called manually')) {
        console.log('[Test 2] ✅ PASS: Correctly threw error:', error.message);
        this.$sid('status').text('✅ PASS - Error thrown correctly');
        this.$sid('status').css('color', 'green');
      } else {
        console.log('[Test 2] ❌ FAIL: Wrong error message:', error.message);
        this.$sid('status').text('❌ FAIL - Wrong error: ' + error.message);
        this.$sid('status').css('color', 'red');
      }
    }
  }
}
