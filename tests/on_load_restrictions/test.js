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

    const c = this.$.find('.Test_Component').component();

    console.log('');
    console.log('1. on_load() MAY READ args AND WRITE data:');
    assert('the component loaded', c && c.data.loaded === true);
    assert('this.args was readable inside on_load()', c && c.data.user_id === 123);

    console.log('');
    console.log('2. EVERYTHING ELSE IS BLOCKED INSIDE on_load():');
    assert('this.component_name() threw', c && c.data.blocked.includes('component_name'));
    assert('this.$ threw', c && c.data.blocked.includes('$'));
    assert('this.$sid() threw', c && c.data.blocked.includes('$sid'));
    assert('this.render() threw', c && c.data.blocked.includes('render'));
    assert('nothing was allowed through', c && c.data.leaked.length === 0);
    if (c && c.data.leaked.length) console.log('   leaked:', c.data.leaked.join(', '));

    console.log('');
    console.log('3. THE SAME MEMBERS WORK OUTSIDE on_load():');
    assert('this.component_name() works in on_ready()', c && c.component_name() === 'Test_Component');
    assert('this.$ works in on_ready()', c && c.$.length === 1);

    console.log('');
    console.log('========================================');
    console.log('SUMMARY: ' + passed + ' passed, ' + failed + ' failed');
    console.log('========================================');
    console.log('');

    window.testPassed = (failed === 0);
    window.testReady = true;
  }
}
