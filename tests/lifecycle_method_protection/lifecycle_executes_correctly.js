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
    // on_load() may only touch this.args and this.data (this.state is blocked here), so
    // the step is recorded from on_loaded(), which runs right after it.
    console.log('[Test 6] on_load() called by framework');
    this.data.loaded_value = 42;
  }

  on_loaded() {
    console.log('[Test 6] on_loaded() called by framework');
    this.state.lifecycle_steps.push('loaded');
  }

  on_ready() {
    console.log('[Test 6] on_ready() called by framework');
    this.state.lifecycle_steps.push('ready');

    // Verify all lifecycle methods were called in correct order
    const expected = ['create', 'render', 'loaded', 'render', 'ready'];
    const actual = this.state.lifecycle_steps;

    console.log('[Test 6] Expected lifecycle:', expected.join(' -> '));
    console.log('[Test 6] Actual lifecycle:', actual.join(' -> '));

    // Exact order: on_load() changed this.data, so there is exactly one re-render
    const order_correct = JSON.stringify(actual) === JSON.stringify(expected);
    const has_create = actual.includes('create');
    const has_render = actual.includes('render');
    const has_load = actual.includes('loaded');
    const has_ready = actual.includes('ready');
    const data_correct = this.data.loaded_value === 42;

    const pass = order_correct && data_correct;

    if (pass) {
      console.log('[Test 6] ✅ PASS: All lifecycle methods executed correctly');
      this.$sid('status').text('✅ PASS - All lifecycle methods executed');
      this.$sid('status').css('color', 'green');
      this.$sid('data_value').text(this.data.loaded_value);
    } else {
      console.log('[Test 6] ❌ FAIL: Wrong lifecycle order or incorrect data');
      this.$sid('status').text('❌ FAIL - Order: ' + actual.join(',') + ' - Missing: ' +
        (!has_create ? 'create ' : '') +
        (!has_render ? 'render ' : '') +
        (!has_load ? 'load ' : '') +
        (!has_ready ? 'ready ' : '') +
        (!data_correct ? 'data' : ''));
      this.$sid('status').css('color', 'red');
    }
  }
}
