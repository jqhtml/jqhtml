// reload() recomputes the cache key from the current args every time and stores it even
// when it is null, so new args that cannot be keyed write nothing - instead of writing
// their data under the previous args' entry. In html mode the post-reload markup is
// snapshotted, so the html entry does not keep the boot-time markup.

window.__rk_pages = { 1: ['k1a', 'k1b'], 2: ['k2a', 'k2b', 'k2c'], 3: ['k3a'] };

class Reload_Cache_Key_Refresh extends Jqhtml_Component {
  async on_ready() {
    if (this.state.test_ran) return;
    this.state.test_ran = true;

    let passed = 0, failed = 0;
    const assert = (name, ok) => { console.log('   ' + (ok ? 'PASS' : 'FAIL') + ': ' + name); ok ? passed++ : failed++; };
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const cache_mode = window.__JQHTML_TEST_CACHE_MODE__ || 'none';
    const caching = cache_mode !== 'none';
    const stage = this.$sid('stage');
    const items = (c) => c.$.find('.item').map((_, el) => $(el).text()).get().join(',');

    // This mode's Rk_Pager entries: data entries in data mode, html snapshots in html mode.
    const entries = () => {
      const out = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.indexOf('Rk_Pager') === -1) continue;
        if ((key.indexOf('::html') !== -1) !== (cache_mode === 'html')) continue;
        out[key] = localStorage.getItem(key);
      }
      return out;
    };
    const keys_holding = (marker) => Object.keys(entries()).filter((k) => entries()[k].indexOf(marker) !== -1);

    let release = null;
    const close_gate = () => { window.__rk_gate = new Promise((r) => { release = r; }); };
    const open_gate = () => { window.__rk_gate = null; release(); };
    const wait_for_gate = async () => { for (let i = 0; i < 200 && !window.__rk_waiting; i++) await sleep(5); return window.__rk_waiting === true; };

    try {
      console.log('');
      console.log('A. BOOT page 1 (cache mode ' + cache_mode + ')');
      const p = $('<div>').appendTo(stage).component('Rk_Pager', { page: 1 }).component();
      await p.ready();
      assert('page 1 rendered -> ' + items(p), items(p) === 'k1a,k1b');
      const page1_keys = keys_holding('k1a');
      assert('page 1 is cached under one entry -> ' + page1_keys.length,
             caching ? page1_keys.length === 1 : page1_keys.length === 0);
      const before = JSON.stringify(entries());

      console.log('');
      console.log('B. reload() WITH ARGS THAT CANNOT BE KEYED WRITES NOTHING');
      p.args.page = 3;
      p.args.on_pick = () => {};   // a function arg: no cache key
      await p.reload();
      assert('page 3 rendered -> ' + items(p), items(p) === 'k3a');
      assert('page 3 is in no cache entry -> ' + keys_holding('k3a').join(' | '), keys_holding('k3a').length === 0);
      assert('the page 1 entry is unchanged', JSON.stringify(entries()) === before);

      console.log('');
      console.log('C. reload() WITH NEW CACHEABLE ARGS WRITES UNDER THE NEW KEY');
      delete p.args.on_pick;
      p.args.page = 2;
      await p.reload();
      assert('page 2 rendered -> ' + items(p), items(p) === 'k2a,k2b,k2c');
      const page2_keys = keys_holding('k2a');
      if (caching) {
        assert('page 2 is cached under one entry -> ' + page2_keys.join(' | '), page2_keys.length === 1);
        assert('that entry is not the page 1 entry', page2_keys.length === 1 && page2_keys[0] !== page1_keys[0]);
        assert('the page 1 entry still holds page 1 -> ' + keys_holding('k1a').join(' | '),
               keys_holding('k1a').join() === page1_keys.join());
      } else {
        assert('none: nothing cached', page2_keys.length === 0);
      }

      console.log('');
      console.log('D. A FRESH BOOT AFTER A RELOAD CHANGED THE MARKUP STARTS FROM THE NEW MARKUP');
      window.__rk_pages[2] = ['k2-new'];
      await p.reload();   // same args, new data -> new markup
      assert('reload rendered the new data -> ' + items(p), items(p) === 'k2-new');
      close_gate();
      const q = $('<div>').appendTo(stage).component('Rk_Pager', { page: 2 }).component();
      assert('on_load() is in flight', await wait_for_gate());
      const first_screen = items(q);
      if (caching) {
        assert(cache_mode + ': the cache shows the post-reload page before on_load() finishes -> ' + first_screen,
               first_screen === 'k2-new');
      } else {
        assert('none: nothing on screen before on_load() finishes -> ' + first_screen, first_screen === '');
      }
      open_gate();
      await q.ready();
      assert('the fresh boot ends on the fresh data -> ' + items(q), items(q) === 'k2-new');
    } catch (error) {
      console.log('   FAIL: the test itself threw -> ' + error.message);
      console.error(error);
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
