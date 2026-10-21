/**
 * load_method_runs_on_loaded
 *
 * Pins the documented contract of load() (CLAUDE.md "load() - Re-fetch Data Only"):
 * it runs on_load(), then on_loaded(), then fires 'loaded' - whether or not the data
 * changed - and does NOT re-render, call on_ready() or fire 'ready'.
 */
class Test_Load_Runs_On_Loaded extends Jqhtml_Component {
  async on_ready() {
    if (this.state.test_ran) return;
    this.state.test_ran = true;

    let passed = 0;
    let failed = 0;
    const assert = (name, condition, detail) => {
      if (condition) {
        console.log('   PASS: ' + name);
        passed++;
      } else {
        console.log('   FAIL: ' + name + (detail !== undefined ? ' - got ' + JSON.stringify(detail) : ''));
        failed++;
      }
    };

    const probe = this.sid('probe');
    const counts = probe.state.counts;
    const boot = { ...counts };

    let loaded_events = 0;
    let ready_events = 0;
    // Both events are sticky: subscribing now fires once for boot, so count from here
    probe.on('loaded', () => { loaded_events++; });
    probe.on('ready', () => { ready_events++; });
    const loaded_base = loaded_events;
    const ready_base = ready_events;

    console.log('');
    console.log('1. load() WITH CHANGED DATA:');
    probe.args.version = 2;
    const changed = await probe.load();
    assert('load() returns true', changed === true, changed);
    assert('on_loaded() ran once', counts.on_loaded === boot.on_loaded + 1, counts.on_loaded - boot.on_loaded);
    assert("'loaded' fired once", loaded_events === loaded_base + 1, loaded_events - loaded_base);
    assert('this.data updated', probe.data.value === 'v2', probe.data.value);

    console.log('');
    console.log('2. load() WITH UNCHANGED DATA:');
    const unchanged = await probe.load();
    assert('load() returns false', unchanged === false, unchanged);
    assert('on_loaded() ran again', counts.on_loaded === boot.on_loaded + 2, counts.on_loaded - boot.on_loaded);
    assert("'loaded' fired again", loaded_events === loaded_base + 2, loaded_events - loaded_base);

    console.log('');
    console.log('3. NO RE-RENDER, NO READY:');
    assert('on_render() not called', counts.on_render === boot.on_render, counts.on_render - boot.on_render);
    assert('on_ready() not called', counts.on_ready === boot.on_ready, counts.on_ready - boot.on_ready);
    assert("'ready' not fired", ready_events === ready_base, ready_events - ready_base);
    assert('DOM still shows the boot data', probe.$sid('value').text().trim() === 'v1', probe.$sid('value').text().trim());

    console.log('');
    console.log('SUMMARY: ' + passed + ' passed, ' + failed + ' failed');
    window.testPassed = (failed === 0);
  }
}
