class Test_Skip_Cache_Read extends Jqhtml_Component {
  async on_ready() {
    if (this.state.test_ran) return;
    this.state.test_ran = true;

    let passed = 0, failed = 0;
    const assert = (name, ok) => { console.log('   ' + (ok ? 'PASS' : 'FAIL') + ': ' + name); ok ? passed++ : failed++; };
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const cache_mode = window.__JQHTML_TEST_CACHE_MODE__ || 'none';
    const caching = cache_mode !== 'none';
    const stage = this.$sid('stage');
    window.__scr = {};

    // Boot one attached instance with this load version, wait for the whole subtree
    const mount = async (name, args, version) => {
      window.__scr_version = version;
      window.__scr = {};
      const c = $('<div>').appendTo(stage).component(name, args).component();
      await c.ready();
      return c;
    };
    const visit = async (name, args, version) => {
      const c = await mount(name, args, version);
      c.$.remove();
      return c;
    };
    const paint = (key) => (window.__scr[key] ? window.__scr[key].first_paint : '(not rendered)');
    // The subtree of a Scr_Page with tag t: page, child, grandchild, re-render-created late
    const subtree = (t) => ['Scr_Page:' + t, 'Scr_Child:' + t, 'Scr_Grand:' + t, 'Scr_Late:' + t];

    try {
      console.log('');
      console.log('A. WARM THE CACHE (cache mode ' + cache_mode + ')');
      await visit('Scr_Page', { tag: 'A' }, 1);
      for (const key of subtree('A')) assert(key + ' first paint is init on a cold boot', paint(key) === 'init');

      console.log('');
      console.log('B. skip_cache_read: THE WHOLE SUBTREE BOOTS AS ON A MISS');
      const skipped = await mount('Scr_Page', { tag: 'A', skip_cache_read: true }, 2);
      for (const key of subtree('A')) {
        assert(key + ' first paint is the on_create() data -> ' + paint(key), paint(key) === 'init');
      }
      for (const key of subtree('A')) {
        assert(key + ' loaded version 2', window.__scr[key].instance.data.value === key.split(':')[1] + '_2');
      }

      console.log('');
      console.log('C. $(el).component() INSIDE THE SUBTREE INHERITS IT');
      window.__scr = {};
      const inner = $('<div>').appendTo(skipped.$).component('Scr_Grand', { tag: 'A' }).component();
      await inner.ready();
      assert('Scr_Grand created inside a skipping page paints init -> ' + paint('Scr_Grand:A'),
        paint('Scr_Grand:A') === 'init');
      skipped.$.remove();

      console.log('');
      console.log('D. THE SKIPPING BOOT STILL WROTE THE CACHE, UNDER THE ORDINARY KEY');
      await visit('Scr_Page', { tag: 'A' }, 3);
      for (const key of subtree('A')) {
        const want = caching ? key.split(':')[1] + '_2' : 'init';
        assert(key + ' first paint ' + want + ' -> ' + paint(key), paint(key) === want);
      }

      console.log('');
      console.log('E. THE TEMPLATE SPELLING $skip_cache_read=true');
      await visit('Scr_Page', { tag: 'T' }, 4);
      await visit('Scr_Wrap', {}, 5);
      for (const key of subtree('T')) assert(key + ' paints init -> ' + paint(key), paint(key) === 'init');
      await visit('Scr_Page', { tag: 'T' }, 6);
      assert('Scr_Page:T then paints ' + (caching ? 'T_5' : 'init') + ' -> ' + paint('Scr_Page:T'),
        paint('Scr_Page:T') === (caching ? 'T_5' : 'init'));

      console.log('');
      console.log('F. RESERVED: NOT IN this.args, NOT IN THE CACHE OR DEDUP KEY');
      const plain = await mount('Scr_Page', { tag: 'K' }, 7);
      const plain_keys = {
        cache: plain._cache_key,
        dedup: jqhtml.Load_Coordinator.generate_invocation_key('Scr_Page', plain.args).key,
      };
      plain.$.remove();
      const skip = await mount('Scr_Page', { tag: 'K', skip_cache_read: true }, 8);
      const skip_child = window.__scr['Scr_Child:K'].instance;
      assert('page this.args has no skip_cache_read -> ' + JSON.stringify(skip.args), !('skip_cache_read' in skip.args));
      assert('child this.args has no skip_cache_read', !('skip_cache_read' in skip_child.args));
      assert('cache key identical -> ' + skip._cache_key, skip._cache_key === plain_keys.cache);
      assert('dedup key identical -> ' + plain_keys.dedup,
        jqhtml.Load_Coordinator.generate_invocation_key('Scr_Page', skip.args).key === plain_keys.dedup);
      skip.$.remove();
      const off = await visit('Scr_Page', { tag: 'K', skip_cache_read: false }, 9);
      assert('skip_cache_read=false is removed from this.args too', !('skip_cache_read' in off.args));

      console.log('');
      console.log('G. was_ready_before() ANSWERS THE SAME WITH AND WITHOUT IT');
      const w1 = await visit('Scr_Page', { tag: 'W' }, 10);
      const w2 = await visit('Scr_Page', { tag: 'W', skip_cache_read: true }, 11);
      assert('first visit cold', w1.state.was_ready_before === false);
      assert('skipping revisit: ' + caching, w2.state.was_ready_before === caching);
      const v1 = await visit('Scr_Page', { tag: 'V', skip_cache_read: true }, 12);
      const v2 = await visit('Scr_Page', { tag: 'V' }, 13);
      assert('skipping first visit cold', v1.state.was_ready_before === false);
      assert('the skipping visit wrote its marker: ' + caching, v2.state.was_ready_before === caching);

      console.log('');
      console.log('H. A COMPONENT WITH NO LAYOUT BOX (display:none) SKIPS THE READ TOO');
      await visit('Scr_Page', { tag: 'H' }, 14);
      const hidden_box = $('<div style="display:none">').appendTo(stage);
      window.__scr_version = 15;
      window.__scr = {};
      const hidden = $('<div>').appendTo(hidden_box).component('Scr_Page', { tag: 'H' }).component();
      await hidden.ready();
      for (const key of subtree('H')) assert(key + ' hidden: paints init -> ' + paint(key), paint(key) === 'init');
      hidden_box.remove();
      await visit('Scr_Page', { tag: 'H' }, 16);
      for (const key of subtree('H')) {
        const want = caching ? 'H_15' : 'init';
        assert(key + ' then visible: paints ' + want + ' (the hidden boot wrote) -> ' + paint(key), paint(key) === want);
      }

      console.log('');
      console.log('I. reload() WITH CHANGED ARGS WHILE HIDDEN DOES NOT RENDER FROM CACHE');
      await visit('Scr_Page', { tag: 'R2' }, 17);
      const r = await mount('Scr_Page', { tag: 'R1' }, 18);
      const renders = [];
      r.on('render', () => renders.push(r.$.children('.val').text()));
      r.$.parent().hide();
      r.args.tag = 'R2';
      window.__scr_version = 19;
      await r.reload();
      assert('no render shows the cached R2_17 -> ' + JSON.stringify(renders), renders.indexOf('R2_17') === -1);
      assert('ends on the loaded R2_19', r.data.value === 'R2_19');
      r.$.parent().remove();
      await sleep(10);
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
