/**
 * Test 7: component methods are blocked in on_load() too - this.component_name() throws.
 * (The class keeps its old name; CLAUDE.md lists component_name() as blocked in on_load().)
 */
class Valid_Methods extends Jqhtml_Component {
  async on_load() {
    console.log('[Test 7] ❌ Attempting to call this.component_name() in on_load()...');
    try {
      this.component_name(); // Should throw error
      console.log('[Test 7] ❌ FAIL: Should have thrown but did not!');
      this.data = { pass: false };
    } catch (error) {
      console.log('[Test 7] ✅ PASS: Correctly threw error:', error.message);
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
