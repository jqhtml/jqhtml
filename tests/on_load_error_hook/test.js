class On_Load_Error_Hook extends Jqhtml_Component {
  async on_ready() {
    if (this.state.test_ran) return;
    this.state.test_ran = true;

    let passed = 0, failed = 0;
    const assert = (name, ok) => { console.log('   ' + (ok ? 'PASS' : 'FAIL') + ': ' + name); ok ? passed++ : failed++; };

    const L = window.__le;
    const cache_mode = window.__JQHTML_TEST_CACHE_MODE__ || 'none';
    const registry = () => JSON.stringify(window.jqhtml.Load_Coordinator.get_registry_state());

    // Every wait races an explicit deadline: a hang must show up as a FAILED
    // assertion, never as a harness timeout.
    const settled = (promise, ms) => Promise.race([
      Promise.resolve(promise).then(() => true, () => false),
      new Promise((resolve) => setTimeout(() => resolve(false), ms))
    ]);
    const outcome = (promise, ms) => Promise.race([
      Promise.resolve(promise).then(() => ({ settled: true, ok: true }), (error) => ({ settled: true, ok: false, error })),
      new Promise((resolve) => setTimeout(() => resolve({ settled: false }), ms))
    ]);
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const text = (comp) => comp.$.text().trim();
    const hooks_for = (key) => L.hooks.filter((h) => h.key === key);

    // console.error capture: how many times was THIS error object printed?
    const printed_args = [];
    const original_error = console.error;
    console.error = (...a) => { printed_args.push(a); original_error.apply(console, a); };
    const times_printed = (error) => printed_args.filter((a) => a.includes(error)).length;
    const lines_matching = (re) => printed_args.filter((a) => re.test(a.map(String).join(' '))).length;

    // Cache access spy: Storage reads/writes whose key names a Le_ component.
    let reads = 0, writes = 0;
    const real_get = Storage.prototype.getItem;
    const real_set = Storage.prototype.setItem;
    Storage.prototype.getItem = function (k) { if (String(k).includes('Le_')) reads++; return real_get.call(this, k); };
    Storage.prototype.setItem = function (k, v) { if (String(k).includes('Le_')) writes++; return real_set.call(this, k, v); };
    const stored_keys = (needle) => Object.keys(localStorage).filter((k) => k.includes(needle));

    const stage = this.$sid('stage');
    const make = (name, args) => $('<div>').component(name, args).appendTo(stage).component();

    try {
      console.log('');
      console.log('A. BOOT LOAD FAILURES, ONE CHILD PER VARIANT (cache mode ' + cache_mode + '):');
      for (const k of ['b_plain', 'b_fb', 'b_super', 'b_rethrow', 'b_async']) L.fail[k] = 1;
      writes = 0;

      const parent = make('Le_Parent', {});
      assert('the parent reaches ready despite every child failing its load',
             await settled(parent.ready(), 2000));

      const plain = parent.sid('plain');
      const fb = parent.sid('fallback');
      const sup = parent.sid('super');
      const rethrow = parent.sid('rethrow');
      const async_c = parent.sid('async');

      console.log('  no override:');
      assert('the component is stopped -> ' + (plain && plain._stopped), !!plain && plain._stopped === true);
      assert('it is de-registered from the parent', !!plain && !parent._dom_children.has(plain));
      assert('the error is printed exactly once -> ' + times_printed(L.errors.b_plain),
             times_printed(L.errors.b_plain) === 1);
      assert('the print names the component',
             lines_matching(/on_load\(\) failed in Le_Plain/) === 1);
      assert('the boot failure is still reported',
             lines_matching(/\[JQHTML Error\] Le_Plain#\w+ failed in boot/) === 1);

      console.log('  override:');
      assert('the hook ran once, with the error on_load() threw',
             hooks_for('b_fb').length === 1 && hooks_for('b_fb')[0].error === L.errors.b_fb);
      assert('no automatic print -> ' + times_printed(L.errors.b_fb), times_printed(L.errors.b_fb) === 0);
      assert('the fallback is rendered -> ' + (fb && text(fb)), !!fb && text(fb) === 'fallback:le boom b_fb');
      assert('ready fires and the component is live',
             !!fb && await settled(fb.ready(), 500) && fb._ready_state === 4 && fb._stopped === false);
      assert('this.args is readable in the hook -> ' + (fb && fb.data.arg_key), !!fb && fb.data.arg_key === 'b_fb');
      assert('this.$ is blocked in the hook -> ' + (fb && fb.data.dollar),
             !!fb && /Cannot access this\.\$ during on_load_error\(\)/.test(fb.data.dollar));
      let manual = null;
      try { fb.on_load_error(new Error('manual')); } catch (e) { manual = e.message; }
      assert('on_load_error() cannot be called manually -> ' + manual,
             !!manual && /on_load_error\(\) cannot be called manually/.test(manual));

      console.log('  override calling super.on_load_error():');
      assert('printed exactly once -> ' + times_printed(L.errors.b_super), times_printed(L.errors.b_super) === 1);
      assert('the print names the component', lines_matching(/on_load\(\) failed in Le_Super/) === 1);
      assert('no boot failure reported for it', lines_matching(/Le_Super#\w+ failed in boot/) === 0);
      assert('continues with the fallback -> ' + (sup && text(sup)), !!sup && text(sup) === 'super:le boom b_super');
      assert('ready fires', !!sup && await settled(sup.ready(), 500) && sup._stopped === false);

      console.log('  override that rethrows:');
      assert('the hook ran', hooks_for('b_rethrow').length === 1);
      assert('the component is stopped', !!rethrow && rethrow._stopped === true);
      assert('the error is printed once (the boot failure report) -> ' + times_printed(L.errors.b_rethrow),
             times_printed(L.errors.b_rethrow) === 1 &&
             lines_matching(/\[JQHTML Error\] Le_Rethrow#\w+ failed in boot/) === 1);

      console.log('  async override:');
      assert('the fallback set after an await is rendered -> ' + (async_c && text(async_c)),
             !!async_c && text(async_c) === 'async:le boom b_async');
      assert('ready fires', !!async_c && await settled(async_c.ready(), 500) && async_c._stopped === false);

      console.log('  cache:');
      assert('no cache write for any failed child -> ' + writes, writes === 0);
      assert('no stored entry for any fallback -> ' + stored_keys('b_').join(','), stored_keys('b_').length === 0);

      console.log('');
      console.log('B. DEDUPLICATION: EVERY COMPONENT SHARING A FAILED LOAD RUNS ITS OWN HOOK:');
      L.fail.d1 = 1;
      writes = 0;
      const shared = [make('Le_Fallback', { key: 'd1' }), make('Le_Fallback', { key: 'd1' }), make('Le_Fallback', { key: 'd1' })];
      assert('all three reach ready', await settled(Promise.all(shared.map((c) => c.ready())), 2000));
      assert('one on_load() for the group -> ' + L.calls.d1, L.calls.d1 === 1);
      assert('three hook runs, all with the same error -> ' + hooks_for('d1').length,
             hooks_for('d1').length === 3 && hooks_for('d1').every((h) => h.error === L.errors.d1));
      assert('each renders its own fallback', shared.every((c) => text(c) === 'fallback:le boom d1' && !c._stopped));
      assert('no automatic print', times_printed(L.errors.d1) === 0);
      assert('registry is empty -> ' + registry(), registry() === '{}');
      assert('no cache write -> ' + writes, writes === 0 && stored_keys('d1').length === 0);
      const retry = make('Le_Fallback', { key: 'd1' });
      assert('a later same-args component loads real data',
             await settled(retry.ready(), 2000) && L.calls.d1 === 2 && text(retry) === 'loaded:d1:');

      console.log('');
      console.log('C. AFTER AN ERROR THE INSTANCE NEVER READS OR WRITES THE CACHE:');
      const seed = make('Le_Fallback', { key: 'c1', id: 2 });
      assert('a healthy same-name instance loads', await settled(seed.ready(), 2000) && text(seed) === 'loaded:c1:2');
      await sleep(50);
      const seeded = stored_keys('c1').length;
      assert('the healthy instance is cached in data/html mode -> ' + seeded,
             cache_mode === 'none' ? seeded === 0 : seeded > 0);

      L.fail.c1 = 1;
      const victim = make('Le_Fallback', { key: 'c1', id: 1 });
      assert('the failing instance reaches ready on its fallback',
             await settled(victim.ready(), 2000) && text(victim) === 'fallback:le boom c1');

      reads = 0; writes = 0;
      victim.args.id = 2;   // args now match the cached entry: reload() would read it
      const r = await outcome(victim.reload(), 2000);
      assert('a later successful reload() resolves', r.settled && r.ok);
      assert('it shows real data -> ' + text(victim), text(victim) === 'loaded:c1:2');
      assert('no cache read -> ' + reads, reads === 0);
      assert('no cache write -> ' + writes, writes === 0);

      writes = 0;
      victim.args.id = 3;   // nothing cached for these args: the load itself decides
      const r3 = await outcome(victim.reload(), 2000);
      assert('a reload() to uncached args shows real data -> ' + text(victim),
             r3.ok && text(victim) === 'loaded:c1:3');
      assert('and writes nothing -> ' + writes + ' ' + stored_keys('"id":3').join(','),
             writes === 0 && stored_keys('"id":3').length === 0);

      console.log('');
      console.log('D. FAILED reload()/refresh()/load() WITHOUT AN OVERRIDE LEAVE ready() RESOLVABLE:');
      const p = make('Le_Plain', { key: 'r_plain' });
      assert('boots', await settled(p.ready(), 2000) && text(p) === 'loaded:r_plain:');
      for (const method of ['reload', 'refresh', 'load']) {
        L.fail.r_plain = 1;
        const before = L.errors.r_plain;
        const op = outcome(p[method](), 2000);
        await sleep(10);
        const waiter = p.ready();   // registered while the load is in flight
        const res = await op;
        assert(method + '() rejects with the error -> ' + (res.error && res.error.message),
               res.settled && res.ok === false && res.error === L.errors.r_plain && res.error !== before);
        assert(method + '(): a ready() waiter from during the load resolves', await settled(waiter, 1000));
        assert(method + '(): a later ready() resolves', await settled(p.ready(), 1000));
        assert(method + '(): _ready_state is 4 -> ' + p._ready_state, p._ready_state === 4);
        assert(method + '(): the component is not stopped', p._stopped === false);
        assert(method + '(): the error is printed once', times_printed(L.errors.r_plain) === 1);
      }
      assert('the component still reloads afterwards',
             (await outcome(p.reload(), 2000)).ok && text(p) === 'loaded:r_plain:');

      console.log('');
      console.log('E. FAILED reload()/refresh()/load() WITH AN OVERRIDE CONTINUE ON THE FALLBACK:');
      const f = make('Le_Fallback', { key: 'r_fb' });
      assert('boots', await settled(f.ready(), 2000) && text(f) === 'loaded:r_fb:');
      writes = 0;
      for (const method of ['reload', 'refresh', 'load']) {
        // Back to real data first, so refresh() has a change to render.
        await outcome(f.reload(), 2000);
        L.fail.r_fb = 1;
        const hooks_before = hooks_for('r_fb').length;
        const op = outcome(f[method](), 2000);
        await sleep(10);
        const waiter = f.ready();
        const res = await op;
        assert(method + '() resolves', res.settled && res.ok);
        assert(method + '(): the hook ran once', hooks_for('r_fb').length === hooks_before + 1);
        assert(method + '(): this.data is the fallback -> ' + f.data.value, f.data.value === 'fallback:le boom r_fb');
        if (method !== 'load') {
          assert(method + '(): the fallback is rendered -> ' + text(f), text(f) === 'fallback:le boom r_fb');
        }
        assert(method + '(): a ready() waiter from during the load resolves', await settled(waiter, 1000));
        assert(method + '(): _ready_state is 4 -> ' + f._ready_state, f._ready_state === 4 && !f._stopped);
        assert(method + '(): no automatic print', times_printed(L.errors.r_fb) === 0);
      }
      assert('no cache write after the first failure, successful reloads included -> ' + writes, writes === 0);
    } catch (error) {
      console.log('   FAIL: the test itself threw -> ' + error.message);
      original_error(error);
      failed++;
    } finally {
      console.error = original_error;
      Storage.prototype.getItem = real_get;
      Storage.prototype.setItem = real_set;
    }

    console.log('');
    console.log('========================================');
    console.log('SUMMARY: ' + passed + ' passed, ' + failed + ' failed');
    console.log('========================================');
    console.log('');
    window.testPassed = (failed === 0);
  }
}
