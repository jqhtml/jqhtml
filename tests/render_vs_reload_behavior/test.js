class Test_Render_Vs_Reload extends Jqhtml_Component {
  async on_ready() {
    if (this.state.test_ran) return;
    this.state.test_ran = true;

    let passed = 0;
    let failed = 0;
    const assert = (name, condition) => {
      if (condition) { console.log('   PASS: ' + name); passed++; }
      else { console.log('   FAIL: ' + name); failed++; }
    };

    // The sequence is driven from HERE, not recursively from the component's own
    // on_ready(). reload() called from inside on_ready() does not re-enter on_ready(),
    // so the third stage of the old recursive version was unreachable and never ran.
    const c = this.$.find('.Render_Reload_Test').component();
    const rr = window.__rr;

    console.log('');
    console.log('TEST 1: INITIAL BOOT');
    assert('on_load() ran once', rr.load === 1);
    assert('on_ready() ran once', rr.ready === 1);
    assert('this.data.on_load_count is 1', c.data.on_load_count === 1);

    console.log('');
    console.log('TEST 2: render() RE-RENDERS WITHOUT LOADING');
    const render_before = rr.render;
    await c.render();
    assert('on_load() did NOT run again', rr.load === 1);
    assert('on_ready() ran again', rr.ready === 2);
    assert('on_render() ran again', rr.render > render_before);
    assert('this.data was untouched', c.data.on_load_count === 1);

    console.log('');
    console.log('TEST 3: reload() LOADS AND RE-RENDERS');
    await c.reload();
    assert('on_load() ran again', rr.load === 2);
    assert('on_ready() ran again', rr.ready === 3);
    assert('this.data was restored to the on_create() snapshot before on_load()',
      c.data.on_load_count === 1);
    assert('the DOM reflects the reload', c.$.text().includes('on_load count: 2'));

    console.log('');
    console.log('========================================');
    console.log('SUMMARY: ' + passed + ' passed, ' + failed + ' failed');
    console.log('========================================');
    console.log('');

    window.testPassed = (failed === 0);
    window.testReady = true;
  }
}
