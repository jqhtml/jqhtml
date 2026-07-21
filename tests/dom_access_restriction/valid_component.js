class Valid_Component extends Jqhtml_Component {
  async on_load() {
    console.log('[Test 1] ✅ Valid component - only modifying this.data');
    this.data = { message: 'Success!' };
  }

  on_ready() {
    this.$sid('status').text('✅ PASS - Component loaded successfully');
    this.$sid('status').css('color', 'green');
  }
}
