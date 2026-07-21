class Parent_Calls_Child_Lifecycle extends Jqhtml_Component {
  on_ready() {
    console.log('[Test 7] Parent ready, attempting to call child\'s on_load()...');
    const child = this.sid('child');

    if (!child) {
      console.log('[Test 7] ❌ FAIL: Could not find child component');
      this.$sid('status').text('❌ FAIL - Child not found');
      this.$sid('status').css('color', 'red');
      return;
    }

    try {
      child.on_load(); // Should throw error
      console.log('[Test 7] ❌ FAIL: Should have thrown but did not!');
      this.$sid('status').text('❌ FAIL - No error thrown');
      this.$sid('status').css('color', 'red');
    } catch (error) {
      if (error.message.includes('on_load() cannot be called manually')) {
        console.log('[Test 7] ✅ PASS: Correctly threw error:', error.message);
        this.$sid('status').text('✅ PASS - Parent blocked from calling child lifecycle');
        this.$sid('status').css('color', 'green');
      } else {
        console.log('[Test 7] ❌ FAIL: Wrong error message:', error.message);
        this.$sid('status').text('❌ FAIL - Wrong error: ' + error.message);
        this.$sid('status').css('color', 'red');
      }
    }
  }
}
