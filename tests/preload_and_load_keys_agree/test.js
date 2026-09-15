// Part 3 needs a real cache to write into and read back from.
const VALID_MODES_CACHE_WRITE = ['data'];

class Test_Preload_Load_Keys extends Jqhtml_Component {
  on_create() {
    this.state.ran = false;
  }

  async on_ready() {
    if (this.state.ran) return;
    this.state.ran = true;

    let passed = 0, failed = 0;
    const assert = (n, c) => { console.log((c ? '   PASS: ' : '   FAIL: ') + n); c ? passed++ : failed++; };

    // Every wait races a timeout, so a regression that never resolves fails the test
    // instead of hanging until the harness delay expires with no summary.
    const wait = (promise, label, ms = 3000) => Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout: ' + label)), ms)),
    ]);

    const spawn = (name, args) => {
      const $el = $('<div>').appendTo(this.$);
      $el.component(name, args);
      return $el.component();
    };

    const cache_mode = window.__JQHTML_TEST_CACHE_MODE__ || 'none';

    try {
      // ============================================================
      // 1. OBJECT-ARG COMPONENT HYDRATES FROM PRELOAD
      // ============================================================
      console.log('\n1. OBJECT-ARG PRELOAD (no key on the entry):');

      window.__pk_obj_loads = 0;
      window.__pk_obj_value = 'loaded_1';

      // An unquoted object literal is not lexable as a $ value, so the args come
      // through the jQuery plugin - the same path a parent's state arg would take.
      jqhtml.set_preload_data([
        { component: 'Pk_Obj', args: { filter: { a: 1 } }, data: { v: 'pre' } },
      ]);

      const obj1 = spawn('Pk_Obj', { filter: { a: 1 } });
      await wait(obj1.ready(), 'obj1.ready()');

      assert('object-arg component hydrated from preload', obj1.data.v === 'pre');
      assert('on_load() never ran for the preloaded component', window.__pk_obj_loads === 0);

      obj1.stop();
      obj1.$.remove();

      // ============================================================
      // 2. cache_id() COMPONENT HYDRATES FROM A KEY-CARRYING ENTRY
      // ============================================================
      console.log('\n2. cache_id() PRELOAD (entry carries the exact key):');

      window.__pk_id_loads = 0;

      jqhtml.set_preload_data([
        { component: 'Pk_Id', args: {}, data: { v: 'pre_id' }, key: 'Pk_Id::custom_1' },
      ]);

      const id1 = spawn('Pk_Id', {});
      await wait(id1.ready(), 'id1.ready()');

      assert('cache_id() component hydrated from preload', id1.data.v === 'pre_id');
      assert('on_load() never ran for the cache_id() component', window.__pk_id_loads === 0);
      assert('the key the component used is the entry key', id1._cache_key === 'Pk_Id::custom_1');

      id1.stop();
      id1.$.remove();

      jqhtml.clear_preload_data();

      // ============================================================
      // 3. load() WRITES THE CACHE THAT create() READS (data mode only)
      // ============================================================
      console.log('\n3. load() CACHE WRITE FOR AN OBJECT ARG:');

      if (!VALID_MODES_CACHE_WRITE.includes(cache_mode)) {
        console.log('   [SKIP] only applies to cache modes: ' + VALID_MODES_CACHE_WRITE.join(', '));
      } else {
        window.__pk_obj_value = 'v1';
        const a = spawn('Pk_Obj', { filter: { a: 3 } });
        await wait(a.ready(), 'a.ready()');
        assert('first component loaded v1', a.data.v === 'v1');

        window.__pk_obj_value = 'v2';
        const changed = await wait(a.load(), 'a.load()');
        assert('load() reported a data change', changed === true);
        assert('load() left this.data at v2', a.data.v === 'v2');

        // A NEW object with the SAME content - identity keying could never match it.
        const b = spawn('Pk_Obj', { filter: { a: 3 } });
        // Read before on_load() can resolve (it awaits a timer): this value can only
        // have come from the cache read in create().
        const hydrated = b.data.v;
        assert('equal-content component hydrated from cache in create()', hydrated === 'v2');

        await wait(b.ready(), 'b.ready()');

        a.stop(); a.$.remove();
        b.stop(); b.$.remove();
      }

      // ============================================================
      // 4. A THROWING cache_id() INSIDE load() IS RECORDED, NOT SWALLOWED
      // ============================================================
      console.log('\n4. THROWING cache_id() DURING load():');

      const warn_enabled = !!(jqhtml.get_config && jqhtml.get_config().warn_uncacheable_args);
      const original_warn = console.warn;
      let cache_id_warnings = 0;

      window.__pk_throw_armed = false;
      const thrower = spawn('Pk_Throw', {});
      await wait(thrower.ready(), 'thrower.ready()');
      assert('component booted while cache_id() was safe', thrower.$.attr('data-nocache') === undefined);

      console.warn = function (...args) {
        if (typeof args[0] === 'string' && args[0].indexOf('cache_id()') !== -1) cache_id_warnings++;
        return original_warn.apply(console, args);
      };

      try {
        window.__pk_throw_armed = true;
        await wait(thrower.load(), 'thrower.load() #1');
        await wait(thrower.load(), 'thrower.load() #2');
      } finally {
        console.warn = original_warn;
      }

      assert('load() completed despite the throwing cache_id()', thrower.data.n === 3);
      assert('element records why it is uncacheable',
             thrower.$.attr('data-nocache') === 'cache_id():cache-id-threw');
      if (warn_enabled) {
        assert('exactly one warning across two loads', cache_id_warnings === 1);
      } else {
        console.log('   [SKIP] warn_uncacheable_args is off in this configuration');
      }

      thrower.stop();
      thrower.$.remove();
    } catch (error) {
      console.log('   FAIL: unexpected error - ' + (error && error.message));
      failed++;
    }

    console.log('\n========================================');
    console.log('SUMMARY: ' + passed + ' passed, ' + failed + ' failed');
    console.log('========================================\n');

    window.testPassed = (failed === 0);
    window.testReady = true;
  }
}
