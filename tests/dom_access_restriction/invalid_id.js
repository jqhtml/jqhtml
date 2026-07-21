class Invalid_Id extends Jqhtml_Component {
  async on_load() {
    console.log('[Test 4] ❌ Attempting to access this.sid()...');
    try {
      this.sid('child'); // Should throw error
      console.log('[Test 4] ❌ FAIL: Should have thrown but did not!');
      this.data = { pass: false };
    } catch (error) {
      console.log('[Test 4] ✅ PASS: Correctly threw error:', error.message);
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
