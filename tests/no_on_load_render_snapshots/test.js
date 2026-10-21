// A component with no custom on_load() no longer records the args/data snapshots
// _render() used to take on every render: their only reader is _reload(), which
// never reaches them for such a component. This test pins the behaviour that must
// NOT change with that: every render()/reload()/refresh() path, the ready event,
// args changes picked up on render(), and load() being a no-op.

class No_On_Load_Render_Snapshots extends Jqhtml_Component {
  async on_ready() {
    if (this.state.test_ran) return;
    this.state.test_ran = true;

    let passed = 0, failed = 0;
    const assert = (name, ok) => { console.log('   ' + (ok ? 'PASS' : 'FAIL') + ': ' + name); ok ? passed++ : failed++; };
    const stage = this.$sid('stage');
    const counts = (c) => c.state.renders + '/' + c.state.readies + '/' + c.state.ready_events;

    try {
      console.log('');
      console.log('A. BOOT');
      const c = $('<div>').appendTo(stage).component('Plain_Counter', { label: 'one' }).component();
      await c.ready();
      assert('rendered once, on_ready once, ready event once -> ' + counts(c), counts(c) === '1/1/1');
      assert('label rendered -> ' + c.$.find('.label').text(), c.$.find('.label').text() === 'one');
      assert('on_create() data rendered -> ' + c.$.find('.value').text(), c.$.find('.value').text() === 'from-create');

      console.log('');
      console.log('B. render() PICKS UP AN ARGS CHANGE');
      c.args.label = 'two';
      await c.render();
      assert('re-rendered with full lifecycle -> ' + counts(c), counts(c) === '2/2/2');
      assert('new label rendered -> ' + c.$.find('.label').text(), c.$.find('.label').text() === 'two');

      console.log('');
      console.log('C. reload() RE-RENDERS AND RUNS on_ready() (no data to fetch)');
      c.args.label = 'three';
      await c.reload();
      assert('re-rendered, on_ready and ready event again -> ' + counts(c), counts(c) === '3/3/3');
      assert('args change picked up by reload() -> ' + c.$.find('.label').text(), c.$.find('.label').text() === 'three');
      await c.ready();
      assert('ready() resolves after reload()', true);

      console.log('');
      console.log('D. refresh() TAKES THE SAME PATH AS reload() FOR IT');
      await c.refresh();
      assert('re-rendered, on_ready and ready event again -> ' + counts(c), counts(c) === '4/4/4');

      console.log('');
      console.log('E. load() IS A NO-OP');
      const changed = await c.load();
      assert('load() returned false -> ' + changed, changed === false);
      assert('this.data untouched -> ' + c.data.value, c.data.value === 'from-create');
      assert('nothing rendered -> ' + counts(c), counts(c) === '4/4/4');

      console.log('');
      console.log('F. A LIST OF CHILD COMPONENTS RE-RENDERS WITH NEW ARGS');
      const list = $('<div>').appendTo(stage).component('Plain_Counter', { label: 'list', rows: [{ name: 'a' }, { name: 'b' }] }).component();
      await list.ready();
      const rows_text = () => list.$.find('.plain-row').map((_, el) => $(el).text()).get().join(',');
      assert('two rows -> ' + rows_text(), rows_text() === 'a,b');
      list.args.rows = [{ name: 'c' }, { name: 'd' }, { name: 'e' }];
      await list.render();
      assert('three new rows after render() -> ' + rows_text(), rows_text() === 'c,d,e');
      const row = list.$.find('.plain-row').first().component();
      assert('rows are live components, ready -> ' + (row && row._ready_state), row && row._ready_state === 4);

      console.log('');
      console.log('G. NO RENDER-TIME SNAPSHOTS ARE RECORDED FOR THESE COMPONENTS');
      for (const [name, comp] of [['counter', c], ['list', list], ['row', row]]) {
        assert(name + ': no args/data snapshots -> ' + JSON.stringify([comp._args_on_last_render, comp._data_on_last_render, comp._data_before_render]),
               comp._args_on_last_render === null && comp._data_on_last_render === null && comp._data_before_render === null);
      }
    } catch (error) {
      console.log('   FAIL: the test itself threw -> ' + error.message);
      console.error(error);
      failed++;
    }

    console.log('');
    console.log('========================================');
    console.log('SUMMARY: ' + passed + ' passed, ' + failed + ' failed');
    console.log('========================================');
    window.testPassed = (failed === 0);
    window.testReady = true;
  }
}
