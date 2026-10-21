// 1. reload() with new cacheable args whose data equals the previous load writes the
//    cache under the new key, so a fresh boot with those args hits it. A reload with the
//    same key and unchanged data still writes nothing.
// 2. reload() into args that cannot be keyed sets data-nocache and prints the dev
//    warning, as boot and load() do, gated by warn_uncacheable_args. Cacheable args
//    again (boot, load() or reload()) remove a stale data-nocache.

window.__rn_rows = { 1: ['same'], 2: ['same'], 3: ['other'] };

class Reload_Cache_Write_And_Nocache extends Jqhtml_Component {
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

    // Every localStorage write of an Rn_Item entry, in order.
    const writes = [];
    const real_set_item = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (String(key).indexOf('Rn_Item') !== -1) writes.push(String(key));
      return real_set_item.call(this, key, value);
    };

    // Every console.warn, joined to one string each.
    const warnings = [];
    const real_warn = console.warn;
    console.warn = function (...a) { warnings.push(a.map((x) => String(x)).join(' ')); return real_warn.apply(console, a); };
    const warn_enabled = !!jqhtml.get_config().warn_uncacheable_args;

    let release = null;
    const close_gate = () => { window.__rn_gate = new Promise((r) => { release = r; }); };
    const open_gate = () => { window.__rn_gate = null; release(); };
    const wait_for_gate = async () => { for (let i = 0; i < 200 && !window.__rn_waiting; i++) await sleep(5); return window.__rn_waiting === true; };

    try {
      console.log('');
      console.log('A. BOOT id 1 (cache mode ' + cache_mode + ')');
      const p = $('<div>').appendTo(stage).component('Rn_Item', { id: 1 }).component();
      await p.ready();
      assert('id 1 rendered -> ' + items(p), items(p) === 'same');
      assert('boot wrote one entry -> ' + writes.join(' | '), caching ? writes.length === 1 : writes.length === 0);
      assert('no data-nocache', p.$.attr('data-nocache') === undefined);

      console.log('');
      console.log('B. reload() WITH NEW CACHEABLE ARGS AND IDENTICAL DATA WRITES UNDER THE NEW KEY');
      writes.length = 0;
      p.args.id = 2;
      await p.reload();
      assert('id 2 rendered -> ' + items(p), items(p) === 'same');
      if (caching) {
        assert('the reload wrote one entry -> ' + writes.join(' | '), writes.length === 1);
      } else {
        assert('none: nothing written', writes.length === 0);
      }

      console.log('');
      console.log('C. reload() WITH THE SAME KEY AND UNCHANGED DATA STILL WRITES NOTHING');
      writes.length = 0;
      await p.reload();
      assert('no write -> ' + writes.join(' | '), writes.length === 0);
      writes.length = 0;
      await p.refresh();
      assert('refresh(): no write -> ' + writes.join(' | '), writes.length === 0);

      console.log('');
      console.log('D. A FRESH BOOT WITH THE RELOADED ARGS HITS THE CACHE');
      close_gate();
      const q = $('<div>').appendTo(stage).component('Rn_Item', { id: 2 }).component();
      assert('on_load() is in flight', await wait_for_gate());
      const first_screen = items(q);
      if (caching) {
        assert(cache_mode + ': cached content shows before on_load() finishes -> ' + first_screen, first_screen === 'same');
      } else {
        assert('none: nothing on screen before on_load() finishes -> ' + first_screen, first_screen === '');
      }
      open_gate();
      await q.ready();
      assert('the fresh boot ends on the fresh data -> ' + items(q), items(q) === 'same');

      console.log('');
      console.log('E. reload() INTO UNKEYABLE ARGS SETS data-nocache AND WARNS');
      writes.length = 0;
      warnings.length = 0;
      p.args.id = 3;
      p.args.on_pick = () => {};
      await p.reload();
      assert('id 3 rendered -> ' + items(p), items(p) === 'other');
      assert('data-nocache = on_pick:function -> ' + p.$.attr('data-nocache'), p.$.attr('data-nocache') === 'on_pick:function');
      const warn = warnings.find((w) => w.indexOf('<Rn_Item> cannot be cached') !== -1);
      if (warn_enabled) {
        assert('warned, naming the arg', !!warn && warn.indexOf('arg $on_pick is not keyable') !== -1);
        assert('the warning gives the DevTools locator', !!warn && warn.indexOf('[data-nocache="on_pick:function"]') !== -1);
      } else {
        assert('warn_uncacheable_args is off: no warning', !warn);
      }
      assert('nothing written', writes.length === 0);

      console.log('');
      console.log('F. THE RELOAD WARNING FOLLOWS warn_uncacheable_args');
      warnings.length = 0;
      jqhtml.configure({ warn_uncacheable_args: false });
      delete p.args.on_pick;
      p.args.on_other = () => {};
      await p.reload();
      jqhtml.configure({ warn_uncacheable_args: warn_enabled });
      assert('data-nocache = on_other:function -> ' + p.$.attr('data-nocache'), p.$.attr('data-nocache') === 'on_other:function');
      assert('flag off: no warning', !warnings.some((w) => w.indexOf('cannot be cached') !== -1));

      console.log('');
      console.log('G. reload() BACK TO CACHEABLE ARGS REMOVES data-nocache');
      delete p.args.on_other;
      p.args.id = 1;
      await p.reload();
      assert('id 1 rendered -> ' + items(p), items(p) === 'same');
      assert('data-nocache removed -> ' + p.$.attr('data-nocache'), p.$.attr('data-nocache') === undefined);

      console.log('');
      console.log('H. BOOT AND load() ARE UNCHANGED, AND ALSO REMOVE A STALE data-nocache');
      warnings.length = 0;
      const b = $('<div>').appendTo(stage).component('Rn_Item', { id: 3, on_boot: () => {} }).component();
      await b.ready();
      assert('boot: data-nocache = on_boot:function', b.$.attr('data-nocache') === 'on_boot:function');
      const boot_warn = warnings.find((w) => w.indexOf('arg $on_boot is not keyable') !== -1);
      assert('boot: warned iff warn_uncacheable_args', warn_enabled ? !!boot_warn : !boot_warn);

      delete b.args.on_boot;
      b.args.id = 1;
      await b.load();
      assert('load() with cacheable args removes data-nocache -> ' + b.$.attr('data-nocache'), b.$.attr('data-nocache') === undefined);

      warnings.length = 0;
      b.args.id = 3;
      b.args.on_load_arg = () => {};
      await b.load();
      assert('load() with unkeyable args: data-nocache = on_load_arg:function', b.$.attr('data-nocache') === 'on_load_arg:function');
      const load_warn = warnings.find((w) => w.indexOf('arg $on_load_arg is not keyable') !== -1);
      assert('load(): warned iff warn_uncacheable_args', warn_enabled ? !!load_warn : !load_warn);

      const s = $('<div data-nocache="stale:function">').appendTo(stage).component('Rn_Item', { id: 1 }).component();
      await s.ready();
      assert('boot with cacheable args removes a stale data-nocache -> ' + s.$.attr('data-nocache'), s.$.attr('data-nocache') === undefined);
    } catch (error) {
      console.log('   FAIL: the test itself threw -> ' + error.message);
      console.error(error);
      failed++;
    } finally {
      Storage.prototype.setItem = real_set_item;
      console.warn = real_warn;
    }

    console.log('');
    console.log('========================================');
    console.log('SUMMARY: ' + passed + ' passed, ' + failed + ' failed');
    console.log('========================================');
    window.testPassed = (failed === 0);
    window.testReady = true;
  }
}
