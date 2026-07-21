// gate_load() feature test
//
// Exercises the load-gate lifecycle affordance added to @jqhtml/core Component:
//   this.gate_load(promise) registered during on_create() defers the component's
//   FIRST on_load() until the registered promises settle. See tests/gate_load/README.md.
//
// The harness controls gate timing via window.__gate_registry (deferred promises)
// and reads per-key lifecycle counters from window.__gate_counts.

class Gate_Load_Test extends Jqhtml_Component {
  on_create() {
    window.__gate_registry = {};
    window.__gate_counts = {};
  }

  async on_ready() {
    if (this.state.test_ran) return;
    this.state.test_ran = true;

    let passed = 0;
    let failed = 0;
    let n = 0;

    function check(label, condition) {
      n++;
      console.log('');
      console.log(n + '. ' + label + ':');
      if (condition) {
        console.log('   PASS');
        passed++;
      } else {
        console.log('   FAIL');
        failed++;
      }
    }

    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    function deferred() {
      let resolve, reject;
      const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
      return { promise, resolve, reject };
    }

    const results = this.$sid('results');

    // Create an attached (in-DOM) Gated_Component with `num_gates` unresolved gates.
    function make_gated(key, num_gates) {
      const deferreds = [];
      const gates = [];
      for (let i = 0; i < num_gates; i++) {
        const d = deferred();
        deferreds.push(d);
        gates.push(d.promise);
      }
      window.__gate_registry[key] = gates;
      const $el = $('<div>').appendTo(results);
      $el.component('Gated_Component', { gate_key: key });
      return { $el, comp: $el.component(), deferreds };
    }

    const count = (key, phase) => (window.__gate_counts[key] || {})[phase] || 0;
    const content = (comp) => comp.$sid('content').text().trim();

    // ========================================================================
    // A) A gate delays the first on_load until it resolves
    // ========================================================================
    const a = make_gated('a', 1);
    await sleep(50);
    check('A: on_load does NOT run while a gate is pending', count('a', 'load') === 0);
    a.deferreds[0].resolve();
    await a.comp.ready();
    check('A: on_load runs once the gate resolves', count('a', 'load') === 1);
    check('A: content reflects loaded data after gate resolves', content(a.comp) === 'loaded');

    // ========================================================================
    // G) First paint is NOT delayed by a pending gate (synchronous check)
    //    create() + initial render run synchronously, BEFORE the gated load.
    // ========================================================================
    const g = make_gated('g', 1);
    check('G: initial render painted synchronously before the gate (content=initial)',
      content(g.comp) === 'initial');
    check('G: on_load has NOT run yet (paint happened, load gated)', count('g', 'load') === 0);
    g.deferreds[0].resolve();
    await g.comp.ready();
    check('G: after gate resolves, load runs and content updates', content(g.comp) === 'loaded');

    // ========================================================================
    // B) Multiple gates are all awaited together
    // ========================================================================
    const b = make_gated('b', 2);
    await sleep(40);
    check('B: load blocked while 2 gates pending', count('b', 'load') === 0);
    b.deferreds[0].resolve();
    await sleep(40);
    check('B: load still blocked after only 1 of 2 gates resolved', count('b', 'load') === 0);
    b.deferreds[1].resolve();
    await b.comp.ready();
    check('B: load runs after ALL gates resolved', count('b', 'load') === 1);

    // ========================================================================
    // C) A rejected gate does NOT block/abort the load (logged, load proceeds)
    // ========================================================================
    if (!window.jqhtml.debug) window.jqhtml.debug = {};
    const prev_verbose = window.jqhtml.debug.verbose;
    window.jqhtml.debug.verbose = true; // exercise the rejection-logging path
    const c = make_gated('c', 2);
    c.deferreds[0].reject(new Error('gate rejected on purpose'));
    c.deferreds[1].resolve();
    await c.comp.ready();
    check('C: load proceeds despite a rejected gate', count('c', 'load') === 1);
    check('C: content loaded after mixed settle (reject + resolve)', content(c.comp) === 'loaded');
    window.jqhtml.debug.verbose = prev_verbose;

    // ========================================================================
    // D) reload() after the first load does NOT re-await gates
    // ========================================================================
    const d = make_gated('d', 1);
    d.deferreds[0].resolve();
    await d.comp.ready();
    check('D: first gated load ran', count('d', 'load') === 1);
    await d.comp.reload(); // must re-run on_load without waiting on any gate
    check('D: reload() re-runs on_load (no gate re-await)', count('d', 'load') === 2);

    // ========================================================================
    // E) Calling gate_load() after the first load has started THROWS
    // ========================================================================
    const e = make_gated('e', 1);
    e.deferreds[0].resolve();
    await e.comp.ready();
    let e_threw = false;
    try {
      e.comp.gate_load(Promise.resolve());
    } catch (err) {
      e_threw = true;
    }
    check('E: gate_load() after first load throws', e_threw === true);

    // ========================================================================
    // F) A component with NO custom on_load() ignores gates (no throw, no delay)
    // ========================================================================
    const f_gate = deferred(); // deliberately never resolved
    window.__gate_registry['f'] = [f_gate.promise];
    const $f = $('<div>').appendTo(results);
    $f.component('No_Load_Gated_Component', { gate_key: 'f' });
    const f_comp = $f.component();
    let f_ready = false;
    f_comp.ready().then(() => { f_ready = true; });
    await sleep(80);
    check('F: no-on_load component reaches ready despite an unresolved gate', f_ready === true);

    // ========================================================================
    // H) stop() during the gate wait abandons the load cleanly
    // ========================================================================
    const h = make_gated('h', 1);
    await sleep(30);
    check('H: load not run before stop', count('h', 'load') === 0);
    h.comp.stop();
    h.deferreds[0].resolve(); // late settle must have no effect
    await sleep(60);
    check('H: on_load never runs after stop() during gate wait', count('h', 'load') === 0);
    check('H: component is stopped', h.comp._stopped === true);

    // ========================================================================
    // I) reload() while gated RESUMES the lifecycle (ignores the gate),
    //    a later gate settlement is a no-op, and a subsequent reload() is normal.
    // ========================================================================
    const i = make_gated('i', 1); // gate never resolved by us
    await sleep(30);
    check('I: load not run while gated', count('i', 'load') === 0);
    await i.comp.reload(); // resume the paused boot lifecycle
    check('I: reload() while gated resumes load (runs despite unresolved gate)',
      count('i', 'load') === 1);
    check('I: content loaded after resume', content(i.comp) === 'loaded');
    i.deferreds[0].resolve(); // late gate settlement
    await sleep(40);
    check('I: late gate settlement does NOT re-run load', count('i', 'load') === 1);
    await i.comp.reload();
    check('I: reload() after resume behaves normally (re-runs load)', count('i', 'load') === 2);

    // ========================================================================
    // J) refresh() while gated also resumes the lifecycle
    // ========================================================================
    const j = make_gated('j', 1); // gate never resolved by us
    await sleep(30);
    check('J: load not run while gated', count('j', 'load') === 0);
    await j.comp.refresh(); // resume via refresh()
    check('J: refresh() while gated resumes load', count('j', 'load') === 1);

    // ========================================================================
    // K) SSR: gates are a no-op (load runs immediately, gate never awaited).
    //    SSR is signalled to core by data-capture being enabled.
    // ========================================================================
    window.jqhtml.start_data_capture();
    const k = make_gated('k', 1); // gate never resolved
    await k.comp.ready();          // must reach ready without resolving the gate
    check('K: SSR no-op — gated on_load runs without awaiting the gate',
      count('k', 'load') === 1);
    window.jqhtml.stop_data_capture();

    // ========================================================================
    // SUMMARY
    // ========================================================================
    console.log('');
    console.log('========================================');
    console.log('SUMMARY: ' + passed + ' passed, ' + failed + ' failed');
    console.log('========================================');
    console.log('');

    window.testPassed = (failed === 0);
    window.testReady = true;
  }
}
