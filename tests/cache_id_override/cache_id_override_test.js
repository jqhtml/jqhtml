/**
 * Cache_Id_Override_Test - regression/behavioral test for cache_id() cache-key override
 *
 * @see packages/core/src/component.ts (~751-754, ~954-960)
 * @see packages/core/src/component-cache.ts (generate_cache_key)
 *
 * In 'data'/'html' cache modes: a component overriding cache_id() to return a fixed
 * key must resolve to the SAME cache entry across instances with DIFFERENT this.args,
 * while a control component (no cache_id()) must resolve to DIFFERENT cache entries
 * when args differ.
 *
 * In 'none' mode there is no active cache to observe, so we only assert the
 * cache_id() method itself exists/works and the component still loads normally.
 */
class Cache_Id_Override_Test extends Jqhtml_Component {
  async on_ready() {
    const cacheMode = window.__JQHTML_TEST_CACHE_MODE__ || 'none';

    console.log('');
    console.log('========================================');
    console.log('cache_id() OVERRIDE TEST');
    console.log(`Cache mode: ${cacheMode}`);
    console.log('========================================');

    const results = [];
    let n = 0;
    const check = (desc, passed) => {
      n++;
      if (passed) {
        console.log(`✅ TEST ${n} PASS: ${desc}`);
      } else {
        console.log(`❌ TEST ${n} FAIL: ${desc}`);
      }
      results.push(passed);
    };

    const mount = this.$sid('mount');
    const spawn = (name, args) => {
      const $el = $('<div>').appendTo(mount);
      $el.component(name, args);
      return $el.component();
    };

    if (cacheMode === 'none') {
      // No cache is active in this mode - just verify cache_id() exists/works and
      // that the component still loads through the normal (uncached) lifecycle.
      const c = spawn('Cache_Id_Custom', { seed: 1 });
      await c.ready();

      check('cache_id() exists as a function on the component', typeof c.cache_id === 'function');
      check('cache_id() is callable and returns a string', typeof c.cache_id() === 'string');
      check('cache_id() returns the expected fixed value', c.cache_id() === 'fixed_override_key');
      check('component still loads normally via on_load() (no cache active in none mode)', c.data.value === 'custom_loaded_1_seed1');

      this.finish(results);
      return;
    }

    // ---- Custom (cache_id override) component: two instances, DIFFERENT args ----
    const custom1 = spawn('Cache_Id_Custom', { seed: 1 });
    await custom1.ready();

    const custom2 = spawn('Cache_Id_Custom', { seed: 2 });
    await custom2.ready();

    check(
      'custom: cache_id() returns the same fixed key on both instances',
      custom1.cache_id() === 'fixed_override_key' && custom2.cache_id() === 'fixed_override_key'
    );
    check(
      'custom: resolved internal cache key is IDENTICAL across differing args (cache_id() wins over args)',
      custom1._cache_key !== null && custom1._cache_key !== undefined && custom1._cache_key === custom2._cache_key
    );

    // ---- Control component (no cache_id()): two instances, DIFFERENT args ----
    const control1 = spawn('Cache_Id_Control', { seed: 1 });
    await control1.ready();

    const control2 = spawn('Cache_Id_Control', { seed: 2 });
    await control2.ready();

    check(
      'control: resolved internal cache key DIFFERS across differing args (standard args-based key)',
      control1._cache_key !== control2._cache_key
    );

    if (cacheMode === 'data') {
      // use_cached_data=true forces the component to consume a cache hit (if any)
      // and SKIP on_load() entirely. A third instance with yet another `seed` but
      // the same cache_id() should still hit the entry written by custom1/custom2.
      window.__custom_load_count = 0;
      const custom3 = spawn('Cache_Id_Custom', { seed: 999, use_cached_data: true });
      await custom3.ready();

      check(
        'data mode: custom instance w/ different args + use_cached_data SKIPS on_load (cache_id key hit)',
        window.__custom_load_count === 0
      );
      check(
        'data mode: custom instance received the PRIOR instance\'s cached data despite different args',
        custom3.data.value === custom2.data.value
      );

      window.__control_load_count = 0;
      const control3 = spawn('Cache_Id_Control', { seed: 999, use_cached_data: true });
      await control3.ready();

      check(
        'data mode: control instance w/ different args + use_cached_data still RUNS on_load (args-based key miss)',
        window.__control_load_count === 1
      );
      check(
        'data mode: control instance data DIFFERS from prior instance (no false cache hit across differing args)',
        control3.data.value !== control2.data.value
      );
    }

    if (cacheMode === 'html') {
      // In html mode, cache hits are observed via _used_cached_html at on_render()
      // time (before the framework forces a post-load re-render either way).
      check(
        'html mode: custom instance 2 was served CACHED HTML at render (cache_id key hit despite differing args)',
        custom2.state.cache_hit_at_render === true
      );
      check(
        'html mode: control instance 2 was NOT served cached HTML (args-based key miss)',
        control2.state.cache_hit_at_render !== true
      );
    }

    this.finish(results);
  }

  finish(results) {
    const all_passed = results.length > 0 && results.every((t) => t);
    console.log('');
    if (all_passed) {
      console.log('✅ ALL TESTS PASSED');
      $('#results').html('<span style="color: green;">✅ All tests passed</span>');
    } else {
      console.log('❌ SOME TESTS FAILED');
      $('#results').html('<span style="color: red;">❌ Some tests failed</span>');
    }
    console.log('========================================');

    window.testPassed = all_passed;
  }
}
