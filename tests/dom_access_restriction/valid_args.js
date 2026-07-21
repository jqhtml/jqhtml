class Valid_Args extends Jqhtml_Component {
  async on_load() {
    console.log('[Test 6] ✅ Accessing this.args in on_load()');
    console.log('[Test 6] this.args.user_id =', this.args.user_id);
    this.data = { user_id: this.args.user_id, pass: this.args.user_id === 42 };
  }

  on_ready() {
    if (this.data.pass) {
      this.$sid('status').text(`✅ PASS - user_id = ${this.data.user_id}`);
      this.$sid('status').css('color', 'green');
    } else {
      this.$sid('status').text('❌ FAIL - Could not access this.args');
      this.$sid('status').css('color', 'red');
    }
  }
}
