// The lifecycle lock and queue are cache-mode agnostic; every mode runs every section.
// The cache-key assertions in section 1 read localStorage in the modes that write it.
class Lifecycle_Queue_Boot_Serialization extends Jqhtml_Component {
  async on_ready() {
    if (this.state.test_ran) return;
    this.state.test_ran = true;

    const mode = window.__JQHTML_TEST_CACHE_MODE__ || 'none';

    let passed = 0, failed = 0;
    const assert = (name, ok) => {
      console.log('   ' + (ok ? 'PASS' : 'FAIL') + ': ' + name);
      ok ? passed++ : failed++;
    };

    // Every wait races a deadline: a queue bug shows up as a promise that never settles.
    const within = (promise, ms) => Promise.race([
      Promise.resolve(promise).then(
        value => ({ settled: true, ok: true, value }),
        error => ({ settled: true, ok: false, error })
      ),
      new Promise(resolve => setTimeout(() => resolve({ settled: false }), ms))
    ]);
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    const stage = this.$sid('stage');
    const mount = (name, args) => $('<div>').appendTo(stage).component(name, args || {}).component();

    // Capture warnings (still printed).
    const warnings = [];
    const original_warn = console.warn;
    console.warn = function (...args) {
      warnings.push(args.map(String).join(' '));
      return original_warn.apply(this, args);
    };

    // Started first. Lq_Deadlock awaits reload() in on_loaded() and stays deadlocked, on
    // purpose; the other sections run for well over the 3s a deadlock timer would take.
    window.__lq_nd = { loads: 0, called: false };
    const started = performance.now();
    const dl = mount('Lq_Deadlock');
    const nd = mount('Lq_No_Deadlock');

    try {
      // ---------------------------------------------------------------------------
      console.log('');
      console.log('1. reload() WITH NEW ARGS DURING THE BOOT LOAD:');
      window.__lq_fetch = { log: [] };
      const f = mount('Lq_Fetch', { key: 'old' });
      const f_ready = [];
      f.on('ready', (c) => f_ready.push(c.data.value));
      await sleep(40);   // inside the 200ms old-args on_load()
      f.args.key = 'new';
      // Awaited from outside during the boot on_load(): it waits its turn, silently.
      const f_result = await within(f.reload().then(() => window.__lq_fetch.log.join(',')), 3000);
      await sleep(300);   // past the moment the old-args response lands
      assert('reload() resolved after its turn (boot load, then its own) -> ' + f_result.value,
             f_result.settled && f_result.ok && f_result.value === 'start:old,end:old,start:new,end:new');
      assert('awaiting it from outside during on_load() printed no warning',
             !warnings.some(w => w.includes('Lq_Fetch')));
      assert('this.data is the new-args data -> ' + f.data.value, f.data.value === 'value-new');
      assert('the DOM shows the new-args data -> ' + f.$sid('value').text(), f.$sid('value').text() === 'value-new');
      assert('the loads ran one after the other -> ' + window.__lq_fetch.log.join(','),
             window.__lq_fetch.log.join(',') === 'start:old,end:old,start:new,end:new');
      assert('ready fired once, with the new-args data -> ' + JSON.stringify(f_ready),
             f_ready.length === 1 && f_ready[0] === 'value-new');
      if (mode !== 'none') {
        const entries = Object.keys(localStorage)
          .filter(k => k.includes('Lq_Fetch::lq_new'))
          .map(k => localStorage.getItem(k));
        assert('nothing under the new-args key holds the old-args data -> ' + entries.length + ' entries',
               entries.every(v => !String(v).includes('value-old')));
        if (mode === 'data') {
          assert('the new-args data is cached under the new-args key',
                 entries.some(v => String(v).includes('value-new')));
        }
      }

      // ---------------------------------------------------------------------------
      console.log('');
      console.log('2. render() DURING THE BOOT LOAD:');
      window.__lq_render = { on_ready: [] };
      const r = mount('Lq_Render');
      const r_ready = [];
      r.on('ready', (c) => r_ready.push(c.data.loaded));
      await sleep(20);   // inside the 80ms on_load()
      const r_result = await within(r.render(), 3000);
      await sleep(100);
      assert('render() resolved', r_result.settled && r_result.ok);
      assert('on_ready() never ran before the data arrived -> ' + JSON.stringify(window.__lq_render.on_ready),
             window.__lq_render.on_ready.length > 0 && window.__lq_render.on_ready.every(v => v === true));
      assert('ready fired once, with loaded data -> ' + JSON.stringify(r_ready),
             r_ready.length === 1 && r_ready[0] === true);
      assert('the DOM shows loaded data', r.$sid('state').text() === 'loaded');

      // ---------------------------------------------------------------------------
      console.log('');
      console.log('3. CALLS MADE DURING BOOT RUN AFTER IT, IN CALL ORDER:');
      window.__lq_probe = { loads: 0, renders: 0, marks: [], delay: 50 };
      const q = window.__lq_probe;
      const p = mount('Lq_Probe');
      const order = [];
      let p_ready_count = 0;
      p.on('ready', () => p_ready_count++);
      const track = (name, promise) => within(promise.then(v => { order.push(name); return v; }), 3000);
      const calls = [
        track('load', p.load()),
        track('render', p.render()),
        track('reload', p.reload()),
        track('refresh', p.refresh())
      ];
      // An external waiter registered during boot: resolves once the queue has drained.
      const p_ready = within(p.ready().then(() => q.marks.join(',')), 3000);
      const results = await Promise.all(calls);
      assert('all four calls settled', results.every(x => x.settled && x.ok));
      assert('they completed in call order -> ' + order.join(','), order.join(',') === 'load,render,reload,refresh');
      const p_ready_result = await p_ready;
      assert('ready() resolved only after the last queued load had finished -> ' + p_ready_result.value,
             p_ready_result.settled && /end:4$/.test(p_ready_result.value));
      assert('ready fired once, after the queue drained -> ' + p_ready_count, p_ready_count === 1);
      assert('on_load() ran 4 times (boot, load, reload, refresh) -> ' + q.loads, q.loads === 4);
      const expected_marks = 'start:1:v0,end:1,start:2:v0,end:2,start:3:v0,end:3,start:4:v0,end:4';
      assert('no two loads overlapped -> ' + q.marks.join(','), q.marks.join(',') === expected_marks);
      await within(p.ready(), 2000);

      // ---------------------------------------------------------------------------
      console.log('');
      console.log('4. ADJACENT IDENTICAL CALLS MERGE:');
      let loads_before = q.loads;
      const busy = p.reload();
      const m1 = within(p.load(), 3000);
      const m2 = within(p.load(), 3000);
      const m3 = within(p.load(), 3000);
      const [b, x1, x2, x3] = await Promise.all([within(busy, 3000), m1, m2, m3]);
      assert('everything settled', b.settled && x1.settled && x2.settled && x3.settled);
      assert('three adjacent load() calls ran on_load() once (plus the running reload) -> ' + (q.loads - loads_before),
             q.loads - loads_before === 2);
      assert('all three callers got the result of the one run -> ' + [x1.value, x2.value, x3.value].join(','),
             x1.value === true && x2.value === true && x3.value === true);

      let renders_before = q.renders;
      loads_before = q.loads;
      const busy2 = p.reload();
      const rr1 = within(p.render(), 3000);
      const rr2 = within(p.render(), 3000);
      await Promise.all([within(busy2, 3000), rr1, rr2]);
      assert('two adjacent render() calls rendered once (plus the reload\'s render) -> ' + (q.renders - renders_before),
             q.renders - renders_before === 2);

      // ---------------------------------------------------------------------------
      console.log('');
      console.log('5. NON-ADJACENT OR DIFFERENT CALLS DO NOT MERGE:');
      loads_before = q.loads;
      const busy3 = p.reload();
      const n1 = within(p.reload(), 3000);
      const n2 = within(p.refresh(), 3000);
      const n3 = within(p.reload(), 3000);
      await Promise.all([within(busy3, 3000), n1, n2, n3]);
      assert('reload, refresh, reload queued behind a running reload ran 3 more loads -> ' + (q.loads - loads_before - 1),
             q.loads - loads_before === 4);

      loads_before = q.loads;
      const busy4 = p.reload();
      const d1 = within(p.load(), 3000);
      const d2 = within(p.render(), 3000);
      const d3 = within(p.load(), 3000);
      await Promise.all([within(busy4, 3000), d1, d2, d3]);
      assert('load, render, load ran both loads -> ' + (q.loads - loads_before - 1), q.loads - loads_before === 3);

      loads_before = q.loads;
      const busy5 = p.reload();
      const a1 = within(p.reload(true), 3000);
      const a2 = within(p.reload(false), 3000);
      await Promise.all([within(busy5, 3000), a1, a2]);
      assert('reload(true) then reload(false) (different arguments) ran twice -> ' + (q.loads - loads_before - 1),
             q.loads - loads_before === 3);

      // ---------------------------------------------------------------------------
      console.log('');
      console.log('6. A CALL NEVER MERGES INTO THE RUNNING ENTRY; A PENDING ENTRY READS ARGS WHEN IT STARTS:');
      loads_before = q.loads;
      const marks_from = q.marks.length;
      p.args.v = 1;
      const s1 = within(p.reload(), 3000);   // runs now, reads v=1
      p.args.v = 2;
      const s2 = within(p.reload(), 3000);   // a new pending entry (the running one is not merged into)
      p.args.v = 3;
      const s3 = within(p.reload(), 3000);   // merges into s2's pending entry
      const [t1, t2, t3] = await Promise.all([s1, s2, s3]);
      const starts = q.marks.slice(marks_from).filter(m => m.startsWith('start:')).map(m => m.split(':')[2]);
      assert('all three settled', t1.settled && t2.settled && t3.settled);
      assert('two runs: the running one, then the pending one -> ' + (q.loads - loads_before), q.loads - loads_before === 2);
      assert('the running entry used the args it started with, the pending one the newest -> ' + starts.join(','),
             starts.join(',') === 'v1,v3');
      assert('this.data reflects the newest args -> ' + p.data.value, /^v3-run/.test(p.data.value));

      // ---------------------------------------------------------------------------
      console.log('');
      console.log('7. reload() FROM on_ready() (the lock covers on_ready()):');
      window.__lq_rr = { loads: 0, marks: [], on_ready_runs: [], triggered: false, started_sync: null };
      const rr = mount('Lq_Ready_Reload');
      const rr_ready = [];
      rr.on('ready', (c) => rr_ready.push(c.data.run));
      // An external waiter, registered during boot.
      const rr_waited = within(rr.ready().then(() => ({
        run: rr.data.run,
        on_ready_runs: window.__lq_rr.on_ready_runs.length
      })), 3000);
      const rr_result = await rr_waited;
      await sleep(150);
      const rr_marks = window.__lq_rr.marks.join(',');
      assert('the reload did not start inside on_ready()', window.__lq_rr.started_sync === false);
      assert('it ran after on_ready() returned, and on_ready() ran again on the reload cycle -> ' + rr_marks,
             rr_marks === 'load:1,on_ready:1,on_ready_return:1,load:2,on_ready:2,on_ready_return:2');
      assert('on_ready() saw the boot data, then the reloaded data -> ' + JSON.stringify(window.__lq_rr.on_ready_runs),
             JSON.stringify(window.__lq_rr.on_ready_runs) === '[1,2]');
      assert('an external await comp.ready() resolved only after the queued reload -> ' + JSON.stringify(rr_result.value),
             rr_result.settled && rr_result.value.run === 2 && rr_result.value.on_ready_runs === 2);
      assert('ready fired once, after the reload -> ' + JSON.stringify(rr_ready),
             rr_ready.length === 1 && rr_ready[0] === 2);
      assert('the unawaited reload() in on_ready() printed no await warning',
             !warnings.some(w => w.includes('Lq_Ready_Reload')));

      // ---------------------------------------------------------------------------
      console.log('');
      console.log('8. LOAD SEQUENCING: A SUPERSEDED LOAD IS DROPPED:');
      window.__lq_seq = { delays: [] };
      const sq = mount('Lq_Seq', { tag: 'boot' });
      await within(sq.ready(), 3000);
      // _reload() called directly bypasses the queue: the only way to overlap two loads.
      window.__lq_seq.delays = [150, 20];
      sq.args.tag = 'slow';
      const sq1 = within(sq._reload(true), 3000);
      sq.args.tag = 'fast';
      const sq2 = within(sq._reload(true), 3000);
      await Promise.all([sq1, sq2]);
      await sleep(50);
      assert('the newest load\'s data stands, the older response was dropped -> ' + sq.data.value,
             sq.data.value === 'fast');

      // ---------------------------------------------------------------------------
      console.log('');
      console.log('9. DEVELOPMENT WARNINGS:');
      const hw = mount('Lq_Warn_Hooks');
      await within(hw.ready(), 3000);
      await sleep(100);
      assert('load() from on_create() warned',
             warnings.some(w => w.includes('Lq_Warn_Hooks') && w.includes('load() called from on_create()')));
      assert('refresh() from on_render() warned, saying what on_render() is for',
             warnings.some(w => w.includes('Lq_Warn_Hooks') && w.includes('refresh() called from on_render()') &&
                                w.includes('styling freshly rendered DOM')));

      // Awaiting reload() in on_loaded() deadlocks (on purpose here) and warns.
      await sleep(300);
      const loaded_warning = "reload() was awaited while Lq_Deadlock's on_loaded() is still running. " +
        'If on_loaded() awaits this call it will deadlock: call it without await. ' +
        'Code outside the component should await comp.ready() before awaiting reload() or refresh().';
      assert('await this.reload() in on_loaded() warned, naming method, component and hook',
             warnings.some(w => w.includes(loaded_warning)));
      assert('it warned once -> ' + warnings.filter(w => w.includes("Lq_Deadlock's")).length,
             warnings.filter(w => w.includes("Lq_Deadlock's")).length === 1);
      assert('that component is indeed deadlocked (not ready)', dl._ready_state < 4);

      // An unawaited call made in on_loaded() completes and warns nothing.
      assert('an unawaited reload() in on_loaded() completed -> loads ' + window.__lq_nd.loads,
             window.__lq_nd.loads === 2 && nd._ready_state === 4);
      assert('and printed no warning', !warnings.some(w => w.includes('Lq_No_Deadlock')));

      // Awaiting from outside once the component is ready: nothing to warn about.
      window.__lq_seq.delays = [];
      const quiet = mount('Lq_Seq', { tag: 'quiet' });
      await within(quiet.ready(), 3000);
      const warnings_before = warnings.length;
      await within(quiet.reload(), 3000);
      await within(quiet.refresh(), 3000);
      assert('awaiting reload()/refresh() after ready printed no warning -> ' + (warnings.length - warnings_before),
             warnings.length === warnings_before);

      // No deadlock timer: Lq_Deadlock has been stuck in on_loaded() for over 3s.
      const wait_left = 3400 - (performance.now() - started);
      if (wait_left > 0) await sleep(wait_left);
      assert('no "possible deadlock" timer warning exists',
             !warnings.some(w => /possible deadlock/i.test(w)));

      // ---------------------------------------------------------------------------
      console.log('');
      console.log('10. AN AWAITED CALL IN on_ready() RUNS AT ONCE, NESTED:');
      window.__lq_ra = { loads: 0, marks: [], triggered: false, load_result: null };
      const ra = mount('Lq_Ready_Await');
      const ra_ready = [];
      ra.on('ready', (c) => ra_ready.push(c.data.run));
      const ra_result = await within(ra.ready(), 3000);
      await sleep(100);
      const ra_marks = window.__lq_ra.marks.filter(m => m !== 'render').join(',');
      assert('ready() resolved', ra_result.settled);
      assert('await render(), load(), reload() each ran inside on_ready() and resolved -> ' + ra_marks,
             ra_marks === 'load:1,on_ready:1,on_ready:1,render_resolved,load:2,load_resolved:2,load:3,on_ready:3,reload_resolved:3,on_ready_return');
      assert('load() resolved with its own result -> ' + window.__lq_ra.load_result, window.__lq_ra.load_result === true);
      assert('ready fired once, after on_ready() returned -> ' + JSON.stringify(ra_ready),
             ra_ready.length === 1 && ra_ready[0] === 3);
      assert('no warning names it', !warnings.some(w => w.includes('Lq_Ready_Await')));

      console.log('');
      console.log('11. ...WITHOUT LETTING A LATER UNAWAITED CALL RUN EARLY:');
      window.__lq_ro = { loads: 0, marks: [], triggered: false };
      const ro = mount('Lq_Ready_Order');
      const ro_ready = [];
      ro.on('ready', (c) => ro_ready.push(c.data.run));
      const ro_result = await within(ro.ready(), 3000);
      await sleep(100);
      const ro_marks = window.__lq_ro.marks.join(',');
      assert('ready() resolved', ro_result.settled);
      assert('the awaited reload ran at once; the later reload() and render() waited for on_ready() -> ' + ro_marks,
             ro_marks === 'load:1,on_ready:1,load:2,on_ready:2,awaited_resolved,on_ready_return,load:3,on_ready:3,on_ready:3');
      assert('the reload() made after the promotion did not merge into it (3 loads) -> ' + window.__lq_ro.loads,
             window.__lq_ro.loads === 3);
      assert('ready fired once, after the queue drained -> ' + JSON.stringify(ro_ready),
             ro_ready.length === 1 && ro_ready[0] === 3);
      assert('no warning names it', !warnings.some(w => w.includes('Lq_Ready_Order')));
    } catch (error) {
      assert('test threw: ' + (error && error.stack || error), false);
    } finally {
      console.warn = original_warn;
    }

    console.log('');
    console.log('SUMMARY: ' + passed + ' passed, ' + failed + ' failed');
    this.$sid('results').text(passed + ' passed, ' + failed + ' failed');
    window.testPassed = failed === 0;
  }
}
