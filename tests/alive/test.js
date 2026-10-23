class Test_Alive extends Jqhtml_Component {
  async on_ready() {
    if (this.state.test_ran) return;
    this.state.test_ran = true;

    let passed = 0, failed = 0;
    const assert = (name, ok) => { console.log('   ' + (ok ? 'PASS' : 'FAIL') + ': ' + name); ok ? passed++ : failed++; };
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const stage = this.$sid('stage');
    const mount = () => $('<div>').appendTo(stage).component('Alv_Page', {}).component();
    const deferred = () => { const d = {}; d.promise = new Promise((res, rej) => { d.resolve = res; d.reject = rej; }); return d; };
    // Records how a promise settled; .settled stays false if it never does
    const track = (p) => { const t = { settled: false }; p.then((v) => { t.settled = 'resolved'; t.value = v; }, (e) => { t.settled = 'rejected'; t.error = e; }); return t; };
    const hold = () => { const d = deferred(); window.__alv_gate = d.promise; return () => { window.__alv_gate = null; d.resolve(); }; };
    let unhandled = 0;
    window.addEventListener('unhandledrejection', () => { unhandled++; });

    try {
      console.log('');
      console.log('A. A LIVE COMPONENT: SETTLES LIKE THE WRAPPED PROMISE');
      const c = mount();
      await c.ready();
      assert('resolves with the value', (await c.alive(Promise.resolve(42))) === 42);
      let caught = null;
      try { await c.alive(Promise.reject(new Error('boom'))); } catch (e) { caught = e; }
      assert('rejects with the reason -> ' + (caught && caught.message), caught && caught.message === 'boom');
      assert('a plain value resolves', (await c.alive('plain')) === 'plain');
      const d0 = deferred();
      const t0 = track(c.alive(d0.promise));
      await sleep(10);
      assert('pending while the wrapped promise is pending', t0.settled === false);
      d0.resolve('late');
      await sleep(0);
      assert('resolves once it settles', t0.settled === 'resolved' && t0.value === 'late');

      console.log('');
      console.log('B. ALREADY STOPPED AT THE CALL: NEVER SETTLES');
      c.stop();
      const d1 = deferred();
      const t1 = track(c.alive(d1.promise));
      const t1_plain = track(c.alive('plain'));
      const t1_rej = track(c.alive(Promise.reject(new Error('after stop'))));
      d1.resolve(1);
      await sleep(30);
      assert('wrapped promise resolved, alive() unsettled', t1.settled === false);
      assert('plain value: unsettled', t1_plain.settled === false);
      assert('rejected promise: unsettled', t1_rej.settled === false);
      c.$.parent().remove();

      console.log('');
      console.log('C. STOPPED WHILE WAITING, THEN THE WRAPPED PROMISE RESOLVES');
      const c2 = mount();
      await c2.ready();
      const d2 = deferred();
      let after2 = false;
      const run2 = async () => { await c2.alive(d2.promise); after2 = true; };
      const t2 = track(run2());
      c2.stop();
      d2.resolve('x');
      await sleep(30);
      assert('code after the await did not run', after2 === false);
      assert('the async function never settles', t2.settled === false);
      c2.$.parent().remove();

      console.log('');
      console.log('D. STOPPED WHILE WAITING, THEN THE WRAPPED PROMISE REJECTS');
      const c3 = mount();
      await c3.ready();
      const d3 = deferred();
      let reached3 = false;
      const run3 = async () => { try { await c3.alive(d3.promise); reached3 = 'resolved'; } catch (e) { reached3 = 'caught'; } };
      const t3 = track(run3());
      const before = unhandled;
      c3.stop();
      d3.reject(new Error('late failure'));
      await sleep(50);
      assert('neither the next line nor the catch ran -> ' + reached3, reached3 === false);
      assert('never settles', t3.settled === false);
      assert('no unhandledrejection event', unhandled === before);
      c3.$.parent().remove();

      console.log('');
      console.log('E. EVERY STOP PATH COUNTS');
      const p = mount();
      await p.ready();
      const d4 = deferred();
      const t4 = track(p.sid('child').alive(d4.promise));
      p.stop();
      d4.resolve();
      await sleep(10);
      assert("an ancestor's stop()", t4.settled === false);
      p.$.parent().remove();

      const q = mount();
      await q.ready();
      const d5 = deferred();
      const t5 = track(q.sid('child').alive(d5.promise));
      const d5b = deferred();
      const t5b = track(q.alive(d5b.promise));
      await q.render();
      d5.resolve();
      d5b.resolve('kept');
      await sleep(10);
      assert('a parent re-render (the replaced child)', t5.settled === false);
      assert('the re-rendered parent itself still resolves', t5b.settled === 'resolved');

      const d6 = deferred();
      const t6 = track(q.alive(d6.promise));
      q.$.remove();
      d6.resolve();
      await sleep(10);
      assert('a jQuery .remove()', t6.settled === false);

      console.log('');
      console.log('F. finally RUNS ONLY WHILE ALIVE');
      const f = mount();
      await f.ready();
      const fin = { live: false, stopped: false };
      const d7 = deferred();
      const live_run = (async () => { try { await f.alive(d7.promise); } finally { fin.live = true; } })();
      d7.resolve();
      await live_run;
      assert('finally ran on a live component', fin.live === true);
      const d8 = deferred();
      (async () => { try { await f.alive(d8.promise); } finally { fin.stopped = true; } })();
      f.stop();
      d8.resolve();
      await sleep(30);
      assert('finally did not run on a stopped component', fin.stopped === false);
      f.$.parent().remove();

      console.log('');
      console.log('G. NOT AVAILABLE IN on_load(): AN EXPLANATORY ERROR');
      const errors = [];
      const orig_error = console.error;
      console.error = (...a) => { errors.push(a.join(' ')); orig_error.apply(console, a); };
      const probe = $('<div>').appendTo(stage).component('Alv_Probe', {}).component();
      await probe.ready();
      console.error = orig_error;
      assert('throws -> ' + window.__alv_probe, /Cannot call this\.alive\(\) during on_load\(\)/.test(window.__alv_probe));
      assert('console error explains deduplication',
        errors.some((e) => /this\.alive\(\) is not available in on_load\(\)/.test(e) && /deduplication/.test(e)));
      probe.$.remove();

      console.log('');
      console.log('H. await this.alive(child.ready())');
      let release = hold();
      const h = mount();
      const th = track(h.alive(h.sid('child').ready()));
      await sleep(20);
      assert('pending while the child loads', th.settled === false);
      release();
      await sleep(20);
      assert('resumes when the child becomes ready', th.settled === 'resolved');
      h.$.parent().remove();

      release = hold();
      const h2 = mount();
      const th2 = track(h2.alive(h2.sid('child').ready()));
      await sleep(20);
      h2.stop();
      release();
      await sleep(30);
      assert('never resumes when this component stops first', th2.settled === false);
      h2.$.parent().remove();

      release = hold();
      const h3 = mount();
      const child3 = h3.sid('child');
      const th3 = track(h3.alive(child3.ready()));
      await sleep(20);
      child3.stop();
      await sleep(20);
      assert('only the child stopped: resolves, as ready() does', th3.settled === 'resolved');
      assert("and the child's is_stopped() tells the caller", child3.is_stopped() === true);
      release();
      await sleep(20);
      h3.$.parent().remove();
    } catch (e) {
      assert('no exception: ' + e.message, false);
    }

    console.log('');
    console.log('========================================');
    console.log('SUMMARY: ' + passed + ' passed, ' + failed + ' failed');
    console.log('========================================');
    window.testPassed = (failed === 0);
  }
}
