class Reload_Test extends Jqhtml_Component {
  async on_ready() {
    if (this.state.test_ran) return;
    this.state.test_ran = true;

    let passed = 0;
    let failed = 0;
    const assert = (name, condition) => {
      if (condition) { console.log('   PASS: ' + name); passed++; }
      else { console.log('   FAIL: ' + name); failed++; }
    };
    const loads = () => window.__reload_test_loads;
    const loads_of = (id) => loads().filter((v) => v === id).length;

    const mount = (selector, args) =>
      $('<div />').component('Data_Component', args).appendTo(selector).component();

    const c1 = mount('#test1-container', { data_id: 100 });
    const c2 = mount('#test2-container', { data_id: 100 });
    const c3 = mount('#test3-container', { data_id: 300 });
    await Promise.all([c1.ready(), c2.ready(), c3.ready()]);

    console.log('');
    console.log('1. BOOT LOADED EACH COMPONENT ONCE:');
    assert('c1 loaded data_id 100', c1.data.data_id === 100);
    assert('c1 rendered its value', c1.$.text().includes('Data for ID 100'));
    assert('c3 loaded data_id 300', c3.data.data_id === 300);

    console.log('');
    console.log('2. reload() WITH UNCHANGED ARGS RE-RUNS on_load():');
    const before = loads_of(100);
    await c1.reload();
    assert('on_load() ran again for data_id 100', loads_of(100) === before + 1);
    assert('data still reflects data_id 100', c1.data.data_id === 100);
    assert('timestamp is a string from the new load', typeof c1.data.timestamp === 'string');

    console.log('');
    console.log('3. reload() AFTER AN ARGS CHANGE LOADS THE NEW ARGS:');
    c2.args.data_id = 200;
    await c2.reload();
    assert('on_load() ran with data_id 200', loads_of(200) >= 1);
    assert('this.data follows the new args', c2.data.data_id === 200);
    assert('DOM follows the new args', c2.$.text().includes('Data for ID 200'));
    assert('the other instance is untouched', c1.data.data_id === 100);

    console.log('');
    console.log('4. reload() TO AN UNCACHED VALUE FETCHES FRESH DATA:');
    c3.args.data_id = 999;
    await c3.reload();
    assert('on_load() ran with data_id 999', loads_of(999) === 1);
    assert('this.data follows the new args', c3.data.data_id === 999);
    assert('DOM follows the new args', c3.$.text().includes('Data for ID 999'));

    console.log('');
    console.log('========================================');
    console.log('SUMMARY: ' + passed + ' passed, ' + failed + ' failed');
    console.log('========================================');
    console.log('');

    window.testPassed = (failed === 0);
    window.testReady = true;
  }
}
