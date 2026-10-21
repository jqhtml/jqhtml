/**
 * loaded_without_on_load
 *
 * Every component gets on_loaded() and the 'loaded' event, whether or not it
 * implements on_load(): at boot, and in reload()/refresh()/load(), in the same order
 * as a component with on_load() - on_loaded, 'loaded', any re-render, on_ready.
 */
class Test_Loaded_Without_On_Load extends Jqhtml_Component {
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
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    // .component(name, args) returns the element; .component() then returns the instance
    const mount = (name, args) => $('<div>').appendTo(this.$sid('scratch')).component(name, args).component();

    const probe = this.sid('probe');
    const log = probe.state.log;

    console.log('');
    console.log('1. BOOT:');
    assert('boot order: on_render, on_loaded, loaded, on_ready',
      same(log, ['on_render', 'on_loaded', 'loaded', 'on_ready']), log);

    console.log('');
    console.log('2. reload():');
    log.length = 0;
    await probe.reload();
    assert('reload() order: on_loaded, loaded, on_render, on_ready',
      same(log, ['on_loaded', 'loaded', 'on_render', 'on_ready']), log);

    console.log('');
    console.log('3. refresh():');
    log.length = 0;
    await probe.refresh();
    assert('refresh() order: on_loaded, loaded, on_render, on_ready',
      same(log, ['on_loaded', 'loaded', 'on_render', 'on_ready']), log);

    console.log('');
    console.log('4. load():');
    log.length = 0;
    const changed = await probe.load();
    assert('load() returns false', changed === false, changed);
    assert('load() runs on_loaded then loaded, no render, no on_ready',
      same(log, ['on_loaded', 'loaded']), log);
    assert('load() leaves this.data as on_create() set it',
      probe.data.label === 'from on_create', probe.data.label);
    assert('DOM still shows on_create() data',
      probe.$sid('label').text().trim() === 'from on_create', probe.$sid('label').text());

    console.log('');
    console.log('5. TEMPLATE-ONLY COMPONENT (no on_load, no on_loaded):');
    const plain = mount('Nl_Plain', {});
    let plain_loaded_sync = false;
    plain.on('loaded', () => { plain_loaded_sync = true; });
    assert("'loaded' already fired when .component() returns (boot does not yield)",
      plain_loaded_sync === true);
    await plain.ready();
    let plain_loaded_count = 0;
    plain.on('loaded', () => { plain_loaded_count++; });   // sticky: counts 1 now
    await plain.reload();
    assert("reload() fires 'loaded' again", plain_loaded_count === 2, plain_loaded_count);
    await plain.load();
    assert("load() fires 'loaded' again", plain_loaded_count === 3, plain_loaded_count);

    console.log('');
    console.log('6. _load_only / _load_render_only SUPPRESS on_loaded AND loaded:');
    for (const flag of ['_load_only', '_load_render_only']) {
      const c = mount('Nl_Probe', { name: flag, [flag]: true });
      await c.ready();
      const flag_log = window.__nl_logs[flag];
      assert(flag + ': no on_loaded, no loaded at boot',
        !flag_log.includes('on_loaded') && !flag_log.includes('loaded'), flag_log);
      await c.load();
      assert(flag + ': load() runs no on_loaded and fires no loaded',
        !flag_log.includes('on_loaded') && !flag_log.includes('loaded'), flag_log);
    }

    console.log('');
    console.log('7. STOPPED COMPONENTS:');
    mount('Nl_Probe', { name: 'stop_in_render', stop_in_render: true });
    await wait(20);
    const sr_log = window.__nl_logs.stop_in_render;
    assert('stopped in on_render(): no on_loaded, no loaded, no on_ready',
      same(sr_log, ['on_render']), sr_log);

    const slow = mount('Nl_Probe', { name: 'slow', slow_loaded: true });
    await wait(10);
    slow.stop();
    await wait(80);
    const slow_log = window.__nl_logs.slow;
    assert("stopped during on_loaded(): no 'loaded', no on_ready",
      same(slow_log, ['on_render', 'on_loaded', 'on_loaded_end']), slow_log);

    const slow_load_count = slow_log.length;
    const stopped_result = await slow.load();
    assert('load() on a stopped component: false, no hooks',
      stopped_result === false && slow_log.length === slow_load_count, slow_log);

    console.log('');
    console.log('SUMMARY: ' + passed + ' passed, ' + failed + ' failed');
    window.testPassed = (failed === 0);
  }
}
