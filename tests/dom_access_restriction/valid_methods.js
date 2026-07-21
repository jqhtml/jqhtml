class Valid_Methods extends Jqhtml_Component {
  async on_load() {
    console.log('[Test 7] ✅ Calling this.component_name() in on_load()');
    const name = this.component_name();
    console.log('[Test 7] Component name:', name);
    this.data = { name, pass: name === 'Valid_Methods' };
  }

  on_ready() {
    if (this.data.pass) {
      this.$sid('status').text(`✅ PASS - name = ${this.data.name}`);
      this.$sid('status').css('color', 'green');
    } else {
      this.$sid('status').text('❌ FAIL - Could not call component_name()');
      this.$sid('status').css('color', 'red');
    }
  }
}
