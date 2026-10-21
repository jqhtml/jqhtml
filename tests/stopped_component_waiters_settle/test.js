class Stopped_Component_Waiters_Settle extends Jqhtml_Component {
  async on_ready() {
    if (this.state.test_ran) return;
    this.state.test_ran = true;

    let passed = 0, failed = 0;
    const assert = (name, ok) => { console.log('   ' + (ok ? 'PASS' : 'FAIL') + ': ' + name); ok ? passed++ : failed++; };

    // Every wait races an explicit deadline, so a waiter that never settles shows up
    // as a FAILED assertion rather than as a harness timeout. 'resolved' / 'rejected'
    // / 'timeout' distinguishes the contract (resolve) from the alternatives.
    const outcome = (promise, ms) => Promise.race([
      Promise.resolve(promise).then(() => 'resolved', () => 'rejected'),
      new Promise((resolve) => setTimeout(() => resolve('timeout'), ms))
    ]);
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const queue_len = (comp, name) => (comp._lifecycle_callbacks.get(name) || []).length;

    // Park the next Sw_Slow inside its on_load(): resolves once on_load() has started;
    // release() lets that load finish. No fixed sleep, so it holds under any load.
    const hold_next_load = () => {
      let entered, release;
      const parked = new Promise((resolve) => { entered = resolve; });
      const released = new Promise((resolve) => { release = resolve; });
      window.__sw_hold = () => { window.__sw_hold = null; entered(); return released; };
      return { parked, release };
    };

    const stage = this.$sid('stage');

    try {
      console.log('');
      console.log('A. ready() ON A COMPONENT THAT IS ALREADY STOPPED:');
      const a = $('<div>').appendTo(stage).component('Sw_Slow', { case: 'a' }).component();
      a.stop();
      assert('the component is stopped', a._stopped === true);
      let a_cb = 0;
      const a_result = await outcome(a.ready(() => { a_cb++; }), 500);
      assert('ready() resolves -> ' + a_result, a_result === 'resolved');
      assert('the ready() callback did NOT run on a stopped component -> ' + a_cb, a_cb === 0);
      assert('no ready listener left behind -> ' + queue_len(a, 'ready'), queue_len(a, 'ready') === 0);

      console.log('');
      console.log('B. ready() PENDING WHEN THE COMPONENT STOPS:');
      const b_hold = hold_next_load();
      const b = $('<div>').appendTo(stage).component('Sw_Slow', { case: 'b' }).component();
      let b_cb = 0;
      const b_promise = b.ready(() => { b_cb++; });
      await b_hold.parked;   // parked inside on_load()
      assert('the component is not ready yet', b._ready_state < 4);
      b.stop();
      const b_result = await outcome(b_promise, 500);
      b_hold.release();
      assert('the pending ready() resolves on stop -> ' + b_result, b_result === 'resolved');
      assert('its callback did NOT run -> ' + b_cb, b_cb === 0);
      assert('no ready listener left behind -> ' + queue_len(b, 'ready'), queue_len(b, 'ready') === 0);

      console.log('');
      console.log('C. rendered() ON A COMPONENT THAT IS ALREADY STOPPED:');
      const c = $('<div>').appendTo(stage).component('Sw_Slow', { case: 'c' }).component();
      c.stop();
      let c_cb = 0;
      const c_result = await outcome(c.rendered(() => { c_cb++; }), 500);
      assert('rendered() resolves -> ' + c_result, c_result === 'resolved');
      assert('the rendered() callback did NOT run on a stopped component -> ' + c_cb, c_cb === 0);
      assert('no rendered listener left behind -> ' + queue_len(c, 'rendered'), queue_len(c, 'rendered') === 0);

      console.log('');
      console.log('D. rendered() PENDING WHEN THE COMPONENT STOPS:');
      const d_hold = hold_next_load();
      const d = $('<div>').appendTo(stage).component('Sw_Slow', { case: 'd' }).component();
      let d_cb = 0;
      const d_promise = d.rendered(() => { d_cb++; });
      await d_hold.parked;   // parked inside on_load()
      assert('the component has not fired rendered yet', !d._lifecycle_states.has('rendered'));
      d.stop();
      const d_result = await outcome(d_promise, 500);
      d_hold.release();
      assert('the pending rendered() resolves on stop -> ' + d_result, d_result === 'resolved');
      assert('its callback did NOT run -> ' + d_cb, d_cb === 0);
      assert('no rendered listener left behind -> ' + queue_len(d, 'rendered'), queue_len(d, 'rendered') === 0);

      console.log('');
      console.log('E. WAITERS ON A HEALTHY COMPONENT LEAVE NO LISTENERS BEHIND:');
      const e = $('<div>').appendTo(stage).component('Sw_Slow', { case: 'e' }).component();
      const stop_before = queue_len(e, 'stop');
      let e_ready_cb = 0, e_rendered_cb = 0;
      const e_waits = [e.ready(() => { e_ready_cb++; }), e.ready(),
                       e.rendered(() => { e_rendered_cb++; }), e.rendered()];
      const e_result = await outcome(Promise.all(e_waits), 2000);
      assert('ready()/rendered() resolve normally -> ' + e_result, e_result === 'resolved');
      assert('the component really became ready', e._ready_state >= 4 && !e._stopped);
      assert('the ready() callback ran once on the real ready -> ' + e_ready_cb, e_ready_cb === 1);
      assert('the rendered() callback ran once on the real rendered -> ' + e_rendered_cb, e_rendered_cb === 1);
      assert('no stop listeners accumulated -> ' + queue_len(e, 'stop') + ' (was ' + stop_before + ')',
             queue_len(e, 'stop') === stop_before);
      assert('no rendered listeners accumulated -> ' + queue_len(e, 'rendered'),
             queue_len(e, 'rendered') === 0);
      assert('no ready listeners accumulated -> ' + queue_len(e, 'ready'),
             queue_len(e, 'ready') === 0);

      console.log('');
      console.log('F. jqhtml.boot() RESOLVES WHEN A PLACEHOLDER\'S on_create() THROWS:');
      const boot_stage = this.$sid('boot_stage');
      boot_stage.html(
        '<div class="_Component_Init" data-component-init-name="Sw_Throw_Create"></div>' +
        '<div class="_Component_Init" data-component-init-name="Sw_Plain"></div>'
      );
      let ready_events = 0;
      const on_ready_event = () => { ready_events++; };
      document.addEventListener('jqhtml:ready', on_ready_event);
      const f_result = await outcome(jqhtml.boot(boot_stage), 1000);
      await sleep(20);   // jqhtml:ready dispatches from a .then() after boot() settles
      document.removeEventListener('jqhtml:ready', on_ready_event);
      assert('await jqhtml.boot() resolves -> ' + f_result, f_result === 'resolved');
      assert('jqhtml:ready fired -> ' + ready_events, ready_events === 1);
      const thrower = boot_stage.children().eq(0).component();
      assert('the failing placeholder component is stopped',
             !!thrower && thrower._stopped === true);
      const plain = boot_stage.children().eq(1).component();
      assert('the healthy placeholder still reached ready',
             !!plain && plain._ready_state >= 4 && !plain._stopped);
    } catch (error) {
      console.log('   FAIL: the test itself threw -> ' + error.message);
      console.error(error);
      failed++;
    }

    console.log('');
    console.log('========================================');
    console.log('SUMMARY: ' + passed + ' passed, ' + failed + ' failed');
    console.log('========================================');
    console.log('');
    window.testPassed = (failed === 0);
    window.testReady = true;
  }
}
