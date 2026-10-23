class Test_Was_Ready_Before extends Jqhtml_Component {
  async on_ready() {
    if (this.state.test_ran) return;
    this.state.test_ran = true;

    let passed = 0, failed = 0;
    const assert = (name, ok) => { console.log('   ' + (ok ? 'PASS' : 'FAIL') + ': ' + name); ok ? passed++ : failed++; };
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const cache_mode = window.__JQHTML_TEST_CACHE_MODE__ || 'none';
    const caching = cache_mode !== 'none';
    const stage = this.$sid('stage');
    // Boot one instance attached to the page, wait for ready, remove it
    const visit = async (name, args) => {
      const c = $('<div>').appendTo(stage).component(name, args).component();
      await c.ready();
      c.$.remove();
      return c;
    };
    const markers = () => {
      const out = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.indexOf('::ready::') !== -1) out.push(key);
      }
      return out;
    };

    try {
      console.log('');
      console.log('A. FIRST VISIT IS COLD, SECOND IS WARM (cache mode ' + cache_mode + ')');
      const first = await visit('Wr_Page', { id: 1 });
      assert('first visit: was_ready_before() false in on_create()', first.state.cold === true);
      assert('first visit: still false in on_ready() (frozen)', first.state.in_ready === false);
      const second = await visit('Wr_Page', { id: 1 });
      assert('second visit with the same args: ' + (caching ? 'true' : 'false (no cache key)'),
        second.state.cold === !caching);
      assert('second visit: same answer in on_ready()', second.state.in_ready === caching);

      console.log('');
      console.log('B. DIFFERENT ARGS ARE A DIFFERENT KEY');
      const other = await visit('Wr_Page', { id: 2 });
      assert('id 2 is cold', other.state.cold === true);

      console.log('');
      console.log('C. ONLY COMPONENTS THAT ASK WRITE A MARKER');
      // Wr_Leaf booted inside every Wr_Page and never asked
      assert('no marker for Wr_Leaf -> ' + markers().join(' | '),
        markers().every((k) => k.indexOf('Wr_Leaf') === -1));
      assert(caching ? 'markers for Wr_Page ids 1 and 2' : 'no markers without a cache key',
        markers().filter((k) => k.indexOf('Wr_Page') !== -1).length === (caching ? 2 : 0));

      console.log('');
      console.log('D. A COMPONENT WITH on_load()');
      const l1 = await visit('Wr_Loaded', { id: 1 });
      const l2 = await visit('Wr_Loaded', { id: 1 });
      assert('first cold, frozen in on_ready()', l1.state.cold === true && l1.state.in_ready === false);
      assert('second ' + (caching ? 'warm' : 'cold'), l2.state.cold === !caching);

      console.log('');
      console.log('E. cache_id() DECIDES THE KEY');
      await visit('Wr_Custom', { id: 7, noise: 'a' });
      const c2 = await visit('Wr_Custom', { id: 7, noise: 'b' });
      assert('same cache_id(), different args: ' + (caching ? 'warm' : 'cold'), c2.state.cold === !caching);

      console.log('');
      console.log('F. UNKEYABLE ARGS ARE ALWAYS FALSE');
      await visit('Wr_Page', { id: 1, on_pick: () => {} });
      const u2 = await visit('Wr_Page', { id: 1, on_pick: () => {} });
      assert('function arg: cold on the second visit', u2.state.cold === true);

      console.log('');
      console.log('G. A DETACHED COMPONENT IS FALSE AND WRITES NO MARKER');
      const before_detached = markers().length;
      const d = $('<div>').component('Wr_Page', { id: 9 }).component();
      await sleep(50);
      assert('detached: was_ready_before() false', d.state.cold === true);
      d.stop();
      assert('detached: no marker written', markers().length === before_detached);

      console.log('');
      console.log('H. STOPPED BEFORE READY WRITES NO MARKER');
      let release;
      window.__wr_gate = new Promise((r) => { release = r; });
      const s = $('<div>').appendTo(stage).component('Wr_Loaded', { id: 5 }).component();
      await sleep(20);
      s.$.remove();   // stops it while on_load() is held
      window.__wr_gate = null;
      release();
      await sleep(20);
      const s2 = await visit('Wr_Loaded', { id: 5 });
      assert('the next visit is still cold', s2.state.cold === true);

      console.log('');
      console.log('I. reload() WITH NEW ARGS RE-CAPTURES; SAME ARGS KEEP THE ANSWER');
      const p = $('<div>').appendTo(stage).component('Wr_Page', { id: 1 }).component();
      await p.ready();
      assert('id 1: ' + (caching ? 'warm' : 'cold'), p.was_ready_before() === caching);
      p.args.id = 3;
      await p.reload();
      assert('after reload() to id 3: false (new key, never ready)', p.was_ready_before() === false);
      await p.reload();
      assert('after a same-args reload(): still false (frozen)', p.was_ready_before() === false);
      p.$.remove();
      const p3 = await visit('Wr_Page', { id: 3 });
      assert('a new id 3 instance: ' + (caching ? 'warm (marker from the reload)' : 'cold'),
        p3.state.cold === !caching);

      console.log('');
      console.log('J. A CACHE SCOPE CHANGE CLEARS THE MARKERS');
      if (caching) {
        jqhtml.set_cache_key('test_other_scope', cache_mode);
        const after = await visit('Wr_Page', { id: 1 });
        assert('id 1 is cold in the new scope', after.state.cold === true);
        assert('old-scope markers are gone -> ' + markers().join(' | '),
          markers().every((k) => k.indexOf('test_fixed_key') === -1));
        jqhtml.set_cache_key('test_fixed_key', cache_mode);
        const back = await visit('Wr_Page', { id: 1 });
        assert('switching back starts cold too (the scope change wiped them)', back.state.cold === true);

        console.log('');
        console.log('K. A JQHTML VERSION CHANGE CLEARS THE MARKERS');
        await visit('Wr_Page', { id: 4 });
        assert('id 4 has a marker', markers().some((k) => k.indexOf('Wr_Page') !== -1 && k.indexOf('4') !== -1));
        // Pretend the stored scope was written by another core version
        localStorage.setItem('_jqhtml_cache_key', '0.0.0::test_fixed_key');
        jqhtml.set_cache_key('test_fixed_key', cache_mode);
        assert('all markers cleared -> ' + markers().join(' | '), markers().length === 0);
        const v = await visit('Wr_Page', { id: 4 });
        assert('id 4 is cold after the version change', v.state.cold === true);
      } else {
        assert('no cache key: nothing to clear', markers().length === 0);
      }
    } catch (e) {
      assert('no exception: ' + e.message, false);
    }

    console.log('');
    console.log('========================================');
    console.log('SUMMARY: ' + passed + ' passed, ' + failed + ' failed');
    console.log('========================================');
    window.testPassed = (failed === 0);
    window.testReady = true;
  }
}
