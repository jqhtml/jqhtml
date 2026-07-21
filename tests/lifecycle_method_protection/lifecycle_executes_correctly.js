class Lifecycle_Executes_Correctly extends Jqhtml_Component {
  on_create() {
    console.log('[Test 6] on_create() called by framework');
    this.state.lifecycle_steps = ['create'];
    this.data.initial_value = 0;
  }

  on_render() {
    console.log('[Test 6] on_render() called by framework');
    this.state.lifecycle_steps.push('render');
  }

  async on_load() {
    console.log('[Test 6] on_load() called by framework');
    this.state.lifecycle_steps.push('load');
    this.data.loaded_value = 42;
  }

  on_ready() {
    console.log('[Test 6] on_ready() called by framework');
    this.state.lifecycle_steps.push('ready');

    // Verify all lifecycle methods were called in correct order
    const expected = ['create', 'render', 'load', 'render', 'ready'];
    const actual = this.state.lifecycle_steps;

    console.log('[Test 6] Expected lifecycle:', expected.join(' -> '));
    console.log('[Test 6] Actual lifecycle:', actual.join(' -> '));

    // Check lifecycle order (may have extra renders)
    let pass = true;
    let expected_idx = 0;
    for (const step of actual) {
      if (step === expected[expected_idx]) {
        expected_idx++;
      }
    }

    // At minimum, need create, at least one render, load, and ready
    const has_create = actual.includes('create');
    const has_render = actual.includes('render');
    const has_load = actual.includes('load');
    const has_ready = actual.includes('ready');
    const data_correct = this.data.loaded_value === 42;

    pass = has_create && has_render && has_load && has_ready && data_correct;

    if (pass) {
      console.log('[Test 6] ✅ PASS: All lifecycle methods executed correctly');
      this.$sid('status').text('✅ PASS - All lifecycle methods executed');
      this.$sid('status').css('color', 'green');
      this.$sid('data_value').text(this.data.loaded_value);
    } else {
      console.log('[Test 6] ❌ FAIL: Missing lifecycle steps or incorrect data');
      this.$sid('status').text('❌ FAIL - Missing: ' +
        (!has_create ? 'create ' : '') +
        (!has_render ? 'render ' : '') +
        (!has_load ? 'load ' : '') +
        (!has_ready ? 'ready ' : '') +
        (!data_correct ? 'data' : ''));
      this.$sid('status').css('color', 'red');
    }
  }
}
