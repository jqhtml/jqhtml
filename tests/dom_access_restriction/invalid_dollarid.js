class Invalid_DollarId extends Jqhtml_Component {
  async on_load() {
    console.log('[Test 3] ❌ Attempting to access this.$sid()...');
    try {
      this.$sid('btn'); // Should throw error
      console.log('[Test 3] ❌ FAIL: Should have thrown but did not!');
      this.data = { pass: false };
    } catch (error) {
      console.log('[Test 3] ✅ PASS: Correctly threw error:', error.message);
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
