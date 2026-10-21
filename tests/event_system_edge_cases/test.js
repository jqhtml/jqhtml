class Event_System_Edge_Cases extends Jqhtml_Component {
  async on_ready() {
    if (this.state.test_ran) return;
    this.state.test_ran = true;

    let passed = 0, failed = 0;
    const assert = (name, ok) => { console.log('   ' + (ok ? 'PASS' : 'FAIL') + ': ' + name); ok ? passed++ : failed++; };
    const assert_eq = (name, actual, expected) => {
      const a = JSON.stringify(actual), e = JSON.stringify(expected);
      assert(name + ' -> ' + a + (a === e ? '' : ' (expected ' + e + ')'), a === e);
    };
    const outcome = (promise, ms) => Promise.race([
      Promise.resolve(promise).then(() => 'resolved', () => 'rejected'),
      new Promise((resolve) => setTimeout(() => resolve('timeout'), ms))
    ]);
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const queue_len = (comp, name) => (comp._lifecycle_callbacks.get(name) || []).length;

    const target = this.sid('target');

    try {
      console.log('');
      console.log('A. once() WHEN AN EARLIER HANDLER RE-TRIGGERS THE EVENT:');
      // The outer dispatch's snapshot still holds the once() handler after the nested
      // dispatch has fired it; without a fired guard it runs a second time.
      let a_once = 0, a_depth = 0;
      target.on('ese_a', () => {
        if (a_depth++ === 0) target.trigger('ese_a');
      });
      target.once('ese_a', () => { a_once++; });
      target.trigger('ese_a');
      assert_eq('once() handler fired exactly once', a_once, 1);
      assert_eq('once() handler deregistered (only the on() handler left)', queue_len(target, 'ese_a'), 1);

      console.log('');
      console.log('B. once() HANDLER RE-TRIGGERS ITS OWN EVENT:');
      let b_once = 0;
      target.once('ese_b', () => {
        b_once++;
        target.trigger('ese_b');
      });
      target.trigger('ese_b');
      assert_eq('once() handler fired exactly once', b_once, 1);
      assert_eq('nothing left registered', queue_len(target, 'ese_b'), 0);

      console.log('');
      console.log('C. ORDER OF A NESTED DISPATCH:');
      const c_log = [];
      let c_depth = 0;
      target.on('ese_c', () => {
        c_log.push('on1@' + c_depth);
        if (c_depth === 0) { c_depth++; target.trigger('ese_c'); c_depth--; }
      });
      target.once('ese_c', () => c_log.push('once@' + c_depth));
      target.on('ese_c', () => c_log.push('on2@' + c_depth));
      target.trigger('ese_c');
      // Registration order at every level; the nested dispatch runs to completion
      // inside on1; the outer dispatch then skips the once() it already delivered.
      assert_eq('handler order', c_log, ['on1@0', 'on1@1', 'once@1', 'on2@1', 'on2@0']);

      console.log('');
      console.log('D. REPEATED CHILD-READY WAITS LEAVE NO HANDLERS BEHIND:');
      let release;
      window.__ese_gate = new Promise((resolve) => { release = resolve; });
      const parent = $('<div>').appendTo(this.$sid('stage')).component('Ese_Parent', {}).component();
      await sleep(100);
      const first = parent.sid('first');
      const second = parent.sid('second');
      assert('both children are parked in on_load', first._ready_state < 4 && second._ready_state < 4);
      // The parent's own boot is already waiting on both children; add three more waits.
      const waits = [parent._wait_for_children_ready(), parent._wait_for_children_ready(),
                     parent._wait_for_children_ready(), parent.ready()];
      assert('the waits registered on the children', queue_len(first, 'ready') >= 4 && queue_len(first, 'stop') >= 4);
      second.stop();          // second's waits settle through 'stop'
      release();              // first's waits settle through 'ready'
      const d_result = await outcome(Promise.all(waits), 3000);
      assert('every wait resolved -> ' + d_result, d_result === 'resolved');
      assert('first child became ready', first._ready_state >= 4 && !first._stopped);
      assert_eq("first child: 'ready' handlers left", queue_len(first, 'ready'), 0);
      assert_eq("first child: 'stop' handlers left", queue_len(first, 'stop'), 0);
      assert_eq("second child: 'ready' handlers left", queue_len(second, 'ready'), 0);
      assert_eq("second child: 'stop' handlers left", queue_len(second, 'stop'), 0);
      window.__ese_gate = undefined;

      console.log('');
      console.log('E. HANDLER this AND ARGUMENTS:');
      const who = (value) => value === target ? 'component' : value === undefined ? 'undefined'
        : value === window ? 'window' : typeof value;
      const record = (log, label) => function () {
        log.push([label, who(this), arguments.length, who(arguments[0]), arguments[1]]);
      };
      const e_log = [];
      const payload = { n: 1 };
      target.on('ese_e', record(e_log, 'on'));
      target.once('ese_e', record(e_log, 'once'));
      target.trigger('ese_e', payload);
      target.on('ese_e', record(e_log, 'on-sticky'));
      target.once('ese_e', record(e_log, 'once-sticky'));
      target.on('ese_e_nodata', record(e_log, 'on-nodata'));
      target.trigger('ese_e_nodata');
      assert_eq('this/arguments per handler kind', e_log, [
        ['on', 'component', 2, 'component', payload],
        ['once', 'component', 2, 'component', payload],
        ['on-sticky', 'component', 2, 'component', payload],
        ['once-sticky', 'component', 2, 'component', payload],
        ['on-nodata', 'component', 2, 'component', undefined]
      ]);
      assert('the payload is passed by reference', (() => {
        let got;
        target.on('ese_e_ref', (c, d) => { got = d; });
        target.trigger('ese_e_ref', payload);
        return got === payload;
      })());
    } catch (error) {
      console.log('   FAIL: unexpected error: ' + (error && error.stack || error));
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
