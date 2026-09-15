// The lifecycle queue is cache-mode agnostic - every assertion below is about
// collapse, ordering and rejection, none about caching.
const VALID_MODES = ['none', 'data', 'html'];

class Queue_Collapse_And_Ordering extends Jqhtml_Component {
  on_create() {
    window.__q = {
      on_load_calls: 0,
      render_calls: 0,
      marks: [],
      throw_next: false,
      freeze: false,
      delay: 30
    };
  }

  async on_ready() {
    if (this.state.test_ran) return;
    this.state.test_ran = true;

    const mode = window.__JQHTML_TEST_CACHE_MODE__ || 'none';
    if (!VALID_MODES.includes(mode)) {
      console.log('[SKIP] Test only applies to modes: ' + VALID_MODES.join(', ') + ' (current: ' + mode + ')');
      console.log('SUMMARY: skipped (mode ' + mode + ')');
      window.testPassed = true;
      return;
    }

    let passed = 0, failed = 0;
    const assert = (name, ok) => {
      console.log('   ' + (ok ? 'PASS' : 'FAIL') + ': ' + name);
      ok ? passed++ : failed++;
    };

    // Every wait in this test is raced against a timeout: a queue bug shows up as a
    // promise that never settles, and an un-raced await would hang the whole run
    // instead of failing an assertion.
    const within = (promise, ms) => Promise.race([
      Promise.resolve(promise).then(
        value => ({ settled: true, ok: true, value }),
        error => ({ settled: true, ok: false, error })
      ),
      new Promise(resolve => setTimeout(() => resolve({ settled: false }), ms))
    ]);

    const q = window.__q;
    const probe = this.sid('probe');
    assert('probe component exists', !!probe);
    if (!probe) {
      console.log('SUMMARY: ' + passed + ' passed, ' + (failed + 1) + ' failed');
      window.testPassed = false;
      return;
    }

    // -------------------------------------------------------------------------
    // 1. THREE SYNCHRONOUS load() CALLS COLLAPSE TO TWO RUNS - AND ALL THREE
    //    CALLERS GET THE RESULT OF THE RUN THAT ACTUALLY RAN.
    // -------------------------------------------------------------------------
    console.log('');
    console.log('1. THREE RAPID load() CALLS:');
    let loads_before = q.on_load_calls;

    probe.args.seq = 1; const l1 = within(probe.load(), 2000);
    probe.args.seq = 2; const l2 = within(probe.load(), 2000);
    probe.args.seq = 3; const l3 = within(probe.load(), 2000);

    const [r1, r2, r3] = await Promise.all([l1, l2, l3]);
    assert('load() #1 settled', r1.settled);
    assert('load() #2 settled', r2.settled);
    assert('load() #3 settled', r3.settled);
    assert('load() #1 resolved true -> ' + JSON.stringify(r1.value), r1.ok && r1.value === true);
    assert('load() #2 resolved true -> ' + JSON.stringify(r2.value), r2.ok && r2.value === true);
    assert('load() #3 resolved true -> ' + JSON.stringify(r3.value), r3.ok && r3.value === true);
    assert('on_load ran exactly twice (running + one collapsed) -> ' + (q.on_load_calls - loads_before),
           q.on_load_calls - loads_before === 2);
    assert('this.data carries the value of the run that actually ran -> ' + probe.data.value,
           probe.data.value === 'seq-3-run-' + q.on_load_calls);

    // -------------------------------------------------------------------------
    // 2. load() THEN render(), FIRED SYNCHRONOUSLY.
    // -------------------------------------------------------------------------
    console.log('');
    console.log('2. load() FOLLOWED BY render():');
    loads_before = q.on_load_calls;
    probe.args.seq = 4;
    const l_a = within(probe.load(), 1000);
    const r_a = within(probe.render(), 1000);
    const [lr, rr] = await Promise.all([l_a, r_a]);
    assert('load() settled within 1s', lr.settled && lr.ok);
    assert('render() settled within 1s', rr.settled && rr.ok);
    assert('on_load ran exactly once -> ' + (q.on_load_calls - loads_before),
           q.on_load_calls - loads_before === 1);
    assert('the DOM shows the loaded value -> "' + probe.$sid('value').text() + '"',
           probe.$sid('value').text() === probe.data.value);

    // 2b. The same pair queued BEHIND a running operation: the pending load() must
    //     not be thrown away by the render() that lands on top of it.
    console.log('');
    console.log('2b. load() AND render() QUEUED BEHIND A RUNNING reload():');
    loads_before = q.on_load_calls;
    const b_reload = within(probe.reload(), 2000);
    const b_load = within(probe.load(), 2000);
    const b_render = within(probe.render(), 2000);
    const [br, bl, bd] = await Promise.all([b_reload, b_load, b_render]);
    assert('reload() settled', br.settled && br.ok);
    assert('load() settled', bl.settled && bl.ok);
    assert('render() settled', bd.settled && bd.ok);
    assert('the queued load() really ran: on_load called twice -> ' + (q.on_load_calls - loads_before),
           q.on_load_calls - loads_before === 2);
    assert('the queued load() resolved true -> ' + JSON.stringify(bl.value), bl.value === true);
    assert('the DOM shows the loaded value -> "' + probe.$sid('value').text() + '"',
           probe.$sid('value').text() === probe.data.value);

    // -------------------------------------------------------------------------
    // 3. A CALLER SETTLES BEFORE THE NEXT QUEUED OPERATION STARTS.
    // -------------------------------------------------------------------------
    console.log('');
    console.log('3. FIRST reload() RESOLVES BEFORE THE SECOND ONE STARTS:');
    const marks_from = q.marks.length;
    const t1 = probe.reload();
    t1.then(() => q.marks.push({ k: 'first_reload_resolved', t: performance.now() }), () => {});
    const t1w = within(t1, 2000);
    const t2w = within(probe.reload(), 2000);
    const [tr1, tr2] = await Promise.all([t1w, t2w]);
    assert('both reload() calls settled', tr1.settled && tr1.ok && tr2.settled && tr2.ok);

    const order = q.marks.slice(marks_from).map(m => m.k);
    console.log('   marks: ' + order.join(' -> '));
    const resolved_at = order.indexOf('first_reload_resolved');
    const starts = order.reduce((acc, k, i) => (k === 'on_load_start' ? acc.concat(i) : acc), []);
    assert('two on_load runs were recorded -> ' + starts.length, starts.length === 2);
    assert('the first reload() resolved before the second reload()\'s on_load started',
           resolved_at !== -1 && starts.length === 2 && resolved_at < starts[1]);

    // -------------------------------------------------------------------------
    // 4. A THROWING EXECUTOR REJECTS ITS OWN CALLERS; THE QUEUE CONTINUES.
    // -------------------------------------------------------------------------
    console.log('');
    console.log('4. A THROWING on_load REJECTS ITS CALLER AND THE QUEUE CONTINUES:');
    loads_before = q.on_load_calls;
    q.throw_next = true;
    const bad = within(probe.load(), 2000);
    const after_bad = within(probe.reload(), 2000);
    const [bad_r, after_r] = await Promise.all([bad, after_bad]);
    assert('the throwing load() settled', bad_r.settled);
    assert('the throwing load() REJECTED -> ' + (bad_r.error && bad_r.error.message),
           bad_r.settled && bad_r.ok === false &&
           !!bad_r.error && /queue_test_boom/.test(String(bad_r.error.message)));
    assert('the next queued reload() still resolved', after_r.settled && after_r.ok);
    assert('on_load ran twice: the thrower and the follower -> ' + (q.on_load_calls - loads_before),
           q.on_load_calls - loads_before === 2);

    // -------------------------------------------------------------------------
    // 5. REGRESSION: refresh() QUEUED BEHIND reload() - reload() WINS.
    //    Both share the 'reload' queue type, so the second call collapses into the
    //    first's pending entry; next_reload_force_refresh keeps the force-render.
    // -------------------------------------------------------------------------
    console.log('');
    console.log('5. refresh() QUEUED BEHIND reload() (precedence regression check):');
    q.freeze = true;
    const settle = await within(probe.reload(), 2000);
    assert('settling reload() (data becomes constant) resolved', settle.settled && settle.ok);

    let renders_before = q.render_calls;
    const control = await within(probe.refresh(), 2000);
    assert('a lone refresh() with unchanged data resolved', control.settled && control.ok);
    assert('a lone refresh() with unchanged data did NOT render -> ' + (q.render_calls - renders_before),
           q.render_calls - renders_before === 0);

    renders_before = q.render_calls;
    const p_reload = within(probe.reload(), 2000);
    const p_refresh = within(probe.refresh(), 2000);
    const [pr, pf] = await Promise.all([p_reload, p_refresh]);
    assert('reload() settled', pr.settled && pr.ok);
    assert('refresh() queued behind it settled', pf.settled && pf.ok);
    assert('both runs rendered - reload() precedence survives the collapse -> ' +
           (q.render_calls - renders_before),
           q.render_calls - renders_before === 2);

    console.log('');
    console.log('SUMMARY: ' + passed + ' passed, ' + failed + ' failed');
    this.$sid('results').text(passed + ' passed, ' + failed + ' failed');
    window.testPassed = failed === 0;
  }
}
