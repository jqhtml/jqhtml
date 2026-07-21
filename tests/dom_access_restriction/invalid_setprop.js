class Invalid_SetProp extends Jqhtml_Component {
  async on_load() {
    console.log('[Test 5] ❌ Attempting to set this.custom_prop...');
    try {
      this.custom_prop = 'value'; // Should throw error
      console.log('[Test 5] ❌ FAIL: Should have thrown but did not!');
      this.data = { pass: false };
    } catch (error) {
      console.log('[Test 5] ✅ PASS: Correctly threw error:', error.message);
      this.data = { pass: true, error: error.message };
    }
  }

  on_ready() {
    if (this.data.pass) {
      this.$sid('status').text('✅ PASS - Error thrown correctly');
      this.$sid('status').css('color', 'green');
    } else {
      this.$sid('status').text('❌ FAIL - No error thrown');
      this.$sid('status').css('color', 'red');
    }
  }
}
