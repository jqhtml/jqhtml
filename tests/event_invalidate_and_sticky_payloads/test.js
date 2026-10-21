// Every event is sticky: trigger() stores the event and its payload, and .on()/.once()
// registered later fire at once with that payload (event_data_parameter and
// event_system_edge_cases cover the basic replay). invalidate(event_name) drops the
// stored marker: later subscribers wait for the next real trigger, and handlers already
// registered stay registered. Contract: docs/reference/14_lifecycle_complete_specification.md
// ("trigger", "invalidate(event_name)").

class Event_Invalidate_And_Sticky_Payloads extends Jqhtml_Component {
  async on_ready() {
    if (this.state.test_ran) return;
    this.state.test_ran = true;

    let passed = 0, failed = 0;
    const assert = (name, ok) => { console.log('   ' + (ok ? 'PASS' : 'FAIL') + ': ' + name); ok ? passed++ : failed++; };
    const show = (v) => v === undefined ? 'undefined' : JSON.stringify(v);
    const t = this.sid('target');

    try {
      console.log('');
      console.log('A. STICKY PAYLOADS:');
      for (const [label, value] of [['0', 0], ['false', false], ['null', null], ['empty string', '']]) {
        const name = 'eis_falsy_' + label.replace(' ', '_');
        t.trigger(name, value);
        let calls = 0, got = 'not called', got_once = 'not called';
        t.on(name, (c, d) => { calls++; got = d; });
        t.once(name, (c, d) => { got_once = d; });
        assert('a late .on() and .once() receive the falsy payload ' + label + ' unchanged -> ' + show(got) + ' / ' + show(got_once),
               calls === 1 && got === value && got_once === value);
      }

      t.trigger('eis_latest', { n: 1 });
      t.trigger('eis_latest');
      let latest = 'not called';
      t.on('eis_latest', (c, d) => { latest = d; });
      assert('a later trigger without a payload replaces the stored one -> ' + show(latest), latest === undefined);

      let inner = 'not called';
      let inner_calls = 0;
      t.on('eis_nested', () => {
        if (inner_calls) return;
        t.on('eis_nested', (c, d) => { inner_calls++; inner = d; });
      });
      t.trigger('eis_nested', { n: 2 });
      assert('a handler registered during dispatch gets the payload being dispatched, once -> ' + show(inner) + ' x' + inner_calls,
             inner_calls === 1 && inner && inner.n === 2);

      console.log('');
      console.log('B. invalidate() ON A CUSTOM EVENT:');
      const log = [];
      t.on('eis_inv', (c, d) => log.push('early:' + d));
      t.trigger('eis_inv', 'first');
      t.invalidate('eis_inv');
      t.on('eis_inv', (c, d) => log.push('late:' + d));
      t.once('eis_inv', (c, d) => log.push('once:' + d));
      assert('after invalidate() a new .on()/.once() does not fire immediately -> ' + log.join(','),
             log.join(',') === 'early:first');
      t.trigger('eis_inv', 'second');
      assert('the next trigger fires the existing handler and both late ones, with the new payload -> ' + log.join(','),
             log.join(',') === 'early:first,early:second,late:second,once:second');
      t.trigger('eis_inv', 'third');
      assert('.once() registered after invalidate() fired only once -> ' + log.join(','),
             log.join(',') === 'early:first,early:second,late:second,once:second,early:third,late:third');
      let after = 'not called';
      t.on('eis_inv', (c, d) => { after = d; });
      assert('the event is sticky again after the next trigger -> ' + show(after), after === 'third');

      let other = 'not called';
      t.trigger('eis_other', 'kept');
      t.trigger('eis_inv2', 'x');
      t.invalidate('eis_inv2');
      t.on('eis_other', (c, d) => { other = d; });
      assert('invalidate() leaves other events sticky -> ' + show(other), other === 'kept');

      let threw = null;
      try { t.invalidate('eis_never_triggered'); } catch (e) { threw = e; }
      let never = false;
      t.on('eis_never_triggered', () => { never = true; });
      assert('invalidate() of an event that never fired is a no-op', threw === null && never === false);

      console.log('');
      console.log("C. invalidate('ready') ON A READY COMPONENT:");
      let resolved = false, callback_ran = false, on_ready_fired = false;
      t.invalidate('ready');
      const waiting = t.ready(() => { callback_ran = true; }).then(() => { resolved = true; });
      t.on('ready', () => { on_ready_fired = true; });
      await new Promise((r) => setTimeout(r, 30));
      assert('ready() does not resolve, its callback does not run and .on(\'ready\') does not fire',
             !resolved && !callback_ran && !on_ready_fired);
      t.trigger('ready');
      await waiting;
      assert('trigger(\'ready\') resolves ready(), runs its callback and fires .on(\'ready\')',
             resolved && callback_ran && on_ready_fired);
      let immediate = false;
      await t.ready(() => { immediate = true; });
      assert('ready() resolves immediately again afterwards', immediate);

      console.log('');
      console.log("D. render() INVALIDATES 'ready' FOR SUBSCRIBERS THAT ARRIVE DURING IT:");
      const renders = t.state.renders;
      let fired_at = null;
      const rendering = t.render();
      t.on('ready', () => { if (fired_at === null) fired_at = t.state.renders; });
      assert('a .on(\'ready\') registered right after render() did not fire immediately', fired_at === null);
      await rendering;
      assert('it fired once the render completed -> renders at fire ' + fired_at + ' (before ' + renders + ')',
             fired_at === renders + 1);
    } catch (error) {
      console.log('   FAIL: the test itself threw -> ' + (error && error.stack || error));
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
