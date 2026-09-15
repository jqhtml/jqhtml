class Test_Page extends Jqhtml_Component {
  on_ready() {
    if (this.state.test_ran) return;
    this.state.test_ran = true;

    let passed = 0;
    let failed = 0;
    const assert = (name, condition) => {
      if (condition) { console.log('   PASS: ' + name); passed++; }
      else { console.log('   FAIL: ' + name); failed++; }
    };

    // Bottom-up ready: Parent_Component's on_ready() - which waits 500ms, rewrites the
    // child's args and awaits child.reload() - has already finished by the time this runs.
    const loads = window.__pmca_loads || [];
    const parent = this.$.find('.Parent_Component').component();
    const child = parent && parent.sid('child');

    console.log('');
    console.log('1. THE CHILD LOADED TWICE, WITH BOTH FILTERS IN ORDER:');
    assert('on_load() ran exactly twice', loads.length === 2);
    assert('first load used filter="initial"', loads[0] === 'initial');
    assert('second load used filter="modified_by_parent"', loads[1] === 'modified_by_parent');

    console.log('');
    console.log("2. THE PARENT'S WRITE TO child.args IS WHAT THE RELOAD PICKED UP:");
    assert('child.args.filter is the modified value', child && child.args.filter === 'modified_by_parent');
    assert('this.data records the filter the load ran with', child && child.data.filter === 'modified_by_parent');

    console.log('');
    console.log('3. THE RE-RENDER FOLLOWED THE NEW ARGS:');
    assert('DOM shows the modified filter', child && child.$.text().includes('modified_by_parent'));
    assert('DOM no longer shows "Filter: initial"', child && !/Filter:\s*initial/.test(child.$.text()));
    assert('the parent reported completion', parent && parent.$sid('status').text() === 'Reload complete!');

    console.log('');
    console.log('========================================');
    console.log('SUMMARY: ' + passed + ' passed, ' + failed + ' failed');
    console.log('========================================');
    console.log('');

    window.testPassed = (failed === 0);
    window.testReady = true;
  }
}
