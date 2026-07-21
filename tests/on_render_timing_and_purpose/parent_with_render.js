class Parent_With_Render extends Jqhtml_Component {
  on_create() {
    this.data.lifecycle_log = [];
  }

  on_render() {
    const timestamp = Date.now();
    const log_entry = `Parent on_render (${timestamp})`;
    console.log(log_entry);
    this.data.lifecycle_log.push(log_entry);

    // Hide uninitialized UI
    this.$.css('opacity', '0');
    this.$sid('status').text('Rendering...');
  }

  async on_ready() {
    const timestamp = Date.now();
    const log_entry = `Parent on_ready (${timestamp})`;
    console.log(log_entry);
    this.data.lifecycle_log.push(log_entry);

    // Show UI after children ready
    this.$.css('opacity', '1');
    this.$sid('status').text('Ready!');

    // Validate lifecycle order
    console.log('');
    console.log('========================================');
    console.log('LIFECYCLE ORDER VALIDATION:');
    console.log('========================================');
    console.log('');

    this.data.lifecycle_log.forEach((entry, idx) => {
      console.log(`${idx + 1}. ${entry}`);
    });

    console.log('');
    console.log('Expected order:');
    console.log('1. Parent on_render (first)');
    console.log('2. Child on_ready (after parent renders)');
    console.log('3. Parent on_ready (after child ready)');
    console.log('');

    // Check order - note: on_render may be called twice (double-render pattern)
    // Key requirement: on_render fires BEFORE child ready
    const log_types = this.data.lifecycle_log.map(e => e.split('(')[0].trim());

    const first_is_parent_render = log_types[0] === 'Parent on_render';
    const has_child_ready = log_types.includes('Child on_ready');
    const has_parent_ready = log_types.includes('Parent on_ready');

    // Find indices
    const last_parent_render_idx = log_types.lastIndexOf('Parent on_render');
    const child_ready_idx = log_types.indexOf('Child on_ready');
    const parent_ready_idx = log_types.indexOf('Parent on_ready');

    // Validate: Parent on_render comes before Child on_ready, and Parent on_ready comes last
    const render_before_child = last_parent_render_idx < child_ready_idx;
    const parent_ready_last = parent_ready_idx > child_ready_idx;

    const order_correct = first_is_parent_render && has_child_ready && has_parent_ready &&
                         render_before_child && parent_ready_last;

    if (order_correct) {
      console.log('✅ PASS: Lifecycle order correct');
      console.log('   - on_render() fires BEFORE children boot');
      console.log('   - on_render() fires BEFORE on_ready()');
      console.log('   - Parent on_ready() fires AFTER child ready');
      if (log_types.filter(t => t === 'Parent on_render').length > 1) {
        console.log('   - Note: on_render() called twice (double-render pattern)');
      }
      this.$sid('results').html('<h3 style="color: green;">✅ Test passed</h3>');
    } else {
      console.log('❌ FAIL: Lifecycle order incorrect');
      console.log('   Expected: Parent on_render → Child on_ready → Parent on_ready');
      console.log('   Actual:', log_types.join(' → '));
      this.$sid('results').html('<h3 style="color: red;">❌ Test failed</h3>');
    }

    console.log('');
    console.log('========================================');
    console.log('');
  }
}
