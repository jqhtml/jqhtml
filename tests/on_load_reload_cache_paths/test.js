// The args snapshot _render() records is now kept as JSON text and this.data is
// compared through one serialized text per data generation. Neither may change a
// decision: an args change still sends reload() to the cache first (rendering the
// cached page before on_load() finishes in 'data' and 'html' modes), refresh() with
// identical data still renders nothing, and changed data still re-renders.

window.__pages = { 1: ['p1a', 'p1b'], 2: ['p2a', 'p2b', 'p2c'] };

class On_Load_Reload_Cache_Paths extends Jqhtml_Component {
  async on_ready() {
    if (this.state.test_ran) return;
    this.state.test_ran = true;

    let passed = 0, failed = 0;
    const assert = (name, ok) => { console.log('   ' + (ok ? 'PASS' : 'FAIL') + ': ' + name); ok ? passed++ : failed++; };
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const cache_mode = window.__JQHTML_TEST_CACHE_MODE__ || 'none';
    const stage = this.$sid('stage');
    const items = (c) => c.$.find('.item').map((_, el) => $(el).text()).get().join(',');
    let release = null;
    const close_gate = () => { window.__pager_gate = new Promise((r) => { release = r; }); };
    const open_gate = () => { window.__pager_gate = null; release(); };
    const wait_for_gate = async () => { for (let i = 0; i < 200 && !window.__pager_waiting; i++) await sleep(5); return window.__pager_waiting === true; };

    try {
      console.log('');
      console.log('A. BOOT page 1, then reload() page 2');
      const p = $('<div>').appendTo(stage).component('Pager', { page: 1 }).component();
      await p.ready();
      assert('page 1 rendered -> ' + items(p), items(p) === 'p1a,p1b');
      p.args.page = 2;
      await p.reload();
      assert('page 2 rendered -> ' + items(p), items(p) === 'p2a,p2b,p2c');

      console.log('');
      console.log('B. ARGS CHANGED BACK TO page 1: reload() tries the cache first (' + cache_mode + ')');
      p.args.page = 1;
      close_gate();
      let renders = p.state.renders;
      const reloading = p.reload();
      assert('on_load() is in flight', await wait_for_gate());
      if (cache_mode === 'none') {
        assert('none: nothing rendered before on_load() finishes -> ' + items(p), items(p) === 'p2a,p2b,p2c' && p.state.renders === renders);
      } else {
        assert(cache_mode + ': the cached page 1 is on screen before on_load() finishes -> ' + items(p), items(p) === 'p1a,p1b');
        assert(cache_mode + ': rendered once from cache -> ' + (p.state.renders - renders), p.state.renders === renders + 1);
      }
      open_gate();
      await reloading;
      assert('page 1 rendered after the load -> ' + items(p), items(p) === 'p1a,p1b');
      // data: the cache render already matched the fresh data -> no second render.
      // html: injected markup is inert and is always replaced by a template render.
      // none: the one render after the load.
      const expected = cache_mode === 'html' ? 2 : 1;
      assert('total renders for this reload -> ' + (p.state.renders - renders) + ' (expected ' + expected + ')',
             p.state.renders - renders === expected);

      console.log('');
      console.log('C. ARGS UNCHANGED: reload() goes straight to on_load()');
      close_gate();
      renders = p.state.renders;
      const plain_reload = p.reload();
      assert('on_load() is in flight', await wait_for_gate());
      assert('nothing rendered from cache -> renders +' + (p.state.renders - renders), p.state.renders === renders);
      open_gate();
      await plain_reload;
      assert('reload() always renders once after the load -> +' + (p.state.renders - renders), p.state.renders === renders + 1);

      console.log('');
      console.log('D. refresh() WITH IDENTICAL DATA SKIPS THE RENDER');
      renders = p.state.renders;
      let readies = p.state.readies;
      await p.refresh();
      assert('no re-render -> +' + (p.state.renders - renders), p.state.renders === renders);
      assert('no on_ready() -> +' + (p.state.readies - readies), p.state.readies === readies);

      console.log('');
      console.log('E. refresh() WITH CHANGED DATA RE-RENDERS');
      window.__pages[1] = ['p1a', 'p1b', 'p1-new'];
      renders = p.state.renders;
      readies = p.state.readies;
      await p.refresh();
      assert('re-rendered -> +' + (p.state.renders - renders), p.state.renders === renders + 1);
      assert('on_ready() ran -> +' + (p.state.readies - readies), p.state.readies === readies + 1);
      assert('new item on screen -> ' + items(p), items(p) === 'p1a,p1b,p1-new');

      console.log('');
      console.log('F. load() REPORTS CHANGE AND WRITES THE CACHE');
      assert('unchanged -> false', (await p.load()) === false);
      window.__pages[1] = ['only'];
      assert('changed -> true', (await p.load()) === true);
      assert('this.data has it, DOM not re-rendered -> ' + p.data.items.join(',') + ' / ' + items(p),
             p.data.items.join(',') === 'only' && items(p) === 'p1a,p1b,p1-new');
      if (cache_mode === 'data') {
        let entry = null;
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key.indexOf('Pager') !== -1 && key.indexOf('::html') === -1 && localStorage.getItem(key).indexOf('"only"') !== -1) entry = key;
        }
        assert('data mode: load() wrote the new data to the cache -> ' + entry, entry !== null);
      }

      console.log('');
      console.log('G. A SECOND INSTANCE ON page 2 BOOTS FROM THE CACHE THE RELOAD WROTE');
      const q = $('<div>').appendTo(stage).component('Pager', { page: 2 }).component();
      await q.ready();
      assert('page 2 rendered -> ' + items(q), items(q) === 'p2a,p2b,p2c');
      // data: cache hit equals the fresh load -> one render. none/html: render
      // empty, then render the loaded page (html has no snapshot for page 2: only
      // the boot load of an instance writes one).
      const boot_renders = cache_mode === 'data' ? 1 : 2;
      assert('boot renders -> ' + q.state.renders + ' (expected ' + boot_renders + ')', q.state.renders === boot_renders);
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
